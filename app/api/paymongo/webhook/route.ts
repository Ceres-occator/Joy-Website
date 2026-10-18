import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

/**
 * Maximum allowed clock skew / replay window for PayMongo webhook timestamps (5 minutes).
 */
const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * First-layer in-memory idempotency cache for duplicate webhook deliveries within the same process.
 * Persistent idempotency is enforced in PostgreSQL via `confirm_paymongo_payment_idempotent`
 * and `payment_transactions` status checks.
 */
const processedWebhookKeys = new Set<string>();

/**
 * Constant-time comparison of two SHA-256 hex digests using `crypto.timingSafeEqual`.
 */
function timingSafeHexEqual(expectedHex: string, candidateHex: string | undefined): boolean {
  if (!candidateHex) return false;
  const cleanCandidate = candidateHex.trim().toLowerCase();
  const cleanExpected = expectedHex.trim().toLowerCase();

  // SHA-256 hex digest is strictly 64 hex characters (32 bytes)
  if (
    cleanCandidate.length !== 64 ||
    cleanExpected.length !== 64 ||
    !/^[0-9a-f]{64}$/.test(cleanCandidate)
  ) {
    return false;
  }

  const expectedBuf = Buffer.from(cleanExpected, 'hex');
  const candidateBuf = Buffer.from(cleanCandidate, 'hex');
  if (expectedBuf.length !== candidateBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
}

/**
 * Strictly verifies PayMongo's `Paymongo-Signature` header (`t=...,te=...,li=...`)
 * using HMAC-SHA256 with `process.env.PAYMONGO_WEBHOOK_SECRET`.
 *
 * Rejects any request missing the secret, missing the header, outside the timestamp
 * tolerance window, or failing constant-time HMAC verification.
 */
export function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined
): { valid: boolean; reason?: string } {
  if (!webhookSecret || webhookSecret.trim().length === 0) {
    return {
      valid: false,
      reason: 'PAYMONGO_WEBHOOK_SECRET is not configured on the server.',
    };
  }

  if (!signatureHeader || signatureHeader.trim().length === 0) {
    return {
      valid: false,
      reason: 'Missing Paymongo-Signature header.',
    };
  }

  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k && v) acc[k] = v;
    }
    return acc;
  }, {} as Record<string, string>);

  const timestampStr = parts.t;
  const testSignature = parts.te;
  const liveSignature = parts.li;

  if (!timestampStr || (!testSignature && !liveSignature)) {
    return {
      valid: false,
      reason: 'Malformed Paymongo-Signature header (missing timestamp or signature digest).',
    };
  }

  const timestampSec = Number(timestampStr);
  if (!Number.isFinite(timestampSec) || timestampSec <= 0) {
    return {
      valid: false,
      reason: 'Invalid timestamp in Paymongo-Signature header.',
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > WEBHOOK_TOLERANCE_SECONDS) {
    return {
      valid: false,
      reason: 'PayMongo webhook timestamp is outside the allowed tolerance window.',
    };
  }

  const signedPayload = `${timestampStr}.${rawBody}`;
  const expectedHmac = crypto
    .createHmac('sha256', webhookSecret.trim())
    .update(signedPayload, 'utf8')
    .digest('hex');

  const isTestValid = timingSafeHexEqual(expectedHmac, testSignature);
  const isLiveValid = timingSafeHexEqual(expectedHmac, liveSignature);

  if (!isTestValid && !isLiveValid) {
    return {
      valid: false,
      reason: 'Cryptographic signature mismatch.',
    };
  }

  return { valid: true };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('paymongo-signature');
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // 1. Strict Cryptographic Webhook Verification (Reject unverified requests immediately)
    const verification = verifyPaymongoSignature(rawBody, signatureHeader, webhookSecret);
    if (!verification.valid) {
      console.error('[PayMongo Webhook] Rejected unverified request:', verification.reason);
      return NextResponse.json(
        { error: `Unauthorized webhook request: ${verification.reason}` },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventId: string | undefined = event?.data?.id;
    const eventType: string = event?.data?.attributes?.type || '';
    const resource = event?.data?.attributes?.data;

    // Acknowledge non-payment events without error
    if (
      eventType !== 'checkout_session.payment.paid' &&
      eventType !== 'payment.paid'
    ) {
      return NextResponse.json({ received: true, ignored: eventType });
    }

    const resourceId: string | undefined = resource?.id;
    const attributes = resource?.attributes || {};
    const metadata = attributes?.metadata || {};

    const bookingId: string | null =
      metadata?.booking_id && /^[0-9a-fA-F-]{36}$/.test(String(metadata.booking_id))
        ? String(metadata.booking_id)
        : null;
    const phase: string = metadata?.phase || 'downpayment';

    // Extract payment details from Checkout Session or Payment resource
    const payments = attributes?.payments || [];
    const firstPayment = payments[0]?.attributes || attributes;
    const paymentId: string = payments[0]?.id || resourceId || '';
    const checkoutSessionId: string | null =
      eventType === 'checkout_session.payment.paid' && resourceId ? resourceId : null;

    const sourceType: string =
      firstPayment?.source?.type ||
      attributes?.payment_method_used ||
      metadata?.preferred_channel ||
      'paymongo';

    const rawAmountCentavos =
      firstPayment?.amount ||
      attributes?.amount ||
      attributes?.line_items?.[0]?.amount ||
      0;
    const paidAmountPhp =
      rawAmountCentavos > 0
        ? Number(rawAmountCentavos) / 100
        : Number(metadata?.amount_php || 0);

    // 2. First-layer in-memory idempotency guard
    const idempotencyKey = `${bookingId || checkoutSessionId}:${paymentId}`;
    if (
      (eventId && processedWebhookKeys.has(`evt:${eventId}`)) ||
      (paymentId && processedWebhookKeys.has(`pay:${idempotencyKey}`))
    ) {
      return NextResponse.json({ received: true, idempotent: true });
    }

    const supabase = await createClient();

    // 3. Persistent Database-Level Idempotent Settlement via SECURITY DEFINER RPC
    const { data: rpcResult, error: rpcErr } = await supabase.rpc(
      'confirm_paymongo_payment_idempotent',
      {
        p_booking_id: bookingId,
        p_checkout_id: checkoutSessionId,
        p_payment_id: paymentId || null,
        p_source_type: sourceType,
        p_paid_amount: paidAmountPhp,
        p_phase: phase,
      }
    );

    let updatedBooking: any = null;
    let alreadyProcessed = false;

    if (!rpcErr && rpcResult && rpcResult.found) {
      alreadyProcessed = Boolean(rpcResult.already_processed);
      updatedBooking = rpcResult.booking;
    } else {
      // Fallback if the RPC migration has not yet been applied
      let bookingQuery = supabase.from('bookings').select('*, villas(name, address)');
      if (bookingId) {
        bookingQuery = bookingQuery.eq('id', bookingId);
      } else if (checkoutSessionId) {
        bookingQuery = bookingQuery.eq('paymongo_checkout_id', checkoutSessionId);
      } else {
        return NextResponse.json({ received: true, note: 'No booking reference found' });
      }

      const { data: booking } = await bookingQuery.maybeSingle();
      if (!booking) {
        return NextResponse.json({ received: true, note: 'Booking record not found' });
      }

      // Check both booking.paymongo_payment_id AND payment_transactions for idempotency
      if (paymentId && booking.paymongo_payment_id === paymentId && booking.status === 'confirmed') {
        alreadyProcessed = true;
        updatedBooking = booking;
      } else {
        const { data: existingTx } = await supabase
          .from('payment_transactions')
          .select('id, status')
          .eq('booking_id', booking.id)
          .eq('status', 'paid')
          .or(
            [
              paymentId ? `paymongo_payment_id.eq.${paymentId}` : '',
              checkoutSessionId ? `paymongo_checkout_id.eq.${checkoutSessionId}` : '',
            ]
              .filter(Boolean)
              .join(',')
          )
          .limit(1);

        if (existingTx && existingTx.length > 0) {
          alreadyProcessed = true;
          updatedBooking = booking;
        } else {
          const isInitialCheckout =
            booking.status === 'pending_verification' &&
            (phase === 'downpayment' || phase === 'full_payment');

          const newAmountPaid = isInitialCheckout
            ? Math.max(Number(booking.amount_paid || 0), paidAmountPhp)
            : Number(booking.amount_paid || 0) + paidAmountPhp;

          const totalCost = Number(booking.total_price || 0);
          const newRemainingBalance = Math.max(0, totalCost - newAmountPaid);
          const cateringReq = Number(booking.catering_required_amount || 10000);
          const updatedCateringStatus =
            booking.package_option === 'with_catering'
              ? newAmountPaid >= cateringReq
                ? 'confirmed'
                : booking.catering_status || 'pending_payment'
              : 'not_applicable';

          const { data: directUpdated } = await supabase
            .from('bookings')
            .update({
              status: 'confirmed',
              payment_gateway: 'paymongo',
              payment_channel: sourceType,
              paymongo_payment_id: paymentId,
              reference_number: paymentId || booking.reference_number,
              amount_paid: newAmountPaid,
              remaining_balance: newRemainingBalance,
              payment_mode: newRemainingBalance <= 0 ? 'full' : 'half',
              catering_status: updatedCateringStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.id)
            .select('*, villas(name, address)')
            .single();

          updatedBooking = directUpdated || booking;

          if (checkoutSessionId) {
            await supabase
              .from('payment_transactions')
              .update({
                status: 'paid',
                payment_channel: sourceType,
                paymongo_payment_id: paymentId,
                reference_number: paymentId,
                notes: `Verified via PayMongo Webhook (${sourceType})`,
                updated_at: new Date().toISOString(),
              })
              .eq('booking_id', booking.id)
              .eq('paymongo_checkout_id', checkoutSessionId);
          }
        }
      }
    }

    if (eventId) processedWebhookKeys.add(`evt:${eventId}`);
    if (paymentId) processedWebhookKeys.add(`pay:${idempotencyKey}`);

    // If this payment was already processed earlier, return 200 immediately without sending duplicate SMS/Email!
    if (alreadyProcessed || !updatedBooking) {
      return NextResponse.json({
        received: true,
        idempotent: true,
        bookingId: updatedBooking?.id || bookingId,
      });
    }

    // 4. Send Official Receipt & Admin Alert via SMS (Textbee) and Email (Resend) exactly once
    await dispatchBookingNotifications({
      bookingId: updatedBooking.id,
      guestId: updatedBooking.guest_id,
      eventType: phase === 'downpayment' || phase === 'full_payment' ? 'payment_verified' : 'booking_updated',
      customerName: updatedBooking.customer_name,
      customerPhone: updatedBooking.customer_phone,
      customerEmail: updatedBooking.email,
      villaName: updatedBooking.villas?.name || 'Joy Events Venue',
      villaAddress: updatedBooking.villas?.address,
      eventDate: updatedBooking.event_date,
      endDate: updatedBooking.end_date,
      slotAssignment: updatedBooking.slot_assignment,
      packageOption: updatedBooking.package_option,
      paxCount: Number(updatedBooking.pax_count || 1),
      includeOvernight: Boolean(updatedBooking.include_overnight),
      overnightPaxCount: Number(updatedBooking.overnight_pax_count || 0),
      totalPrice: Number(updatedBooking.total_price || 0),
      amountPaid: Number(updatedBooking.amount_paid || 0),
      remainingBalance: Number(updatedBooking.remaining_balance || 0),
      requiredDepositPercent: Number(updatedBooking.required_deposit_percent || 50),
      requiredDepositAmount: Number(updatedBooking.required_deposit_amount || 0),
      paymentGateway: 'paymongo',
      paymentChannel: sourceType,
      paymentMode: updatedBooking.payment_mode,
      accountName: updatedBooking.account_name || updatedBooking.customer_name,
      referenceNumber: paymentId || updatedBooking.reference_number,
      status: updatedBooking.status,
      cateringStatus: updatedBooking.catering_status,
      cateringRequiredAmount: Number(updatedBooking.catering_required_amount || 0),
      cateringDeadlineDate: updatedBooking.catering_deadline_date,
    });

    return NextResponse.json({
      received: true,
      idempotent: false,
      bookingId: updatedBooking.id,
      status: updatedBooking.status,
    });
  } catch (err: any) {
    console.error('[PayMongo Webhook] Error processing event:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
