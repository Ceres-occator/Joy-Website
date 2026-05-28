// app/api/booking/confirm/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const villaId = body.villaId || body.villa_id;
    const fullName = body.fullName || body.customer_name;
    const phone = body.phone || body.customer_phone;
    const eventDate = body.eventDate || body.event_date;
    const timeSlot = body.timeSlot || body.slot_assignment;
    const paxCount = body.paxCount || body.pax_count;
    const packageOption = body.packageOption || body.package_option;
    const includeOvernight = body.includeOvernight || body.include_overnight;
    const overnightPaxCount = body.overnightPaxCount || body.overnight_pax_count;
    
    const totalPrice = body.totalPrice || body.price || 0;
    const paymentMode = body.paymentMode || body.payment_mode || 'half';
    const amountPaid = body.amountPaid || body.amount_paid;
    const remainingBalance = body.remainingBalance || body.remaining_balance;

    const referenceNumber = body.referenceNumber || body.reference_number;
    const accountName = body.accountName || body.account_name;
    const receiptFilePath = body.receiptFilePath || body.receipt_file_path;
    const idFilePath = body.idFilePath || body.id_file_path;

    if (!villaId || !eventDate || !referenceNumber || !accountName || !receiptFilePath || !idFilePath) {
      return NextResponse.json(
        { error: 'Missing mandatory checkout parameters or verification data tokens.' },
        { status: 400 }
      );
    }

    // 🌟 EXTRACTION UPGRADE: Parse check-in and check-out strings
    let parsedStartDate = eventDate;
    let parsedEndDate = eventDate; // For singular events, start and end dates are identical

    if (eventDate && eventDate.includes(" to ")) {
      const dateParts = eventDate.split(" to ");
      parsedStartDate = dateParts[0];
      parsedEndDate = dateParts[1];
    }

    // Enforce strict PostgreSQL enum mappings rules compatibility strings tokens
    let validatedSlot = 'evening';
    if (timeSlot === 'day' || timeSlot === 'evening') {
      validatedSlot = timeSlot;
    }

    const supabase = await createClient();

    // 🌟 RELATIONAL PROTECTION OVERLAP CHECK
    // If a guest tries to book a date range, we check if their requested timeframe overlaps 
    // with any existing confirmed or pending stay.
    const { data: overlappingBookings, error: checkError } = await supabase
      .from('bookings')
      .select('id, event_date, end_date')
      .eq('villa_id', villaId)
      .in('status', ['pending_verification', 'confirmed']);

    if (!checkError && overlappingBookings) {
      const requestedStart = new Date(parsedStartDate);
      const requestedEnd = new Date(parsedEndDate);

      const hasOverlapConflict = overlappingBookings.some(booking => {
        const existingStart = new Date(booking.event_date);
        // Fallback to event_date if end_date was historically empty
        const existingEnd = new Date(booking.end_date || booking.event_date); 
        
        // Standard mathematical overlap formula: (StartA <= EndB) and (EndA >= StartB)
        return (requestedStart <= existingEnd && requestedEnd >= existingStart);
      });

      if (hasOverlapConflict) {
        return NextResponse.json(
          { error: 'One or more nights within this selected date range are already reserved or undergoing verification.' },
          { status: 409 }
        );
      }
    }

    const finalAmountPaid = amountPaid !== undefined ? Number(amountPaid) : (paymentMode === 'full' ? Number(totalPrice) : Number(totalPrice) * 0.5);
    const finalRemainingBalance = remainingBalance !== undefined ? Number(remainingBalance) : (Number(totalPrice) - finalAmountPaid);

    // Secure database storage insertion matrix commit
    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          villa_id: villaId,
          event_date: parsedStartDate,       // Stored as check-in date row
          end_date: parsedEndDate,           // 🌟 NEW COLUMN INTEGRATION: Stored as check-out date row
          slot_assignment: validatedSlot, 
          customer_name: fullName,
          customer_phone: phone,
          pax_count: Number(paxCount || 0),
          package_option: packageOption || 'accommodation_only',
          include_overnight: Boolean(includeOvernight),
          overnight_pax_count: Number(overnightPaxCount || 0),
          total_price: Number(totalPrice),
          reference_number: referenceNumber,
          account_name: accountName,
          receipt_file_path: receiptFilePath, 
          id_file_path: idFilePath,          
          status: 'pending_verification',
          payment_mode: paymentMode,          
          amount_paid: finalAmountPaid,
          remaining_balance: finalRemainingBalance
        }
      ])
      .select();

    if (error) {
      console.error("Supabase Write Error:", error);
      return NextResponse.json({ error: `Database Constraint Failure Error: ${error.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, booking: data[0] });
  } catch (err: any) {
    console.error("Fatal API Thread Crash Exception:", err);
    return NextResponse.json({ error: `Internal API Error: ${err.message}` }, { status: 500 });
  }
}