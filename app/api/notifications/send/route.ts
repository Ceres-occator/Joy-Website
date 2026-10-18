import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/utils/supabase/server';
import {
  dispatchBookingNotifications,
  sendTextbeeSms,
  sendResendEmail,
  BookingNotificationPayload,
} from '@/utils/notifications';
import { enforceRateLimit, RATE_LIMIT_PROFILES } from '@/utils/rateLimit';
import { NO_HTML_REGEX } from '@/schema/booking';

const NotificationRequestSchema = z.object({
  bookingId: z.string().trim().uuid().optional(),
  eventType: z
    .enum([
      'new_booking',
      'booking_updated',
      'payment_verified',
      'catering_deadline',
      'cancellation_update',
      'refund_update',
    ])
    .optional(),
  directSms: z
    .object({
      recipient: z.string().trim().min(7).max(20),
      message: z.string().trim().min(1).max(1600).regex(NO_HTML_REGEX),
    })
    .optional(),
  directEmail: z
    .object({
      to: z.string().trim().email(),
      subject: z.string().trim().min(1).max(200).regex(NO_HTML_REGEX),
      html: z.string().optional(),
      text: z.string().trim().max(5000).optional(),
    })
    .optional(),
});

/**
 * Protected Next.js API Route for sending SMS (Textbee.dev) & Email (Resend) notifications.
 * Enforces:
 * 1. Sliding-window rate limiting (`RATE_LIMIT_PROFILES.NOTIFICATION_SEND`)
 * 2. Strict Admin Authentication (`requireAdminUser()`)
 * 3. Zod input validation
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting (prevents SMS/Email API credit exhaustion)
    const rateLimitRes = enforceRateLimit(req, RATE_LIMIT_PROFILES.NOTIFICATION_SEND);
    if (rateLimitRes) return rateLimitRes;

    // 2. Require Authenticated Admin Session
    const { supabase, unauthorizedResponse } = await requireAdminUser();
    if (unauthorizedResponse) return unauthorizedResponse;

    const rawBody = await req.json().catch(() => null);
    const parsed = NotificationRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'Invalid notification request payload.',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Direct ad-hoc SMS test or custom alert (Admin only)
    if (body.directSms) {
      const { recipient, message } = body.directSms;
      const smsRes = await sendTextbeeSms(recipient, message);
      return NextResponse.json({
        success: smsRes.ok,
        provider: 'textbee',
        response: smsRes.response,
      });
    }

    // Direct ad-hoc Email test (Admin only)
    if (body.directEmail) {
      const { to, subject, html, text } = body.directEmail;
      const emailRes = await sendResendEmail(to, subject, html || text || '', text || '');
      return NextResponse.json({
        success: emailRes.ok,
        provider: 'resend',
        response: emailRes.response,
      });
    }

    // Booking-based receipt & notification dispatch
    if (body.bookingId) {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*, villas(name, address)')
        .eq('id', body.bookingId)
        .maybeSingle();

      if (error || !booking) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const payload: BookingNotificationPayload = {
        bookingId: booking.id,
        guestId: booking.guest_id,
        eventType: body.eventType || 'booking_updated',
        customerName: booking.customer_name,
        customerPhone: booking.customer_phone,
        customerEmail: booking.email,
        villaName: booking.villas?.name || 'Joy Events Venue',
        villaAddress: booking.villas?.address,
        eventDate: booking.event_date,
        endDate: booking.end_date,
        slotAssignment: booking.slot_assignment,
        packageOption: booking.package_option,
        paxCount: Number(booking.pax_count || 1),
        includeOvernight: Boolean(booking.include_overnight),
        overnightPaxCount: Number(booking.overnight_pax_count || 0),
        totalPrice: Number(booking.total_price || 0),
        amountPaid: Number(booking.amount_paid || 0),
        remainingBalance: Number(booking.remaining_balance || 0),
        requiredDepositPercent: Number(booking.required_deposit_percent || 50),
        requiredDepositAmount: Number(booking.required_deposit_amount || 0),
        paymentGateway: booking.payment_gateway,
        paymentChannel: booking.payment_channel,
        paymentMode: booking.payment_mode,
        accountName: booking.account_name,
        referenceNumber: booking.reference_number,
        status: booking.status,
        cateringStatus: booking.catering_status,
        cateringRequiredAmount: Number(booking.catering_required_amount || 0),
        cateringDeadlineDate: booking.catering_deadline_date,
        isForfeited: Boolean(booking.is_forfeited),
        forfeitureReason: booking.forfeiture_reason,
        refundStatus: booking.refund_status,
        refundAmount: Number(booking.refund_amount || 0),
        notes: booking.notes,
      };

      const dispatchResult = await dispatchBookingNotifications(payload);

      return NextResponse.json({
        success: true,
        results: dispatchResult,
      });
    }

    return NextResponse.json(
      { error: 'Provide bookingId, directSms, or directEmail.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Notification API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send notifications.' },
      { status: 500 }
    );
  }
}
