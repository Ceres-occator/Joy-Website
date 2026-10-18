import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { requestId, action, reason } = await req.json();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    if (role && role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only the owner or admin can approve or decline changes.' },
        { status: 403 }
      );
    }

    let { data: requestRow, error: fetchErr } = await supabase
      .from('booking_changes_approval')
      .select('*')
      .eq('request_id', requestId)
      .maybeSingle();

    if (!requestRow) {
      const fallback = await supabase
        .from('booking_changes_approval')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      requestRow = fallback.data;
      fetchErr = fallback.error;
    }

    if (fetchErr || !requestRow) {
      return NextResponse.json({ error: 'Change request not found.' }, { status: 404 });
    }

    const matchColumn = requestRow.request_id ? 'request_id' : 'id';
    const matchValue = requestRow.request_id || requestRow.id;

    if (action === 'reject') {
      const { error: rejectErr } = await supabase
        .from('booking_changes_approval')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          rejection_reason: reason || 'Declined by management',
        })
        .eq(matchColumn, matchValue);

      if (rejectErr) throw rejectErr;

      await supabase
        .from('booking_audit_history')
        .update({ status: 'rejected' })
        .eq('booking_id', requestRow.booking_id)
        .eq('status', 'pending_approval')
        .in('type', ['data_edit', 'cancellation_request']);

      return NextResponse.json({ success: true, message: 'Change request declined.' });
    }

    if (action === 'approve') {
      const unpackedChanges: Record<string, any> = {
        ...(requestRow.proposed_changes?.after || requestRow.proposed_changes || {}),
      };

      // When a guest's cancellation request is approved, set booking status to 'cancelled'
      // and evaluate the dynamic forfeiture policy (X days before event_date)
      if (
        unpackedChanges.status === 'cancelled_request_pending' ||
        unpackedChanges.status === 'cancelled'
      ) {
        unpackedChanges.status = 'cancelled';
        unpackedChanges.cancelled_at = new Date().toISOString();
        try {
          const { data: evalResult } = await supabase.rpc('evaluate_booking_cancellation', {
            p_booking_id: requestRow.booking_id,
            p_reason: 'Guest cancellation request approved',
          });
          if (evalResult) {
            unpackedChanges.is_forfeited = Boolean(evalResult.is_forfeited);
            unpackedChanges.forfeiture_reason = evalResult.forfeiture_reason;
            unpackedChanges.refund_status = evalResult.refund_status;
            unpackedChanges.refund_amount = Number(evalResult.refund_amount || 0);
          }
        } catch {}
      }

      const { data: updatedBooking, error: updateErr } = await supabase
        .from('bookings')
        .update(unpackedChanges)
        .eq('id', requestRow.booking_id)
        .select('*, villas(name, address)')
        .single();

      if (updateErr) throw updateErr;

      const { error: finalizeErr } = await supabase
        .from('booking_changes_approval')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
        })
        .eq(matchColumn, matchValue);

      if (finalizeErr) throw finalizeErr;

      await supabase
        .from('booking_audit_history')
        .update({ status: 'approved' })
        .eq('booking_id', requestRow.booking_id)
        .eq('status', 'pending_approval')
        .in('type', ['data_edit', 'cancellation_request']);

      if (updatedBooking) {
        await dispatchBookingNotifications({
          bookingId: updatedBooking.id,
          guestId: updatedBooking.guest_id,
          eventType:
            updatedBooking.status === 'cancelled' ? 'cancellation_update' : 'booking_updated',
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
          isForfeited: Boolean(updatedBooking.is_forfeited),
          forfeitureReason: updatedBooking.forfeiture_reason,
          refundStatus: updatedBooking.refund_status,
          refundAmount: Number(updatedBooking.refund_amount || 0),
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Changes approved, forfeiture policy evaluated, and guest notified!',
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}