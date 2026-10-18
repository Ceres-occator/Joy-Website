import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  GuestLookupSchema,
  NO_HTML_REGEX,
  E164_PHONE_REGEX,
  normalizeToE164,
  optionalEmailSchema,
  ISO_DATE_REGEX,
} from '@/schema/booking';
import { enforceRateLimit, RATE_LIMIT_PROFILES } from '@/utils/rateLimit';
import { computeAuthoritativeBookingPrice } from '@/utils/serverPricing';
import type { PackageOption, TimeSlot } from '@/types';

const ChangeRequestSchema = z.object({
  action: z.literal('change_request'),
  bookingId: z.string().trim().uuid('Valid Booking UUID is required.'),
  guestId: z.string().trim().min(4).max(32),
  villaId: z.string().trim().uuid().optional(),
  customerName: z.string().trim().min(2).max(120).regex(NO_HTML_REGEX),
  customerPhone: z.preprocess(
    normalizeToE164,
    z.string().regex(E164_PHONE_REGEX, 'Phone number must be in E.164 format (+63...).')
  ),
  email: optionalEmailSchema,
  eventDate: z.string().trim().regex(ISO_DATE_REGEX),
  slotAssignment: z.enum(['day', 'evening']),
  paxCount: z.coerce.number().int().min(1).max(500),
  packageOption: z.enum(['with_catering', 'venue_only', 'without_catering', 'accommodation_only']),
});

const ManualInstallmentSchema = z.object({
  action: z.literal('manual_installment'),
  bookingId: z.string().trim().uuid('Valid Booking UUID is required.'),
  guestId: z.string().trim().min(4).max(32),
  channel: z.string().trim().min(1).max(60).regex(NO_HTML_REGEX),
  amount: z.coerce.number().positive('Installment amount must be greater than 0.').max(10_000_000),
  accountName: z.string().trim().min(2).max(120).regex(NO_HTML_REGEX),
  referenceNumber: z.string().trim().min(4).max(120).regex(NO_HTML_REGEX),
  receiptFilePath: z.string().trim().min(3).max(300).regex(/^[a-zA-Z0-9/_.-]+$/),
});

const CancellationRequestSchema = z.object({
  action: z.literal('cancellation_request'),
  bookingId: z.string().trim().uuid('Valid Booking UUID is required.'),
  guestId: z.string().trim().min(4).max(32),
  summary: z.string().trim().min(3).max(500).regex(NO_HTML_REGEX),
});

