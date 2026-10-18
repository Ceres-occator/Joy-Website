import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');

    const supabase = await createClient();
    let query = supabase
      .from('payment_transactions')
      .select('*, bookings(guest_id, customer_name, customer_phone, email, event_date, total_price, amount_paid, remaining_balance, villas(name))')
      .order('created_at', { ascending: false });

    if (bookingId) {
      query = query.eq('booking_id', bookingId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ transactions: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const {
      bookingId,
      phase = 'follow_up',
      paymentGateway = 'manual',
      paymentChannel = 'manual_transfer',
      amount,
      accountName,
      referenceNumber,
      receiptFilePath,
      status = 'verified',
      notes,
    } = body;

    if (!bookingId || amount === undefined) {
      return NextResponse.json(
        { error: 'Booking ID and payment amount are required.' },
        { status: 400 }
      );
    }

    const { data: txn, error: insertErr } = await supabase
      .from('payment_transactions')
      .insert([
        {
          booking_id: bookingId,
          phase,
          payment_gateway: paymentGateway,
          payment_channel: paymentChannel,
          amount: Number(amount),
          account_name: accountName || null,
          reference_number: referenceNumber || null,
          receipt_file_path: receiptFilePath || null,
          status,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // If payment is verified/paid, update the parent booking's amount_paid, remaining_balance, and catering_status
    if (status === 'verified' || status === 'paid') {
      const { data: booking } = await supabase
        .from('bookings')
        .select('*, villas(name, address)')
        .eq('id', bookingId)
        .single();

      if (booking) {
        const newPaid = Number(booking.amount_paid || 0) + Number(amount);
        const newBalance = Math.max(0, Number(booking.total_price || 0) - newPaid);
        const cateringReq = Number(booking.catering_required_amount || 10000);
        const newCateringStatus =
          booking.package_option === 'with_catering'
            ? newPaid >= cateringReq
              ? 'confirmed'
              : booking.catering_status
            : 'not_applicable';

        const { data: updatedBooking } = await supabase
          .from('bookings')
          .update({
            amount_paid: newPaid,
            remaining_balance: newBalance,
            payment_mode: newBalance <= 0 ? 'full' : 'half',
            catering_status: newCateringStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
          .select('*, villas(name, address)')
          .single();

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
            paymentGateway,
            paymentChannel,
            paymentMode: updatedBooking.payment_mode,
            accountName: accountName || updatedBooking.account_name,
            referenceNumber: referenceNumber || updatedBooking.reference_number,
            status: updatedBooking.status,
            cateringStatus: updatedBooking.catering_status,
            cateringRequiredAmount: Number(updatedBooking.catering_required_amount || 0),
            cateringDeadlineDate: updatedBooking.catering_deadline_date,
          });
        }
      }
    }

    return NextResponse.json({ success: true, transaction: txn });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const {
      transactionId,
      amount,
      phase,
      paymentGateway,
      paymentChannel,
      accountName,
      referenceNumber,
      status,
      notes,
    } = body;

    if (!transactionId) {
      return NextResponse.json({ error: 'Transaction ID is required.' }, { status: 400 });
    }

    const { data: updatedTxn, error } = await supabase
      .from('payment_transactions')
      .update({
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(phase ? { phase } : {}),
        ...(paymentGateway ? { payment_gateway: paymentGateway } : {}),
        ...(paymentChannel !== undefined ? { payment_channel: paymentChannel } : {}),
        ...(accountName !== undefined ? { account_name: accountName } : {}),
        ...(referenceNumber !== undefined ? { reference_number: referenceNumber } : {}),
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, transaction: updatedTxn });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

