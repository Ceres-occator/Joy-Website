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
    
    // 🚀 FIXED: Improved loose value comparison handlers to accurately capture stringified or explicit booleans
    const includeOvernight = body.includeOvernight !== undefined ? body.includeOvernight : body.include_overnight;
    const overnightPaxCount = body.overnightPaxCount !== undefined ? body.overnightPaxCount : body.overnight_pax_count;
    
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

    let parsedStartDate = eventDate;
    let parsedEndDate = eventDate; 

    if (eventDate && eventDate.includes(" to ")) {
      const dateParts = eventDate.split(" to ");
      parsedStartDate = dateParts[0];
      parsedEndDate = dateParts[1];
    }

    let validatedSlot = 'evening';
    if (timeSlot === 'day' || timeSlot === 'evening') {
      validatedSlot = timeSlot;
    }

    const supabase = await createClient();

    // Grab the currently logged-in customer account session info
    const { data: { user } } = await supabase.auth.getUser();

    // RELATIONAL PROTECTION OVERLAP CHECK
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
        const existingEnd = new Date(booking.end_date || booking.event_date); 
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
          user_id: user?.id || null, 
          villa_id: villaId,
          event_date: parsedStartDate,       
          end_date: parsedEndDate,           
          slot_assignment: validatedSlot, 
          customer_name: fullName,
          customer_phone: phone,
          pax_count: Number(paxCount || 0),
          package_option: packageOption || 'accommodation_only',
          include_overnight: includeOvernight === true || String(includeOvernight) === 'true', // 🚀 FIXED: Robust truthiness evaluator string check
          overnight_pax_count: Number(overnightPaxCount || 0),
          total_price: Number(totalPrice),
          reference_number: referenceNumber,
          account_name: accountName,
          receipt_file_path: receiptFilePath, 
          id_file_path: idFilePath,          
          status: 'pending_verification',
          guest_id: `GUEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
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