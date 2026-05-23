import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const {
      villaId,
      fullName,
      phone,
      eventDate,
      timeSlot,
      paxCount,
      packageOption,
      includeOvernight,
      overnightPaxCount,
      totalPrice,
      referenceNumber,
      accountName,
    } = await request.json();

    if (!villaId || !eventDate || !timeSlot || !referenceNumber || !accountName) {
      return NextResponse.json(
        { error: 'Missing mandatory checkout parameters or verification data.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Insert the finalized reservation directly into the database table
    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          villa_id: villaId,
          event_date: eventDate,
          slot_assignment: timeSlot,
          customer_name: fullName,
          customer_phone: phone,
          pax_count: Number(paxCount),
          package_option: packageOption,
          include_overnight: Boolean(includeOvernight),
          overnight_pax_count: Number(overnightPaxCount),
          total_price: Number(totalPrice),
          status: 'pending_verification', // Managed by admin controls later
        }
      ])
      .select();

    if (error) {
      // 23505 is the Postgres Unique Violation Error code (Double Booking Catch)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This date and slot combination was just reserved by another client. Please re-check the schedule.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, booking: data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: `Internal API Error: ${err.message}` }, { status: 500 });
  }
}