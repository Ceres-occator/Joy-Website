import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        guest_id,
        villa_id,
        customer_name,
        customer_phone,
        email,
        account_name,
        reference_number,
        total_price,
        amount_paid,
        remaining_balance,
        payment_mode,
        payment_gateway,
        payment_channel,
        paymongo_checkout_id,
        paymongo_payment_id,
        required_deposit_percent,
        required_deposit_amount,
        catering_status,
        catering_required_amount,
        catering_deadline_date,
        cancelled_at,
        is_forfeited,
        forfeiture_reason,
        refund_status,
        refund_amount,
        refund_reason,
        refund_processed_at,
        event_date,
        end_date,
        slot_assignment,
        pax_count,
        package_option,
        include_overnight,
        overnight_pax_count,
        status,
        receipt_file_path,
        id_file_path,
        created_at,
        updated_at,
        villas ( id, name, address )
      `)
      .order('event_date', { ascending: false });

    if (error) throw error;

    const bookingsWithSignedUrls = await Promise.all(
      (bookings || []).map(async (booking) => {
        let signedReceiptUrl = booking.receipt_file_path;
        let signedIdUrl = booking.id_file_path;

        if (booking.receipt_file_path && !booking.receipt_file_path.startsWith('http')) {
          const { data } = await supabase.storage
            .from('booking-attachments')
            .createSignedUrl(booking.receipt_file_path, 900);
          if (data?.signedUrl) signedReceiptUrl = data.signedUrl;
        }

        if (booking.id_file_path && !booking.id_file_path.startsWith('http')) {
          const { data } = await supabase.storage
            .from('booking-attachments')
            .createSignedUrl(booking.id_file_path, 900);
          if (data?.signedUrl) signedIdUrl = data.signedUrl;
        }

        return {
          ...booking,
          receipt_file_path: signedReceiptUrl,
          id_file_path: signedIdUrl,
        };
      })
    );

    return NextResponse.json({ bookings: bookingsWithSignedUrls });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { bookingId, sendReceiptUpdate = true, ...payload } = body;

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role || user?.user_metadata?.role;
    // Allow direct edits if owner or if no strict staff separation is configured
    const isDirectAdminEdit = role === 'owner' || !role || role === 'admin';

    const updatedFields: Record<string, any> = {
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      email: payload.email ? String(payload.email).trim() : null,
      account_name: payload.accountName,
      reference_number: payload.referenceNumber,
      total_price: Number(payload.totalPrice || 0),
      amount_paid: Number(payload.amountPaid || 0),
      remaining_balance: Number(payload.remainingBalance || 0),
      event_date: payload.eventDate,
      end_date: payload.endDate || payload.eventDate,
      slot_assignment: payload.slotAssignment,
      pax_count: Number(payload.paxCount || 1),
      package_option: payload.packageOption,
      status: payload.status,
      updated_at: new Date().toISOString(),
    };

    if (payload.paymentGateway) updatedFields.payment_gateway = payload.paymentGateway;
    if (payload.paymentChannel !== undefined) updatedFields.payment_channel = payload.paymentChannel;
    if (payload.cateringStatus) updatedFields.catering_status = payload.cateringStatus;
    if (payload.refundStatus) updatedFields.refund_status = payload.refundStatus;
    if (payload.refundAmount !== undefined) updatedFields.refund_amount = Number(payload.refundAmount);

    // If admin changes status to 'cancelled', evaluate dynamic forfeiture policy automatically
    if (payload.status === 'cancelled') {
      try {
        const { data: evalResult } = await supabase.rpc('evaluate_booking_cancellation', {
          p_booking_id: bookingId,
          p_reason: payload.refundReason || 'Cancelled by admin',
        });
        if (evalResult) {
          updatedFields.cancelled_at = new Date().toISOString();
          updatedFields.is_forfeited = Boolean(evalResult.is_forfeited);
          updatedFields.forfeiture_reason = evalResult.forfeiture_reason;
          if (!payload.refundStatus || payload.refundStatus === 'none') {
            updatedFields.refund_status = evalResult.refund_status;
            updatedFields.refund_amount = Number(evalResult.refund_amount || 0);
          }
        }
      } catch {}
    }

    if (isDirectAdminEdit) {
      const { data, error } = await supabase
        .from('bookings')
        .update(updatedFields)
        .eq('id', bookingId)
        .select('*, villas(name, address)')
        .single();

      if (error) throw error;

      // Record audit history entry
      await supabase.from('booking_audit_history').insert([
        {
          booking_id: bookingId,
          type: 'ADMIN_RECORD_UPDATE',
          amount_paid: updatedFields.amount_paid,
          reference_number: updatedFields.reference_number,
          account_name: updatedFields.account_name,
          summary: `Booking & payment details updated by admin (${updatedFields.status}).`,
          status: 'approved',
        },
      ]);

      // Send updated SMS & Email receipt to guest and alert to admin
      if (sendReceiptUpdate && data) {
        await dispatchBookingNotifications({
          bookingId: data.id,
          guestId: data.guest_id,
          eventType: 'booking_updated',
          customerName: data.customer_name,
          customerPhone: data.customer_phone,
          customerEmail: data.email,
          villaName: data.villas?.name || 'Joy Events Venue',
          villaAddress: data.villas?.address,
          eventDate: data.event_date,
          endDate: data.end_date,
          slotAssignment: data.slot_assignment,
          packageOption: data.package_option,
          paxCount: Number(data.pax_count || 1),
          includeOvernight: Boolean(data.include_overnight),
          overnightPaxCount: Number(data.overnight_pax_count || 0),
          totalPrice: Number(data.total_price || 0),
          amountPaid: Number(data.amount_paid || 0),
          remainingBalance: Number(data.remaining_balance || 0),
          requiredDepositPercent: Number(data.required_deposit_percent || 50),
          requiredDepositAmount: Number(data.required_deposit_amount || 0),
          paymentGateway: data.payment_gateway,
          paymentChannel: data.payment_channel,
          paymentMode: data.payment_mode,
          accountName: data.account_name,
          referenceNumber: data.reference_number,
          status: data.status,
          cateringStatus: data.catering_status,
          cateringRequiredAmount: Number(data.catering_required_amount || 0),
          cateringDeadlineDate: data.catering_deadline_date,
          isForfeited: Boolean(data.is_forfeited),
          forfeitureReason: data.forfeiture_reason,
          refundStatus: data.refund_status,
          refundAmount: Number(data.refund_amount || 0),
        });
      }

      return NextResponse.json({ success: true, bypassApproval: true, booking: data });
    }

    const { data: originalBooking, error: fetchErr } = await supabase
      .from('bookings')
      .select(
        'customer_name, customer_phone, email, account_name, reference_number, total_price, amount_paid, remaining_balance, event_date, slot_assignment, pax_count, package_option, status'
      )
      .eq('id', bookingId)
      .single();

    if (fetchErr || !originalBooking) {
      return NextResponse.json({ error: 'Original booking could not be found.' }, { status: 404 });
    }

    const { error: approvalError } = await supabase.from('booking_changes_approval').insert([
      {
        booking_id: bookingId,
        requested_by: user?.id,
        proposed_changes: {
          before: originalBooking,
          after: updatedFields,
        },
        status: 'pending',
      },
    ]);

    if (approvalError) throw approvalError;

    return NextResponse.json({
      success: true,
      requiresApproval: true,
      message: 'Your changes have been sent to the owner for approval.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
    }

    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}