import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: bookings, error: dbError } = await supabase
      .from('bookings')
      .select(
        'id, villa_id, customer_name, total_price, amount_paid, remaining_balance, payment_mode, status, package_option, event_date, end_date, slot_assignment, pax_count, created_at, villas(name)'
      )
      .in('status', ['pending_verification', 'confirmed'])
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;

    let totalRevenue = 0;
    let eventBookingsCount = 0;
    let accommodationBookingsCount = 0;

    if (bookings) {
      bookings.forEach((booking) => {
        const collected =
          booking.payment_mode === 'full'
            ? Number(booking.total_price)
            : booking.amount_paid && Number(booking.amount_paid) > 0
              ? Number(booking.amount_paid)
              : Number(booking.total_price) * 0.5;

        totalRevenue += collected;

        if (booking.package_option === 'accommodation_only') {
          accommodationBookingsCount++;
        } else {
          eventBookingsCount++;
        }
      });
    }

    const metrics = {
      totalRevenue,
      totalBookingsCount: bookings ? bookings.length : 0,
      eventBookingsCount,
      accommodationBookingsCount,
    };

    return NextResponse.json({ metrics, history: bookings || [] });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const {
      villaId,
      customerName,
      customerPhone,
      eventDate,
      timeSlot,
      packageOption,
      paxCount,
      totalPrice,
      paymentMode,
      amountPaid,
      remainingBalance,
    } = body;

    if (!villaId || !customerName || !eventDate || !totalPrice) {
      return NextResponse.json(
        { error: 'Please fill in the villa, guest name, date, and total price.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          villa_id: villaId,
          customer_name: customerName,
          customer_phone: customerPhone || '',
          event_date: eventDate,
          end_date: eventDate,
          slot_assignment: timeSlot || 'day',
          package_option: packageOption || 'venue_only',
          pax_count: Number(paxCount || 15),
          total_price: Number(totalPrice),
          payment_mode: paymentMode || 'full',
          amount_paid: Number(amountPaid),
          remaining_balance: Number(remainingBalance),
          account_name: 'Walk-in Cash Payment',
          reference_number: `CASH-${Date.now().toString().slice(-6)}`,
          guest_id: `GUEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          status: 'confirmed',
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, booking: data[0] });
  } catch (error: any) {
    console.error('Walk-in booking error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}