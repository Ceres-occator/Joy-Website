import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const villaId = body.villaId || body.villa_id;
    const fullName = body.fullName || body.customer_name;
    const phone = body.phone || body.customer_phone;
    const email = (body.email || '').trim() || null;
    const eventDate = body.eventDate || body.event_date;
    const rawTimeSlot = String(body.timeSlot || body.slot_assignment || 'day').toLowerCase();
    const paxCount = Number(body.paxCount || body.pax_count || 1);
    const packageOption = body.packageOption || body.package_option || 'accommodation_only';

    const includeOvernight =
      body.includeOvernight !== undefined ? body.includeOvernight : body.include_overnight;
    const overnightPaxCount =
      body.overnightPaxCount !== undefined ? body.overnightPaxCount : body.overnight_pax_count;

    const totalPrice = Number(body.totalPrice || body.price || 0);
    const paymentMode = body.paymentMode || body.payment_mode || 'half';
    const paymentGateway: 'manual' | 'paymongo' | 'cash' =
      body.paymentGateway || body.payment_gateway || 'manual';
    const paymentChannel = body.paymentChannel || body.payment_channel || null;

    const referenceNumber =
      body.referenceNumber ||
      body.reference_number ||
      (paymentGateway === 'cash' ? `CASH-${Date.now().toString().slice(-6)}` : 'PENDING-ONLINE');
    const accountName = body.accountName || body.account_name || fullName;
    const receiptFilePath = body.receiptFilePath || body.receipt_file_path || null;
    const idFilePath = body.idFilePath || body.id_file_path || null;

    // Validate fields based on gateway
    if (!villaId || !eventDate || !fullName || !phone) {
      return NextResponse.json(
        { error: 'Please complete your name, phone number, venue, and reservation date.' },
        { status: 400 }
      );
    }

    if (
      paymentGateway === 'manual' &&
      (!referenceNumber || !accountName || !receiptFilePath || !idFilePath)
    ) {
      return NextResponse.json(
        {
          error:
            'For manual transfers, please enter the account name, reference number, and upload both your payment receipt and valid ID.',
        },
        { status: 400 }
      );
    }

    let parsedStartDate = eventDate;
    let parsedEndDate = body.endDate || body.end_date || eventDate;

    if (eventDate.includes(' to ')) {
      const [startPart, endPart] = eventDate.split(' to ');
      parsedStartDate = startPart.trim();
      parsedEndDate = endPart.trim();
    }

    if (new Date(parsedEndDate) < new Date(parsedStartDate)) {
      return NextResponse.json(
        { error: 'Check-out date must be after the check-in date.' },
        { status: 400 }
      );
    }

    const validatedSlot: 'day' | 'evening' = rawTimeSlot.includes('day') ? 'day' : 'evening';
    const isRequestedAccommodation = packageOption === 'accommodation_only';

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch per-villa minimum deposit and system catering/forfeiture rules
    const [{ data: villaRow }, { data: sysSettings }] = await Promise.all([
      supabase.from('villas').select('*').eq('id', villaId).maybeSingle(),
      supabase.from('system_settings').select('*').eq('id', 'default').maybeSingle(),
    ]);

    const minDepositPercent = Number(
      villaRow?.min_deposit_percent ??
        body.minDepositPercent ??
        sysSettings?.min_deposit_percent ??
        50
    );
    const cateringRuleAmount = Number(sysSettings?.catering_required_amount ?? 10000);
    const cateringDeadlineDays = Number(sysSettings?.catering_deadline_days ?? 7);

    // Check for date & time slot conflicts
    const { data: existingBookings, error: checkError } = await supabase
      .from('bookings')
      .select('id, event_date, end_date, slot_assignment, package_option')
      .eq('villa_id', villaId)
      .in('status', ['pending_verification', 'confirmed']);

    if (!checkError && existingBookings) {
      const requestedStart = new Date(`${parsedStartDate}T00:00:00Z`);
      const requestedEnd = new Date(`${parsedEndDate}T00:00:00Z`);

      const hasOverlapConflict = existingBookings.some((booking) => {
        const existingStart = new Date(`${booking.event_date}T00:00:00Z`);
        const existingEnd = new Date(`${booking.end_date || booking.event_date}T00:00:00Z`);

        const effectiveReqEnd =
          isRequestedAccommodation && requestedEnd > requestedStart
            ? new Date(requestedEnd.getTime() - 86400000)
            : requestedEnd;

        const isExistingAccommodation = booking.package_option === 'accommodation_only';
        const effectiveExistEnd =
          isExistingAccommodation && existingEnd > existingStart
            ? new Date(existingEnd.getTime() - 86400000)
            : existingEnd;

        const datesOverlap =
          requestedStart <= effectiveExistEnd && effectiveReqEnd >= existingStart;

        if (!datesOverlap) return false;
        if (isRequestedAccommodation || isExistingAccommodation) return true;
        return booking.slot_assignment === validatedSlot;
      });

      if (hasOverlapConflict) {
        return NextResponse.json(
          {
            error:
              'Sorry, the selected date and time slot is already booked or awaiting confirmation. Please choose another date or time slot.',
          },
          { status: 409 }
        );
      }
    }

    const requiredDepositAmount = Math.round(totalPrice * (minDepositPercent / 100));
    const finalAmountPaid =
      body.amountPaid !== undefined || body.amount_paid !== undefined
        ? Number(body.amountPaid ?? body.amount_paid)
        : paymentMode === 'full'
        ? totalPrice
        : requiredDepositAmount;
    const finalRemainingBalance =
      body.remainingBalance !== undefined || body.remaining_balance !== undefined
        ? Number(body.remainingBalance ?? body.remaining_balance)
        : Math.max(0, totalPrice - finalAmountPaid);

    // Compute Catering Deadline Rules if package_option === 'with_catering'
    const isCatering = packageOption === 'with_catering';
    let cateringDeadlineDate: string | null = null;
    if (isCatering) {
      const d = new Date(`${parsedStartDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - cateringDeadlineDays);
      cateringDeadlineDate = d.toISOString().split('T')[0];
    }

    const cateringStatus = isCatering
      ? finalAmountPaid >= cateringRuleAmount && paymentGateway === 'cash'
        ? 'confirmed'
        : 'pending_payment'
      : 'not_applicable';

    const initialStatus =
      paymentGateway === 'cash' ? 'confirmed' : 'pending_verification';

    const guestId = `GUEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          user_id: user?.id || null,
          villa_id: villaId,
          event_date: parsedStartDate,
          end_date: parsedEndDate,
          slot_assignment: validatedSlot,
          customer_name: fullName,
          customer_phone: phone,
          email,
          pax_count: paxCount,
          package_option: packageOption,
          include_overnight: includeOvernight === true || String(includeOvernight) === 'true',
          overnight_pax_count: Number(overnightPaxCount || 0),
          total_price: totalPrice,
          reference_number: referenceNumber,
          account_name: accountName,
          receipt_file_path: receiptFilePath,
          id_file_path: idFilePath,
          status: initialStatus,
          guest_id: guestId,
          payment_mode: paymentMode,
          payment_gateway: paymentGateway,
          payment_channel: paymentChannel || (paymentGateway === 'cash' ? 'cash' : null),
          amount_paid: finalAmountPaid,
          remaining_balance: finalRemainingBalance,
          required_deposit_percent: minDepositPercent,
          required_deposit_amount: requiredDepositAmount,
          catering_status: cateringStatus,
          catering_required_amount: isCatering ? cateringRuleAmount : 0,
          catering_deadline_date: cateringDeadlineDate,
        },
      ])
      .select('*, villas(name, address)');

    if (error) {
      console.error('Supabase Write Error:', error);
      return NextResponse.json(
        { error: `Could not save booking: ${error.message}` },
        { status: 400 }
      );
    }

    const createdBooking = data[0];

    // Record transaction in payment_transactions ledger (for manual & cash; paymongo creates its own in /api/paymongo/checkout)
    if (paymentGateway !== 'paymongo') {
      await supabase.from('payment_transactions').insert([
        {
          booking_id: createdBooking.id,
          phase: paymentMode === 'full' ? 'full_payment' : 'downpayment',
          payment_gateway: paymentGateway,
          payment_channel: paymentChannel || (paymentGateway === 'cash' ? 'cash' : 'manual_transfer'),
          amount: finalAmountPaid,
          account_name: accountName,
          reference_number: referenceNumber,
          receipt_file_path: receiptFilePath,
          status: paymentGateway === 'cash' ? 'verified' : 'pending',
          notes:
            paymentGateway === 'cash'
              ? 'Walk-in cash payment collected by admin'
              : 'Manual payment receipt uploaded by customer',
        },
      ]);

      // Send Admin SMS Alert + Customer SMS & Email Receipt immediately for Manual & Walk-In Cash
      await dispatchBookingNotifications({
        bookingId: createdBooking.id,
        guestId: createdBooking.guest_id,
        eventType: 'new_booking',
        customerName: createdBooking.customer_name,
        customerPhone: createdBooking.customer_phone,
        customerEmail: createdBooking.email,
        villaName: createdBooking.villas?.name || 'Joy Events Venue',
        villaAddress: createdBooking.villas?.address,
        eventDate: createdBooking.event_date,
        endDate: createdBooking.end_date,
        slotAssignment: createdBooking.slot_assignment,
        packageOption: createdBooking.package_option,
        paxCount: Number(createdBooking.pax_count || 1),
        includeOvernight: Boolean(createdBooking.include_overnight),
        overnightPaxCount: Number(createdBooking.overnight_pax_count || 0),
        totalPrice: Number(createdBooking.total_price || 0),
        amountPaid: Number(createdBooking.amount_paid || 0),
        remainingBalance: Number(createdBooking.remaining_balance || 0),
        requiredDepositPercent: minDepositPercent,
        requiredDepositAmount,
        paymentGateway,
        paymentChannel: createdBooking.payment_channel,
        paymentMode: createdBooking.payment_mode,
        accountName: createdBooking.account_name,
        referenceNumber: createdBooking.reference_number,
        status: createdBooking.status,
        cateringStatus: createdBooking.catering_status,
        cateringRequiredAmount: Number(createdBooking.catering_required_amount || 0),
        cateringDeadlineDate: createdBooking.catering_deadline_date,
        forfeitureDays: Number(sysSettings?.forfeiture_days ?? 7),
      });
    }

    return NextResponse.json({ success: true, booking: createdBooking });
  } catch (err: any) {
    console.error('Booking Confirm Error:', err);
    return NextResponse.json(
      { error: err.message || 'Something went wrong while submitting your booking.' },
      { status: 500 }
    );
  }
}