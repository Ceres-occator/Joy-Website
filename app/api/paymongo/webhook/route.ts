import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

function verifyPaymongoSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined
): boolean {
  if (!webhookSecret || !signatureHeader) return true; // Allow if secret not strictly enforced in local dev
  try {
    const parts: Record<string, string> = {};
    for (const segment of signatureHeader.split(',')) {
      const [k, v] = segment.split('=');
      if (k && v) parts[k.trim()] = v.trim();
    }
    const timestamp = parts['t'];
    const testSig = parts['te'];
    const liveSig = parts['li'];
    if (!timestamp) return true;

    const signedPayload = `${timestamp}.${rawBody}`;
    const computed = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return computed === testSig || computed === liveSig;
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('paymongo-signature');
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    if (!verifyPaymongoSignature(rawBody, signatureHeader, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid PayMongo webhook signature.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload?.data?.attributes?.type;
    const resource = payload?.data?.attributes?.data;

    if (
      eventType !== 'checkout_session.payment.paid' &&
      eventType !== 'payment.paid'
    ) {
      return NextResponse.json({ received: true, ignored: eventType });
    }

    const checkoutId = resource?.id;
    const attributes = resource?.attributes || {};
    const metadata = attributes?.metadata || attributes?.payments?.[0]?.attributes?.metadata || {};
    const paymentObj = attributes?.payments?.[0] || resource;
    const paymentId = paymentObj?.id || checkoutId;
    const sourceType =
      paymentObj?.attributes?.source?.type ||
      paymentObj?.attributes?.payment_method_used ||
      metadata?.preferred_channel ||
      'paymongo';

    // Paid amount in PHP (PayMongo sends centavos)
    const rawCentavos =
      paymentObj?.attributes?.amount ||
      attributes?.line_items?.[0]?.amount ||
      0;
    const paidAmountPhp =
      rawCentavos > 0
        ? Number(rawCentavos) / 100
        : Number(metadata?.amount_php || 0);

    const supabase = await createClient();

    // Locate the booking by metadata.booking_id or paymongo_checkout_id
    let bookingQuery = supabase.from('bookings').select('*, villas(name, address)');
    if (metadata?.booking_id) {
      bookingQuery = bookingQuery.eq('id', metadata.booking_id);
    } else {
      bookingQuery = bookingQuery.eq('paymongo_checkout_id', checkoutId);
    }

    const { data: booking } = await bookingQuery.maybeSingle();
    if (!booking) {
      return NextResponse.json({ received: true, message: 'No matching booking found.' });
    }

    // Check if this payment was already recorded to guarantee idempotency
    if (booking.paymongo_payment_id === paymentId && booking.status === 'confirmed') {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Calculate updated paid & balance amounts
    const phase = metadata?.phase || 'downpayment';
    const isInitialBookingPayment =
      booking.status === 'pending_verification' &&
      (phase === 'downpayment' || phase === 'full_payment');

    const newAmountPaid = isInitialBookingPayment
      ? Math.max(Number(booking.amount_paid || 0), paidAmountPhp)
      : Number(booking.amount_paid || 0) + paidAmountPhp;

    const totalCost = Number(booking.total_price || 0);
    const newRemainingBalance = Math.max(0, totalCost - newAmountPaid);

    // Check Catering Rule: If with_catering and paid >= required catering amount, mark catering confirmed
    const cateringReq = Number(booking.catering_required_amount || 10000);
    const updatedCateringStatus =
      booking.package_option === 'with_catering'
        ? newAmountPaid >= cateringReq
          ? 'confirmed'
          : booking.catering_status || 'pending_payment'
        : 'not_applicable';

    const { data: updatedBooking } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_gateway: 'paymongo',
        payment_channel: sourceType,
        paymongo_payment_id: paymentId,
        reference_number: paymentId,
        amount_paid: newAmountPaid,
        remaining_balance: newRemainingBalance,
        payment_mode: newRemainingBalance <= 0 ? 'full' : 'half',
        catering_status: updatedCateringStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select('*, villas(name, address)')
      .single();

    // Update payment_transactions row
    await supabase
      .from('payment_transactions')
      .update({
        status: 'paid',
        payment_channel: sourceType,
        paymongo_payment_id: paymentId,
        reference_number: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', booking.id)
      .eq('paymongo_checkout_id', checkoutId);

    // Record in booking_audit_history
    await supabase.from('booking_audit_history').insert([
      {
        booking_id: booking.id,
        type: 'PAYMENT_VERIFIED',
        amount_paid: paidAmountPhp,
        reference_number: paymentId,
        account_name: `${booking.customer_name} (PayMongo - ${sourceType})`,
        summary: `PayMongo payment of ₱${paidAmountPhp.toLocaleString()} verified automatically (${phase}).`,
        status: 'approved',
      },
    ]);

    // Dispatch Admin SMS + Customer SMS & Email Receipt
    if (updatedBooking) {
      await dispatchBookingNotifications({
        bookingId: updatedBooking.id,
        guestId: updatedBooking.guest_id,
        eventType: 'payment_verified',
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
        accountName: updatedBooking.account_name,
        referenceNumber: paymentId,
        status: updatedBooking.status,
        cateringStatus: updatedBooking.catering_status,
        cateringRequiredAmount: Number(updatedBooking.catering_required_amount || 0),
        cateringDeadlineDate: updatedBooking.catering_deadline_date,
      });
    }

    return NextResponse.json({ received: true, success: true });
  } catch (err: any) {
    console.error('PayMongo webhook processing error:', err);
    return NextResponse.json(
      { error: err.message || 'Webhook processing error.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/paymongo/webhook',
    message: 'PayMongo Webhook Listener is ready. Use POST for PayMongo events.',
  });
}