async function fetchVerifiedBooking(
  supabase: any,
  bookingId: string | undefined,
  guestId: string
): Promise<any | null> {
  const cleanGuestId = guestId.trim().replace(/^#/, '').toUpperCase();

  const { data: rpcBooking, error: rpcErr } = await supabase.rpc('get_booking_secure', {
    p_booking_id: bookingId || null,
    p_guest_id: cleanGuestId,
  });

  if (!rpcErr && rpcBooking) {
    return rpcBooking;
  }

  let query = supabase
    .from('bookings')
    .select(
      'id, guest_id, customer_name, customer_phone, email, event_date, end_date, total_price, amount_paid, remaining_balance, status, package_option, pax_count, slot_assignment, payment_gateway, payment_channel, catering_status, catering_required_amount, catering_deadline_date, is_forfeited, forfeiture_reason, refund_status, refund_amount, villas(name), villa_id'
    )
    .eq('guest_id', cleanGuestId);

  if (bookingId) {
    query = query.eq('id', bookingId);
  }

  const { data: directBooking } = await query.maybeSingle();
  return directBooking || null;
}

/**
 * IDOR-Protected & Rate-Limited Guest Booking Portal Endpoint (`/api/booking/lookup`).
 * Handles:
 *  - Booking lookup by Reference Code (`lookup`)
 *  - Pending booking edit requests (`change_request`) -> Requires Admin Approval in View History
 *  - Pending follow-up manual payments (`manual_installment`) -> Requires Admin Approval in View History
 *  - Pending cancellation requests (`cancellation_request`) -> Requires Admin Approval in View History
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimitRes = enforceRateLimit(req, RATE_LIMIT_PROFILES.BOOKING_LOOKUP_AND_QUOTE);
    if (rateLimitRes) return rateLimitRes;

    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
    }

    const supabase = await createClient();
    const action = rawBody.action || 'lookup';

    // 1. Guest Change Request (Requires matching UUID + guest_id token; queued for Admin Approval)
    if (action === 'change_request') {
      const parsed = ChangeRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid change request.' },
          { status: 400 }
        );
      }
      const data = parsed.data;

      const currentBooking = await fetchVerifiedBooking(supabase, data.bookingId, data.guestId);
      if (!currentBooking) {
        return NextResponse.json(
          { error: 'Booking verification failed for change request.' },
          { status: 403 }
        );
      }

      const resolvedVillaId = data.villaId || currentBooking.villa_id;
      const isDateChanged = currentBooking.event_date !== data.eventDate;
      const isSlotChanged = currentBooking.slot_assignment !== data.slotAssignment;

      // Only check date/slot availability if the guest actually changed the date or time slot!
      // Also exclude the guest's own booking so their existing reservation never conflicts with itself.
      if (resolvedVillaId && (isDateChanged || isSlotChanged)) {
        const { data: slots } = await supabase.rpc('get_villa_booked_slots', {
          p_villa_id: resolvedVillaId,
        });

        if (Array.isArray(slots)) {
          const isTargetAccommodation = data.packageOption === 'accommodation_only';
          let ignoredOwnSlotOnce = false;

          const conflict = slots.some((s: any) => {
            // Ignore this booking's own current date & slot
            if (s.id && String(s.id) === String(currentBooking.id)) {
              return false;
            }
            if (
              !ignoredOwnSlotOnce &&
              s.event_date === currentBooking.event_date &&
              s.slot_assignment === currentBooking.slot_assignment
            ) {
              ignoredOwnSlotOnce = true;
              return false;
            }

            return (
              s.event_date === data.eventDate &&
              (isTargetAccommodation ||
                s.package_option === 'accommodation_only' ||
                s.slot_assignment === data.slotAssignment)
            );
          });

          if (conflict) {
            return NextResponse.json(
              {
                error:
                  'Sorry, that date and time slot is already booked by another guest. Please pick another date or time slot.',
              },
              { status: 409 }
            );
          }
        }
      }

      const normalizedPkg: PackageOption =
        data.packageOption === 'accommodation_only'
          ? 'accommodation_only'
          : data.packageOption === 'venue_only' || data.packageOption === 'without_catering'
          ? 'venue_only'
          : 'with_catering';

      // Recompute authoritative price if schedule, package, or guest count changed
      let updatedTotalPrice = Number(currentBooking.total_price || 0);
      let updatedRemainingBalance = Number(currentBooking.remaining_balance || 0);

      if (
        resolvedVillaId &&
        (isDateChanged ||
          isSlotChanged ||
          Number(currentBooking.pax_count) !== Number(data.paxCount) ||
          currentBooking.package_option !== normalizedPkg)
      ) {
        try {
          const pricing = await computeAuthoritativeBookingPrice(supabase, {
            villaId: resolvedVillaId,
            packageOption: normalizedPkg,
            startDate: data.eventDate,
            endDate: data.eventDate,
            timeSlot: data.slotAssignment as TimeSlot,
            paxCount: data.paxCount,
          });
          if (pricing.totalPrice > 0) {
            updatedTotalPrice = pricing.totalPrice;
            updatedRemainingBalance = Math.max(
              0,
              updatedTotalPrice - Number(currentBooking.amount_paid || 0)
            );
          }
        } catch {
          // Keep existing price if pricing lookup is unavailable
        }
      }

      const proposedBefore = {
        customer_name: currentBooking.customer_name,
        customer_phone: currentBooking.customer_phone,
        email: currentBooking.email || null,
        event_date: currentBooking.event_date,
        slot_assignment: currentBooking.slot_assignment,
        pax_count: Number(currentBooking.pax_count),
        package_option: currentBooking.package_option,
        total_price: Number(currentBooking.total_price),
        remaining_balance: Number(currentBooking.remaining_balance),
      };

      const proposedAfter: Record<string, any> = {
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        email: data.email || null,
        event_date: data.eventDate,
        slot_assignment: data.slotAssignment,
        pax_count: data.paxCount,
        package_option: normalizedPkg,
        total_price: updatedTotalPrice,
        remaining_balance: updatedRemainingBalance,
      };

      const diffParts: string[] = [];
      if (proposedBefore.customer_name !== proposedAfter.customer_name) {
        diffParts.push(`Name (${proposedBefore.customer_name} → ${proposedAfter.customer_name})`);
      }
      if (proposedBefore.customer_phone !== proposedAfter.customer_phone) {
        diffParts.push(`Phone (${proposedBefore.customer_phone} → ${proposedAfter.customer_phone})`);
      }
      if ((proposedBefore.email || '') !== (proposedAfter.email || '')) {
        diffParts.push(`Email (${proposedBefore.email || 'none'} → ${proposedAfter.email || 'none'})`);
      }
      if (proposedBefore.event_date !== proposedAfter.event_date) {
        diffParts.push(`Date (${proposedBefore.event_date} → ${proposedAfter.event_date})`);
      }
      if (proposedBefore.slot_assignment !== proposedAfter.slot_assignment) {
        diffParts.push(`Slot (${proposedBefore.slot_assignment} → ${proposedAfter.slot_assignment})`);
      }
      if (proposedBefore.pax_count !== proposedAfter.pax_count) {
        diffParts.push(`Guests (${proposedBefore.pax_count} → ${proposedAfter.pax_count})`);
      }
      if (proposedBefore.package_option !== proposedAfter.package_option) {
        diffParts.push(`Package (${proposedBefore.package_option} → ${proposedAfter.package_option})`);
      }

      const summary =
        diffParts.length > 0
          ? `Requested changes: ${diffParts.join(', ')}`
          : `Requested booking update for ${data.customerName} (${data.eventDate}, ${data.slotAssignment}, ${data.paxCount} pax)`;

      const { data: ok, error: rpcErr } = await supabase.rpc('submit_guest_change_request', {
        p_booking_id: data.bookingId,
        p_guest_id: data.guestId,
        p_proposed_after: proposedAfter,
        p_summary: summary,
      });

      if (rpcErr) {
        const { error: approvalErr } = await supabase.from('booking_changes_approval').insert([
          {
            booking_id: data.bookingId,
            proposed_changes: { before: proposedBefore, after: proposedAfter },
            status: 'pending',
          },
        ]);
        const { error: historyErr } = await supabase.from('booking_audit_history').insert([
          {
            booking_id: data.bookingId,
            type: 'data_edit',
            status: 'pending_approval',
            summary,
          },
        ]);

        if (approvalErr && historyErr) {
          console.error('Failed to record change request:', approvalErr, historyErr);
          return NextResponse.json(
            {
              error:
                'Could not save your change request. Please ensure the latest Supabase RLS migration has been executed.',
            },
            { status: 500 }
          );
        }
      } else if (!ok) {
        return NextResponse.json(
          { error: 'Booking verification failed for change request.' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Change request submitted for admin approval.',
      });
    }

    // 2. Guest Manual Follow-Up Installment (Queued for Admin Approval in View History)
    if (action === 'manual_installment') {
      const parsed = ManualInstallmentSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid installment details.' },
          { status: 400 }
        );
      }
      const data = parsed.data;

      const { data: ok, error: rpcErr } = await supabase.rpc(
        'submit_guest_manual_installment',
        {
          p_booking_id: data.bookingId,
          p_guest_id: data.guestId,
          p_channel: data.channel,
          p_amount: data.amount,
          p_account_name: data.accountName,
          p_reference_number: data.referenceNumber,
          p_receipt_file_path: data.receiptFilePath,
        }
      );

      if (rpcErr) {
        const summaryText = `Follow-up payment of ₱${Number(data.amount).toLocaleString()} via ${data.channel.toUpperCase()} (Pending Admin Approval)`;

        const { error: histErr } = await supabase.from('booking_audit_history').insert([
          {
            booking_id: data.bookingId,
            type: 'payment_installment',
            status: 'pending_approval',
            amount_paid: data.amount,
            account_name: data.accountName,
            reference_number: data.referenceNumber,
            receipt_file_path: data.receiptFilePath,
            summary: summaryText,
          },
        ]);

        const { error: txErr } = await supabase.from('payment_transactions').insert([
          {
            booking_id: data.bookingId,
            phase: 'follow_up',
            payment_gateway: 'manual',
            payment_channel: data.channel,
            amount: data.amount,
            account_name: data.accountName,
            reference_number: data.referenceNumber,
            receipt_file_path: data.receiptFilePath,
            status: 'pending',
            notes: summaryText,
          },
        ]);

        if (histErr && txErr) {
          console.error('Failed to record manual installment:', histErr, txErr);
          return NextResponse.json(
            {
              error:
                'Could not save your follow-up payment. Please ensure the latest Supabase RLS migration has been executed.',
            },
            { status: 500 }
          );
        }
      } else if (!ok) {
        return NextResponse.json(
          { error: 'Booking verification failed for installment submission.' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Manual follow-up payment submitted for admin verification.',
      });
    }

    // 3. Guest Cancellation Request (Requires matching UUID + guest_id token)
    if (action === 'cancellation_request') {
      const parsed = CancellationRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid cancellation request.' },
          { status: 400 }
        );
      }
      const data = parsed.data;

      const { data: ok, error: rpcErr } = await supabase.rpc('submit_guest_change_request', {
        p_booking_id: data.bookingId,
        p_guest_id: data.guestId,
        p_proposed_after: { status: 'cancelled_request_pending' },
        p_summary: data.summary,
      });

      if (rpcErr) {
        await supabase.from('booking_changes_approval').insert([
          {
            booking_id: data.bookingId,
            proposed_changes: { after: { status: 'cancelled_request_pending' } },
            status: 'pending',
          },
        ]);
        await supabase.from('booking_audit_history').insert([
          {
            booking_id: data.bookingId,
            type: 'cancellation_request',
            status: 'pending_approval',
            summary: data.summary,
          },
        ]);
      } else if (!ok) {
        return NextResponse.json(
          { error: 'Booking verification failed for cancellation request.' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Cancellation request submitted for admin review.',
      });
    }

    // 4. Default Action: IDOR-Protected Booking Receipt Lookup by Guest Token / UUID
    const parsed = GuestLookupSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid booking reference code.' },
        { status: 400 }
      );
    }

    const booking = await fetchVerifiedBooking(
      supabase,
      parsed.data.bookingId || undefined,
      parsed.data.guestId
    );

    if (!booking) {
      return NextResponse.json(
        { error: 'No booking found with that Booking Reference Code.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      booking,
    });
  } catch (err: any) {
    console.error('Guest lookup API error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not look up your booking right now.' },
      { status: 500 }
    );
  }
}
