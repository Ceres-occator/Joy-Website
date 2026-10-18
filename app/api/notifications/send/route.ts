import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { dispatchBookingNotifications } from '@/utils/notifications';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, eventType = 'booking_updated' } = body;

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, villas(name, address)')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const results = await dispatchBookingNotifications({
      bookingId: booking.id,
      guestId: booking.guest_id || booking.id.slice(0, 8).toUpperCase(),
      eventType,
      customerName: booking.customer_name,
      customerPhone: booking.customer_phone,
      customerEmail: booking.email,
      villaName: booking.villas?.name || 'Joy Events Venue',
      villaAddress: booking.villas?.address || 'Ma-a, Davao City, Philippines, 8000',
      eventDate: booking.event_date,
      endDate: booking.end_date,
      slotAssignment: booking.slot_assignment,
      packageOption: booking.package_option,
      paxCount: Number(booking.pax_count || 1),
      includeOvernight: Boolean(booking.include_overnight),
      overnightPaxCount: Number(booking.overnight_pax_count || 0),
      totalPrice: Number(booking.total_price || 0),
      amountPaid: Number(booking.amount_paid || 0),
      remainingBalance: Number(booking.remaining_balance || 0),
      requiredDepositPercent: Number(booking.required_deposit_percent || 50),
      requiredDepositAmount: Number(booking.required_deposit_amount || 0),
      paymentGateway: booking.payment_gateway || 'manual',
      paymentChannel: booking.payment_channel,
      paymentMode: booking.payment_mode,
      accountName: booking.account_name,
      referenceNumber: booking.reference_number,
      status: booking.status,
      cateringStatus: booking.catering_status,
      cateringRequiredAmount: Number(booking.catering_required_amount || 0),
      cateringDeadlineDate: booking.catering_deadline_date,
      isForfeited: Boolean(booking.is_forfeited),
      forfeitureReason: booking.forfeiture_reason,
      refundStatus: booking.refund_status,
      refundAmount: Number(booking.refund_amount || 0),
    });

    return NextResponse.json({
      success: true,
      message: 'Notifications and receipts dispatched.',
      results,
    });
  } catch (err: any) {
    console.error('Notification dispatch error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not dispatch notifications.' },
      { status: 500 }
    );
  }
}

