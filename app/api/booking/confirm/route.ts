// app/api/booking/confirm/route.ts
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
      receiptFilePath, 
      idFilePath,      
    } = await request.json();

    if (!villaId || !eventDate || !timeSlot || !referenceNumber || !accountName || !receiptFilePath || !idFilePath) {
      return NextResponse.json(
        { error: 'Missing mandatory checkout parameters or verification data.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 🌟 STEP A: Query the database to check if a live reservation is actively occupying this slot
    const { data: existingActiveBooking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('villa_id', villaId)
      .eq('event_date', eventDate)
      .eq('slot_assignment', timeSlot)
      .in('status', ['pending_verification', 'confirmed']) // 👈 Only look for blocks that are actually active
      .maybeSingle();

    if (existingActiveBooking) {
      return NextResponse.json(
        { error: 'This date and slot combination is currently reserved or undergoing verification. Please choose another schedule.' },
        { status: 409 }
      );
    }

    // 🌟 STEP B: Safe Insertion. (Since completed entries are ignored above, we can pass through)
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
          reference_number: referenceNumber,
          account_name: accountName,
          receipt_file_path: receiptFilePath, 
          id_file_path: idFilePath,           
          status: 'pending_verification',
        }
      ])
      .select();

    if (error) {
      // Fallback check for the absolute database index safety guard rail 
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This schedule slot has already been booked. Please re-check the calendar.' },
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