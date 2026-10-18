import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { bookingId, action } = await req.json();

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: 'Booking ID and action are required.' },
        { status: 400 }
      );
    }

    let targetStatus = 'pending_verification';

    if (action === 'approve') {
      targetStatus = 'confirmed';
    } else if (action === 'reject') {
      targetStatus = 'rejected';
    } else if (action === 'complete') {
      targetStatus = 'completed';
    } else {
      return NextResponse.json({ error: 'Invalid booking action.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('bookings')
      .select('package_option, amount_paid, catering_required_amount, catering_status')
      .eq('id', bookingId)
      .maybeSingle();

    const updatePayload: Record<string, any> = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (
      action === 'approve' &&
      existing?.package_option === 'with_catering' &&
      Number(existing?.amount_paid || 0) >= Number(existing?.catering_required_amount || 10000)
    ) {
      updatePayload.catering_status = 'confirmed';
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('*, villas(name, address)')
      .single();

    if (error) {
      throw error;
    }

    // Update payment_transactions status to match
    if (action === 'approve' || action === 'reject') {
      await supabase
        .from('payment_transactions')
        .update({
          status: action === 'approve' ? 'verified' : 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('booking_id', bookingId)
        .eq('status', 'pending');
    }

    // Send SMS + Email notification to customer and admin
    if (data) {
      await dispatchBookingNotifications({
        bookingId: data.id,
        guestId: data.guest_id,
        eventType: action === 'approve' ? 'payment_verified' : 'booking_updated',
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
        paymentGateway: data.payment_gateway || 'manual',
        paymentChannel: data.payment_channel,
        paymentMode: data.payment_mode,
        accountName: data.account_name,
        referenceNumber: data.reference_number,
        status: data.status,
        cateringStatus: data.catering_status,
        cateringRequiredAmount: Number(data.catering_required_amount || 0),
        cateringDeadlineDate: data.catering_deadline_date,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Booking marked as ${targetStatus}.`,
      booking: data,
    });
  } catch (error: any) {
    console.error('Failed to update booking status:', error);
    return NextResponse.json(
      { error: error.message || 'Could not update booking status.' },
      { status: 500 }
    );
  }
}