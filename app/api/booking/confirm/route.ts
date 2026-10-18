import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';
import { BookingSchema } from '@/schema/booking';
import { enforceRateLimit, RATE_LIMIT_PROFILES } from '@/utils/rateLimit';
import { computeAuthoritativeBookingPrice } from '@/utils/serverPricing';
import type { PackageOption, TimeSlot } from '@/types';

export async function POST(request: Request) {
  try {
    // 1. Enforce sliding-window rate limiting (prevents booking spam / DoS)
    const rateLimitRes = enforceRateLimit(request, RATE_LIMIT_PROFILES.BOOKING_SUBMIT);
    if (rateLimitRes) return rateLimitRes;

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
    }

    // 2. Strict Zod input validation & sanitization (XSS, SQLi, E.164 phone, UUID, date refinement)
    const parsed = BookingSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || 'Invalid booking details submitted.',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const validData = parsed.data;
    const {
      villaId,
      fullName,
      phone,
      email,
      specialRequests,
      adults,
      children,
      extraGuests,
      paxCount,
      selectedBasePaxTier,
      includeOvernight,
      overnightPaxCount,
      checkInDate,
      checkOutDate,
      eventDate,
      timeSlot,
      packageOption,
      paymentMode,
      paymentGateway,
      paymentChannel,
      accountName,
      referenceNumber,
      receiptFilePath,
      idFilePath,
    } = validData;

    // Resolve normalized startDate and endDate
    let startDate = checkInDate || '';
    let endDate = checkOutDate || '';

    if (!startDate && eventDate) {
      const dateParts = eventDate.split(' to ').map((s) => s.trim());
      startDate = dateParts[0];
      endDate = dateParts[1] || startDate;
    } else if (startDate && !endDate) {
      endDate = startDate;
    }

    const normalizedSlot: TimeSlot = String(timeSlot).toLowerCase().includes('day')
      ? 'day'
      : 'evening';
    const normalizedPackage: PackageOption =
      packageOption === 'accommodation_only'
        ? 'accommodation_only'
        : packageOption === 'venue_only' || packageOption === 'without_catering'
        ? 'venue_only'
        : 'with_catering';

    const supabase = await createClient();

    // 3. Verify Admin Session if Walk-In Cash Gateway is requested
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();

    if (paymentGateway === 'cash' && !adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Only an authenticated admin can record walk-in cash bookings.' },
        { status: 403 }
      );
    }

    // 4. Server-side date/slot conflict check (uses non-PII RPC with fallback)
    const { data: rpcSlots, error: rpcSlotErr } = await supabase.rpc('get_villa_booked_slots', {
      p_villa_id: villaId,
    });

    let activeBookings: Array<{
      event_date: string;
      end_date: string | null;
      slot_assignment: string;
      package_option: string;
    }> = [];

    if (!rpcSlotErr && Array.isArray(rpcSlots)) {
      activeBookings = rpcSlots;
    } else {
      const { data: fallbackBookings } = await supabase
        .from('bookings')
        .select('event_date, end_date, slot_assignment, package_option')
        .eq('villa_id', villaId)
        .in('status', ['pending_verification', 'confirmed']);
      activeBookings = fallbackBookings || [];
    }

    const isAccommodation = normalizedPackage === 'accommodation_only';
    const reqStart = new Date(`${startDate}T00:00:00Z`);
    const reqEnd = new Date(`${endDate}T00:00:00Z`);

    const hasConflict = activeBookings.some((b) => {
      if (!b.event_date) return false;
      const bStart = new Date(`${b.event_date}T00:00:00Z`);
      const bEnd = new Date(`${b.end_date || b.event_date}T00:00:00Z`);

      if (isAccommodation || b.package_option === 'accommodation_only') {
        const reqLastNight =
          reqEnd > reqStart ? new Date(reqEnd.getTime() - 86400000) : reqStart;
        const bLastNight = bEnd > bStart ? new Date(bEnd.getTime() - 86400000) : bStart;
        return reqStart <= bLastNight && bStart <= reqLastNight;
      }

      return b.event_date === startDate && b.slot_assignment === normalizedSlot;
    });

    if (hasConflict) {
      return NextResponse.json(
        {
          error:
            'Sorry, this date and time slot was just booked by someone else. Please select another date or slot.',
        },
        { status: 409 }
      );
    }

    // 5. Authoritative Backend Price Calculation (NEVER trust client totalPrice or deposit!)
    const totalRequestedGuests =
      paxCount !== undefined
        ? Number(paxCount)
        : Number(adults || 1) + Number(children || 0) + Number(extraGuests || 0);

    const pricing = await computeAuthoritativeBookingPrice(supabase, {
      villaId,
      packageOption: normalizedPackage,
      startDate,
      endDate,
      timeSlot: normalizedSlot,
      paxCount: totalRequestedGuests,
      selectedBasePaxTier,
      extraGuests: rawBody.extraGuests !== undefined ? Number(extraGuests) : undefined,
      includeOvernight,
      overnightPaxCount,
    });

    const authoritativeTotal = pricing.totalPrice;
    const minDepositPercent = pricing.minDepositPercent;
    const requiredDepositAmount = pricing.requiredDepositAmount;

    // 6. Compute Authoritative Payment Amounts on the Server
    const resolvedGateway = paymentGateway || 'manual';
    const resolvedMode = paymentMode === 'full' ? 'full' : 'half';

    let finalAmountPaid =
      resolvedMode === 'full' ? authoritativeTotal : requiredDepositAmount;

    // Only allow custom walk-in amount if authenticated admin explicitly submitted it
    if (
      adminUser &&
      resolvedGateway === 'cash' &&
      typeof rawBody.amountPaid === 'number' &&
      rawBody.amountPaid >= 0 &&
      rawBody.amountPaid <= authoritativeTotal
    ) {
      finalAmountPaid = Number(rawBody.amountPaid);
    }

    const finalRemainingBalance = Math.max(0, authoritativeTotal - finalAmountPaid);

    // 7. Catering Deadline & Status Calculation
    const isCatering = normalizedPackage === 'with_catering';
    const cateringReqAmount = pricing.cateringRequiredAmount;
    const cateringDeadlineDate = pricing.cateringDeadlineDate;

    const cateringStatus = isCatering
      ? resolvedGateway === 'cash' && adminUser && finalAmountPaid >= cateringReqAmount
        ? 'confirmed'
        : 'pending_payment'
      : 'not_applicable';

    // Generate cryptographically random UUID & non-sequential guest token (prevents IDOR enumeration)
    const bookingId = crypto.randomUUID();
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const guestId = `JOY-${(randomBytes[0] % 900000 + 100000).toString()}`;

    const initialStatus =
      resolvedGateway === 'cash' && adminUser ? 'confirmed' : 'pending_verification';

    const resolvedReference =
      referenceNumber ||
      (resolvedGateway === 'cash' ? `CASH-${guestId}` : `PENDING-${guestId}`);

    const bookingPayload = {
      id: bookingId,
      villa_id: villaId,
      guest_id: guestId,
      customer_name: fullName,
      customer_phone: phone,
      email: email || null,
      event_date: startDate,
      end_date: endDate,
      slot_assignment: normalizedSlot,
      pax_count: pricing.resolvedPaxCount,
      package_option: normalizedPackage,
      include_overnight: Boolean(includeOvernight && normalizedSlot === 'evening'),
      overnight_pax_count: Boolean(includeOvernight && normalizedSlot === 'evening')
        ? Number(overnightPaxCount || 0)
        : 0,
      total_price: authoritativeTotal,
      payment_mode: resolvedMode,
      payment_gateway: resolvedGateway,
      payment_channel: paymentChannel || resolvedGateway,
      amount_paid: finalAmountPaid,
      remaining_balance: finalRemainingBalance,
      required_deposit_percent: minDepositPercent,
      required_deposit_amount: requiredDepositAmount,
      account_name: accountName || fullName,
      reference_number: resolvedReference,
      receipt_file_path: receiptFilePath || null,
      id_file_path: idFilePath || null,
      catering_status: cateringStatus,
      catering_required_amount: cateringReqAmount,
      catering_deadline_date: cateringDeadlineDate,
      status: initialStatus,
    };

    // 8. Persist Booking Atomically via SECURITY DEFINER RPC (with direct INSERT fallback)
    let createdBooking: any = null;

    const { data: rpcBooking, error: rpcBookingErr } = await supabase.rpc(
      'create_secure_booking',
      { p_payload: bookingPayload }
    );

    if (!rpcBookingErr && rpcBooking) {
      createdBooking = rpcBooking;
    } else {
      // IMPORTANT: Do NOT chain `.select(...)` onto `.insert(...)` for `anon` requests!
      // In PostgreSQL/PostgREST, `.insert().select()` executes `INSERT ... RETURNING *`,
      // which requires a `FOR SELECT` RLS policy on `public.bookings`. Since `anon` has
      // INSERT-only access on `bookings` (to protect other guests' PII), we pre-generate
      // `id: bookingId` on the server and perform a pure INSERT without RETURNING.
      let { error: insertError } = await supabase.from('bookings').insert([bookingPayload]);

      if (insertError) {
        console.warn('Primary booking insert failed, retrying with core columns:', insertError);
        const corePayload = {
          id: bookingId,
          villa_id: villaId,
          guest_id: guestId,
          customer_name: fullName,
          customer_phone: phone,
          email: email || null,
          event_date: startDate,
          end_date: endDate,
          slot_assignment: normalizedSlot,
          pax_count: pricing.resolvedPaxCount,
          package_option: normalizedPackage,
          include_overnight: Boolean(includeOvernight && normalizedSlot === 'evening'),
          overnight_pax_count: Boolean(includeOvernight && normalizedSlot === 'evening')
            ? Number(overnightPaxCount || 0)
            : 0,
          total_price: authoritativeTotal,
          payment_mode: resolvedMode,
          amount_paid: finalAmountPaid,
          remaining_balance: finalRemainingBalance,
          account_name: accountName || fullName,
          reference_number: resolvedReference,
          receipt_file_path: receiptFilePath || null,
          id_file_path: idFilePath || null,
          status: initialStatus,
        };
        const retryRes = await supabase.from('bookings').insert([corePayload]);
        insertError = retryRes.error;
      }

      if (insertError) {
        console.error('Failed to save booking:', insertError);
        return NextResponse.json(
          {
            error: `Could not save your booking (${insertError.message || 'Database policy error'}). Please ensure the latest RLS SQL migration has been executed.`,
          },
          { status: 500 }
        );
      }

      createdBooking = {
        ...bookingPayload,
        created_at: new Date().toISOString(),
        villas: {
          name: pricing.villaName,
          address: pricing.villaAddress,
        },
      };

      if (resolvedGateway === 'manual' || resolvedGateway === 'cash') {
        await supabase.from('payment_transactions').insert([
          {
            booking_id: createdBooking.id,
            phase: resolvedMode === 'full' ? 'full_payment' : 'downpayment',
            payment_gateway: resolvedGateway,
            payment_channel: paymentChannel || resolvedGateway,
            amount: finalAmountPaid,
            status: resolvedGateway === 'cash' && adminUser ? 'paid' : 'pending',
            account_name: accountName || fullName,
            reference_number: bookingPayload.reference_number,
            receipt_file_path: receiptFilePath || null,
            notes:
              resolvedGateway === 'cash'
                ? `Walk-in cash payment collected by admin${specialRequests ? ` (${specialRequests})` : ''}`
                : `Initial manual transfer submitted by customer${specialRequests ? ` (${specialRequests})` : ''}`,
          },
        ]);
      }
    }

    // 9. Dispatch SMS (Textbee) + Email (Resend) notifications for Manual & Cash bookings
    // (PayMongo online bookings send their receipt upon verified webhook completion)
    if (resolvedGateway !== 'paymongo') {
      await dispatchBookingNotifications({
        bookingId: createdBooking.id,
        guestId: createdBooking.guest_id,
        eventType: resolvedGateway === 'cash' ? 'payment_verified' : 'new_booking',
        customerName: fullName,
        customerPhone: phone,
        customerEmail: email || null,
        villaName: pricing.villaName,
        villaAddress: pricing.villaAddress,
        eventDate: startDate,
        endDate,
        slotAssignment: normalizedSlot,
        packageOption: normalizedPackage,
        paxCount: pricing.resolvedPaxCount,
        includeOvernight: Boolean(includeOvernight && normalizedSlot === 'evening'),
        overnightPaxCount: Number(overnightPaxCount || 0),
        totalPrice: authoritativeTotal,
        amountPaid: finalAmountPaid,
        remainingBalance: finalRemainingBalance,
        requiredDepositPercent: minDepositPercent,
        requiredDepositAmount,
        paymentGateway: resolvedGateway,
        paymentChannel: paymentChannel || resolvedGateway,
        paymentMode: resolvedMode,
        accountName: accountName || fullName,
        referenceNumber: createdBooking.reference_number,
        status: createdBooking.status,
        cateringStatus,
        cateringRequiredAmount: cateringReqAmount,
        cateringDeadlineDate,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Your booking has been submitted.',
        booking: createdBooking,
        pricing: {
          totalPrice: authoritativeTotal,
          minDepositPercent,
          requiredDepositAmount,
          amountPaid: finalAmountPaid,
          remainingBalance: finalRemainingBalance,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Booking confirm error:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred while processing your booking.' },
      { status: 500 }
    );
  }
}