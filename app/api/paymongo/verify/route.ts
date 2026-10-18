import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'PayMongo secret key not configured.' }, { status: 400 });
    }

    const { bookingId } = await req.json();
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, villas(name, address)')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking || !booking.paymongo_checkout_id) {
      return NextResponse.json({ verified: false, message: 'No active PayMongo checkout session.' });
    }

    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
    const res = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${booking.paymongo_checkout_id}`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ verified: false });
    }

    const json = await res.json();
    const attrs = json?.data?.attributes || {};
    const payments = attrs?.payments || [];
    const paidPayment = payments.find(
      (p: any) => p?.attributes?.status === 'paid'
    );

    if (!paidPayment && attrs?.payment_intent?.attributes?.status !== 'succeeded') {
      return NextResponse.json({ verified: false, status: 'pending' });
    }

    const paymentId = paidPayment?.id || booking.paymongo_checkout_id;
    if (booking.paymongo_payment_id === paymentId && booking.status === 'confirmed') {
      return NextResponse.json({ verified: true, booking });
    }

    const sourceType =
      paidPayment?.attributes?.source?.type ||
      attrs?.payment_method_used ||
      booking.payment_channel ||
      'paymongo';

    const rawCentavos =
      paidPayment?.attributes?.amount ||
      attrs?.line_items?.[0]?.amount ||
      0;
    const paidAmountPhp = rawCentavos > 0 ? Number(rawCentavos) / 100 : Number(booking.amount_paid || 0);

    const metadata = attrs?.metadata || {};
    const phase = metadata?.phase || 'downpayment';
    const isInitial =
      booking.status === 'pending_verification' &&
      (phase === 'downpayment' || phase === 'full_payment');

    const newAmountPaid = isInitial
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
      .eq('paymongo_checkout_id', booking.paymongo_checkout_id);

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

    return NextResponse.json({
      verified: true,
      booking: updatedBooking,
    });
  } catch (err: any) {
    return NextResponse.json({ verified: false, error: err.message }, { status: 500 });
  }
}

