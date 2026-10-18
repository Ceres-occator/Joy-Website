import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'PayMongo secret key (PAYMONGO_SECRET_KEY) is not configured in .env.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      bookingId,
      amount,
      phase = 'downpayment',
      preferredChannel = 'chinabank',
      successRedirectPath,
      cancelRedirectPath,
    } = body;

    if (!bookingId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Booking ID and a valid payment amount are required.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*, villas(name)')
      .eq('id', bookingId)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      'http://localhost:3000';

    const cleanOrigin = origin.replace(/\/$/, '');
    const successUrl =
      successRedirectPath
        ? `${cleanOrigin}${successRedirectPath}`
        : `${cleanOrigin}/my-bookings?paymongo_status=success&booking_id=${booking.id}&guest_id=${booking.guest_id}`;
    const cancelUrl =
      cancelRedirectPath
        ? `${cleanOrigin}${cancelRedirectPath}`
        : `${cleanOrigin}/my-bookings?paymongo_status=cancelled&booking_id=${booking.id}&guest_id=${booking.guest_id}`;

    // PayMongo requires amounts in centavos (integer, min 10000 = PHP 100.00)
    const centavosAmount = Math.max(10000, Math.round(Number(amount) * 100));
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const phaseLabel =
      phase === 'full_payment'
        ? 'Full Reservation Payment'
        : phase === 'catering_payment'
        ? 'Catering Deadline Settlement'
        : phase === 'balance_settlement' || phase === 'follow_up'
        ? 'Balance / Follow-Up Payment'
        : `Reservation Deposit (${booking.required_deposit_percent || 50}%)`;

    // Order payment methods to support Chinabank (via QR Ph / Online Banking / Card) alongside e-wallets
    const methodSets = [
      ['qrph', 'dob', 'card', 'gcash', 'paymaya', 'grab_pay'],
      ['card', 'gcash', 'paymaya', 'grab_pay'],
      ['gcash', 'card'],
    ];

    let checkoutSession: any = null;
    let lastError: any = null;

    for (const paymentMethodTypes of methodSets) {
      const paymongoPayload = {
        data: {
          attributes: {
            billing: {
              name: booking.customer_name,
              phone: booking.customer_phone,
              ...(booking.email ? { email: booking.email } : {}),
            },
            send_email_receipt: Boolean(booking.email),
            show_description: true,
            show_line_items: true,
            description: `${booking.villas?.name || "Joy's Events Place"} — ${phaseLabel} (Ref: ${booking.guest_id})`,
            line_items: [
              {
                currency: 'PHP',
                amount: centavosAmount,
                name: `${booking.villas?.name || 'Venue Booking'} — ${phaseLabel}`,
                quantity: 1,
                description: `Event Date: ${booking.event_date} | Ref: ${booking.guest_id}`,
              },
            ],
            payment_method_types: paymentMethodTypes,
            success_url: successUrl,
            cancel_url: cancelUrl,
            reference_number: `${booking.guest_id}-${Date.now().toString().slice(-4)}`,
            metadata: {
              booking_id: booking.id,
              guest_id: booking.guest_id || '',
              phase,
              preferred_channel: preferredChannel || 'chinabank',
              amount_php: String(amount),
            },
          },
        },
      };

      const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(paymongoPayload),
      });

      const json = await res.json();
      if (res.ok && json?.data?.attributes?.checkout_url) {
        checkoutSession = json.data;
        break;
      }
      lastError = json?.errors?.[0]?.detail || 'Could not create PayMongo checkout session.';
    }

    if (!checkoutSession) {
      return NextResponse.json({ error: lastError }, { status: 400 });
    }

    const checkoutId = checkoutSession.id;
    const checkoutUrl = checkoutSession.attributes.checkout_url;

    // Update booking with active PayMongo checkout session
    await supabase
      .from('bookings')
      .update({
        payment_gateway: 'paymongo',
        payment_channel: preferredChannel || 'chinabank',
        paymongo_checkout_id: checkoutId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    // Record pending transaction phase in payment_transactions
    await supabase.from('payment_transactions').insert([
      {
        booking_id: booking.id,
        phase,
        payment_gateway: 'paymongo',
        payment_channel: preferredChannel || 'chinabank',
        amount: Number(amount),
        account_name: booking.customer_name,
        reference_number: checkoutId,
        paymongo_checkout_id: checkoutId,
        status: 'pending',
        notes: `${phaseLabel} initiated via PayMongo (${preferredChannel || 'Chinabank / Online'})`,
      },
    ]);

    return NextResponse.json({
      success: true,
      checkoutId,
      checkoutUrl,
    });
  } catch (err: any) {
    console.error('PayMongo checkout creation error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize PayMongo checkout.' },
      { status: 500 }
    );
  }
}

