import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { PaymongoCheckoutSchema } from '@/schema/booking';
import { enforceRateLimit, RATE_LIMIT_PROFILES } from '@/utils/rateLimit';
import { computeAuthoritativeBookingPrice } from '@/utils/serverPricing';
import type { PackageOption, TimeSlot } from '@/types';

/**
 * Initializes a PayMongo Hosted Checkout Session (`POST /v1/checkout_sessions`)
 * with strict Zod validation, rate limiting, and authoritative server-side price calculation.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitRes = enforceRateLimit(req, RATE_LIMIT_PROFILES.PAYMONGO_CHECKOUT);
    if (rateLimitRes) return rateLimitRes;

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        {
          error:
            'PayMongo is not configured on the server yet (missing PAYMONGO_SECRET_KEY in environment). Please use Manual Payment upload or configure PAYMONGO_SECRET_KEY.',
        },
        { status: 503 }
      );
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON request payload.' }, { status: 400 });
    }

    // 2. Strict Zod Validation (UUID bookingId, valid phase, safe internal redirect paths)
    const parsed = PaymongoCheckoutSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || 'Invalid checkout request parameters.',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      bookingId,
      phase,
      preferredChannel,
      amount: clientRequestedAmount,
      successRedirectPath,
      cancelRedirectPath,
    } = parsed.data;

    const supabase = await createClient();

    // 3. Fetch Booking Record from Supabase (via SECURITY DEFINER RPC with fallback)
    let booking: any = null;
    const { data: rpcBooking, error: rpcErr } = await supabase.rpc('get_booking_secure', {
      p_booking_id: bookingId,
      p_guest_id: null,
    });

    if (!rpcErr && rpcBooking) {
      booking = rpcBooking;
    } else {
      const { data: directBooking, error: bookingErr } = await supabase
        .from('bookings')
        .select('*, villas(name, address, min_deposit_percent)')
        .eq('id', bookingId)
        .maybeSingle();

      if (bookingErr || !directBooking) {
        return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
      }
      booking = directBooking;
    }

    // 4. Authoritative Backend Price Calculation from `villas`, `packages`, `rate_tiers`, `system_settings`
    // Never trust the frontend payload to dictate the booking total or required deposit!
    const pricing = await computeAuthoritativeBookingPrice(supabase, {
      villaId: booking.villa_id,
      packageOption: (booking.package_option || 'with_catering') as PackageOption,
      startDate: booking.event_date,
      endDate: booking.end_date || booking.event_date,
      timeSlot: (booking.slot_assignment === 'day' ? 'day' : 'evening') as TimeSlot,
      paxCount: Number(booking.pax_count || 1),
      includeOvernight: Boolean(booking.include_overnight),
      overnightPaxCount: Number(booking.overnight_pax_count || 0),
    });

    const authoritativeTotal = pricing.totalPrice;
    const requiredDepositAmount = pricing.requiredDepositAmount;
    const alreadyPaid = Math.max(0, Number(booking.amount_paid || 0));
    const authoritativeRemaining = Math.max(
      0,
      authoritativeTotal - (booking.status === 'confirmed' ? alreadyPaid : 0)
    );

    // Determine authoritative amount to charge in PHP for this payment phase
    let authoritativeChargePhp = requiredDepositAmount;

    if (phase === 'full_payment') {
      authoritativeChargePhp =
        booking.status === 'confirmed' ? authoritativeRemaining : authoritativeTotal;
    } else if (phase === 'downpayment') {
      authoritativeChargePhp = requiredDepositAmount;
    } else if (phase === 'catering_payment') {
      const cateringShortfall = Math.max(
        0,
        pricing.cateringRequiredAmount - (booking.status === 'confirmed' ? alreadyPaid : 0)
      );
      const minRequired = cateringShortfall > 0 ? cateringShortfall : authoritativeRemaining;
      if (
        clientRequestedAmount &&
        clientRequestedAmount >= minRequired &&
        clientRequestedAmount <= authoritativeRemaining
      ) {
        authoritativeChargePhp = clientRequestedAmount;
      } else {
        authoritativeChargePhp = minRequired;
      }
    } else {
      // balance_settlement or follow_up
      if (
        clientRequestedAmount &&
        clientRequestedAmount >= 100 &&
        clientRequestedAmount <= authoritativeRemaining
      ) {
        authoritativeChargePhp = clientRequestedAmount;
      } else {
        authoritativeChargePhp = authoritativeRemaining;
      }
    }

    // PayMongo requires amounts in centavos (integer, minimum 10000 centavos = PHP 100.00)
    const amountCentavos = Math.max(10000, Math.round(authoritativeChargePhp * 100));
    const finalChargePhp = amountCentavos / 100;

    // Prioritize Chinabank / Direct Online Banking (`dob`), QR Ph (`qrph`), E-Wallets, and Cards
    const paymentMethodTypes =
      preferredChannel === 'chinabank'
        ? ['dob', 'qrph', 'gcash', 'paymaya', 'card']
        : ['qrph', 'dob', 'gcash', 'paymaya', 'card'];

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';

    const villaName = pricing.villaName;
    const phaseLabel =
      phase === 'full_payment'
        ? 'Full Reservation Payment'
        : phase === 'catering_payment'
        ? 'Catering Deadline Payment'
        : phase === 'balance_settlement' || phase === 'follow_up'
        ? 'Remaining Balance Settlement'
        : `Minimum Deposit (${pricing.minDepositPercent}%)`;

    const successUrl = successRedirectPath
      ? `${origin}${successRedirectPath}?booking_id=${booking.id}&guest_id=${booking.guest_id}&paymongo_status=success`
      : `${origin}/my-bookings?booking_id=${booking.id}&guest_id=${booking.guest_id}&paymongo_status=success`;

    const cancelUrl = cancelRedirectPath
      ? `${origin}${cancelRedirectPath}?booking_id=${booking.id}&guest_id=${booking.guest_id}&paymongo_status=cancelled`
      : `${origin}/my-bookings?booking_id=${booking.id}&guest_id=${booking.guest_id}&paymongo_status=cancelled`;

    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;

    const paymongoPayload = {
      data: {
        attributes: {
          billing: {
            name: booking.customer_name,
            phone: booking.customer_phone,
            email: booking.email || 'guest@joyevents.ph',
          },
          send_email_receipt: Boolean(booking.email),
          show_description: true,
          show_line_items: true,
          description: `${villaName} — ${phaseLabel} (Ref: ${booking.guest_id})`,
          line_items: [
            {
              currency: 'PHP',
              amount: amountCentavos,
              name: `${villaName} (${phaseLabel})`,
              description: `Booking Reference ${booking.guest_id} • Event Date: ${booking.event_date}`,
              quantity: 1,
            },
          ],
          payment_method_types: paymentMethodTypes,
          reference_number: booking.guest_id,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            booking_id: String(booking.id),
            guest_id: String(booking.guest_id),
            phase: String(phase || 'downpayment'),
            preferred_channel: String(preferredChannel || 'chinabank'),
            amount_php: String(finalChargePhp),
            authoritative_total_php: String(authoritativeTotal),
          },
        },
      },
    };

    const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(paymongoPayload),
    });

    const pmJson = await pmRes.json();

    if (!pmRes.ok) {
      const apiErrMessage =
        pmJson?.errors?.[0]?.detail || 'Failed to initialize PayMongo checkout session.';
      return NextResponse.json({ error: apiErrMessage, details: pmJson }, { status: 400 });
    }

    const checkoutSessionId: string = pmJson.data.id;
    const checkoutUrl: string = pmJson.data.attributes.checkout_url;

    // 5. Record pending checkout session via SECURITY DEFINER RPC (with fallback)
    const { error: attachErr } = await supabase.rpc('attach_paymongo_checkout_session', {
      p_booking_id: booking.id,
      p_checkout_id: checkoutSessionId,
      p_phase: phase || 'downpayment',
      p_channel: preferredChannel || 'chinabank',
      p_amount: finalChargePhp,
      p_account_name: booking.customer_name,
    });

    if (attachErr) {
      await supabase
        .from('bookings')
        .update({
          payment_gateway: 'paymongo',
          payment_channel: preferredChannel || 'chinabank',
          paymongo_checkout_id: checkoutSessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      await supabase.from('payment_transactions').insert([
        {
          booking_id: booking.id,
          phase: phase || 'downpayment',
          payment_gateway: 'paymongo',
          payment_channel: preferredChannel || 'chinabank',
          amount: finalChargePhp,
          status: 'pending',
          paymongo_checkout_id: checkoutSessionId,
          account_name: booking.customer_name,
          reference_number: checkoutSessionId,
          notes: `PayMongo checkout initialized (${preferredChannel || 'online'})`,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      checkoutSessionId,
      checkoutUrl,
      authoritativeAmountPhp: finalChargePhp,
      authoritativeTotalPhp: authoritativeTotal,
    });
  } catch (err: any) {
    console.error('PayMongo checkout creation error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not initialize PayMongo checkout.' },
      { status: 500 }
    );
  }
}
