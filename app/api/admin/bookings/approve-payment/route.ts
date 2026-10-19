import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { bookingId, logId, action, amount, referenceNumber } = await req.json();

    if (!bookingId || !logId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, logId, or action.' },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    if (role && role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the owner or admin can verify payments.' },
        { status: 403 }
      );
    }

    // 1. Fetch authoritative current booking
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*, villas(name, address)')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const isRawTx = typeof logId === 'string' && logId.startsWith('tx_');
    const rawTxId = isRawTx ? logId.replace(/^tx_/, '') : null;

    // 2. Fetch existing payment transaction or audit record to verify idempotency
    let alreadyApproved = false;

    if (isRawTx && rawTxId) {
      const { data: tx } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', rawTxId)
        .maybeSingle();

      if (tx && (tx.status === 'paid' || tx.status === 'verified')) {
        alreadyApproved = true;
      }
    } else {
      const { data: auditRow } = await supabase
        .from('booking_audit_history')
        .select('*')
        .eq('id', logId)
        .maybeSingle();

      if (auditRow && (auditRow.status === 'approved' || auditRow.status === 'paid')) {
        alreadyApproved = true;
      }
    }

    if (alreadyApproved) {
      return NextResponse.json(
        { error: 'This payment has already been approved and recorded.' },
        { status: 400 }
      );
    }

    // 3. Process Rejection
    if (action === 'rejected' || action === 'failed') {
      if (isRawTx && rawTxId) {
        await supabase
          .from('payment_transactions')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', rawTxId);
      } else {
        await supabase
          .from('booking_audit_history')
          .update({ status: 'rejected' })
          .eq('id', logId);

        if (referenceNumber) {
          await supabase
            .from('payment_transactions')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('booking_id', bookingId)
            .eq('reference_number', referenceNumber);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Payment declined.',
        updatedBooking: booking,
        status: 'rejected',
      });
    }

    // 4. Process Approval
    if (action === 'approved') {
      const paymentAmount = Number(amount || 0);
      const currentPaid = Number(booking.amount_paid || 0);
      const totalPrice = Number(booking.total_price || 0);

      const updatedPaid = currentPaid + paymentAmount;
      const updatedRemaining = Math.max(0, totalPrice - updatedPaid);

      const cateringReq = Number(booking.catering_required_amount || 5000);
      const nextCateringStatus =
        booking.package_option === 'with_catering' && updatedPaid >= cateringReq
          ? 'confirmed'
          : booking.catering_status;

      // Update booking financial totals
      const { data: updatedBooking, error: updateErr } = await supabase
        .from('bookings')
        .update({
          amount_paid: updatedPaid,
          remaining_balance: updatedRemaining,
          payment_mode: updatedRemaining <= 0 ? 'full' : 'half',
          ...(nextCateringStatus ? { catering_status: nextCateringStatus } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .select('*, villas(name, address)')
        .single();

      if (updateErr) throw updateErr;

      // Update payment record statuses
      if (isRawTx && rawTxId) {
        await supabase
          .from('payment_transactions')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', rawTxId);

        // Also update matching booking_audit_history if reference_number matches
        if (referenceNumber) {
          await supabase
            .from('booking_audit_history')
            .update({ status: 'approved' })
            .eq('booking_id', bookingId)
            .eq('reference_number', referenceNumber);
        }
      } else {
        await supabase
          .from('booking_audit_history')
          .update({ status: 'approved' })
          .eq('id', logId);

        if (referenceNumber) {
          await supabase
            .from('payment_transactions')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('booking_id', bookingId)
            .eq('reference_number', referenceNumber);
        }
      }

      // Dispatch booking updated notification
      if (updatedBooking) {
        try {
          await dispatchBookingNotifications({
            bookingId: updatedBooking.id,
            guestId: updatedBooking.guest_id,
            eventType: 'booking_updated',
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
          });
        } catch (notifErr) {
          console.error('Failed to dispatch payment notification:', notifErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Payment approved and applied to booking balance.',
        updatedBooking,
        status: 'approved',
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    console.error('approve-payment error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

