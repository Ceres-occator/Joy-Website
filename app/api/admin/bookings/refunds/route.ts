import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const {
      bookingId,
      action, // 'evaluate_cancellation' | 'approve_refund' | 'process_refund' | 'reject_refund' | 'force_forfeit'
      refundAmount,
      reason,
    } = body;

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: 'Booking ID and refund action are required.' },
        { status: 400 }
      );
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*, villas(name, address)')
      .eq('id', bookingId)
      .single();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const { data: sysSettings } = await supabase
      .from('system_settings')
      .select('forfeiture_days')
      .eq('id', 'default')
      .maybeSingle();

    const forfeitureDays = Number(sysSettings?.forfeiture_days ?? 7);
    const eventDateObj = new Date(`${booking.event_date}T00:00:00Z`);
    const todayObj = new Date();
    todayObj.setUTCHours(0, 0, 0, 0);
    const daysUntilEvent = Math.ceil(
      (eventDateObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24)
    );
    const withinForfeitureWindow = daysUntilEvent <= forfeitureDays;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'evaluate_cancellation') {
      updatePayload.status = 'cancelled';
      updatePayload.cancelled_at = new Date().toISOString();
      if (withinForfeitureWindow) {
        updatePayload.is_forfeited = true;
        updatePayload.refund_status = 'forfeited';
        updatePayload.refund_amount = 0;
        updatePayload.forfeiture_reason = `Cancelled ${daysUntilEvent} day(s) before event (within ${forfeitureDays}-day forfeiture window). Deposit is forfeited.`;
      } else {
        updatePayload.is_forfeited = false;
        updatePayload.refund_status = Number(booking.amount_paid || 0) > 0 ? 'requested' : 'none';
        updatePayload.refund_amount = Number(booking.amount_paid || 0);
        updatePayload.refund_reason = reason || 'Cancelled outside forfeiture window';
      }
    } else if (action === 'approve_refund') {
      if (booking.is_forfeited) {
        return NextResponse.json(
          {
            error: `Refund blocked by ${forfeitureDays}-day forfeiture policy: ${booking.forfeiture_reason}`,
          },
          { status: 400 }
        );
      }
      updatePayload.refund_status = 'approved';
      updatePayload.refund_amount =
        refundAmount !== undefined ? Number(refundAmount) : Number(booking.amount_paid || 0);
      if (reason) updatePayload.refund_reason = reason;
    } else if (action === 'process_refund') {
      if (booking.is_forfeited) {
        return NextResponse.json(
          {
            error: `Refund blocked by ${forfeitureDays}-day forfeiture policy: ${booking.forfeiture_reason}`,
          },
          { status: 400 }
        );
      }
      const finalRefundAmt =
        refundAmount !== undefined
          ? Number(refundAmount)
          : Number(booking.refund_amount || booking.amount_paid || 0);
      updatePayload.refund_status = 'processed';
      updatePayload.refund_amount = finalRefundAmt;
      updatePayload.refund_processed_at = new Date().toISOString();
      updatePayload.status = 'cancelled';
      if (reason) updatePayload.refund_reason = reason;

      // Record refund entry in payment_transactions
      await supabase.from('payment_transactions').insert([
        {
          booking_id: booking.id,
          phase: 'refund',
          payment_gateway: booking.payment_gateway || 'manual',
          payment_channel: booking.payment_channel || 'refund',
          amount: finalRefundAmt,
          account_name: booking.customer_name,
          reference_number: `REFUND-${Date.now().toString().slice(-6)}`,
          status: 'refunded',
          notes: reason || 'Refund processed by admin',
        },
      ]);
    } else if (action === 'reject_refund') {
      updatePayload.refund_status = 'rejected';
      updatePayload.refund_amount = 0;
      if (reason) updatePayload.refund_reason = reason;
    } else if (action === 'force_forfeit') {
      updatePayload.status = 'cancelled';
      updatePayload.is_forfeited = true;
      updatePayload.refund_status = 'forfeited';
      updatePayload.refund_amount = 0;
      updatePayload.forfeiture_reason =
        reason || `Payment forfeited under ${forfeitureDays}-day cancellation policy.`;
    } else {
      return NextResponse.json({ error: 'Unknown refund action.' }, { status: 400 });
    }

    const { data: updatedBooking, error: updateErr } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('*, villas(name, address)')
      .single();

    if (updateErr) throw updateErr;

    await supabase.from('booking_audit_history').insert([
      {
        booking_id: bookingId,
        type: `REFUND_${action.toUpperCase()}`,
        amount_paid: Number(updatePayload.refund_amount || 0),
        reference_number: updatedBooking.reference_number,
        account_name: updatedBooking.customer_name,
        summary: `Refund / Cancellation update (${updatePayload.refund_status}): ${
          updatePayload.forfeiture_reason || updatePayload.refund_reason || action
        }`,
        status: 'approved',
      },
    ]);

    await dispatchBookingNotifications({
      bookingId: updatedBooking.id,
      guestId: updatedBooking.guest_id,
      eventType: 'refund_update',
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
      paymentGateway: updatedBooking.payment_gateway,
      paymentChannel: updatedBooking.payment_channel,
      paymentMode: updatedBooking.payment_mode,
      accountName: updatedBooking.account_name,
      referenceNumber: updatedBooking.reference_number,
      status: updatedBooking.status,
      cateringStatus: updatedBooking.catering_status,
      cateringRequiredAmount: Number(updatedBooking.catering_required_amount || 0),
      cateringDeadlineDate: updatedBooking.catering_deadline_date,
      forfeitureDays,
      isForfeited: Boolean(updatedBooking.is_forfeited),
      forfeitureReason: updatedBooking.forfeiture_reason,
      refundStatus: updatedBooking.refund_status,
      refundAmount: Number(updatedBooking.refund_amount || 0),
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
    });
  } catch (err: any) {
    console.error('Refund processing error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not process refund action.' },
      { status: 500 }
    );
  }
}

