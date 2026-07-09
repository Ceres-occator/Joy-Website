// app/api/admin/bookings/directory/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// 📥 FETCH ALL RECORDS FOR THE MANAGEMENT DIRECTORY
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id, customer_name, customer_phone, account_name, reference_number,
        total_price, amount_paid, remaining_balance, event_date, slot_assignment,
        pax_count, package_option, include_overnight, overnight_pax_count, status,
        receipt_file_path, id_file_path, villas ( id, name )
      `)
      .order("event_date", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ bookings: bookings || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 📝 UPDATE AN EXISTING BOOKING RECORD (WITH BEFORE/AFTER SNAPSHOTS)
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { bookingId, ...payload } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID identifier target is mandatory." }, { status: 400 });
    }

    // Get current user session info
    const { data: { user } } = await supabase.auth.getUser();
    const isOwner = user?.user_metadata?.role === 'owner';

    // Format the new changes payload
    const targetChangesPayload = {
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      account_name: payload.accountName,
      reference_number: payload.referenceNumber,
      total_price: Number(payload.totalPrice),
      amount_paid: Number(payload.amountPaid),
      remaining_balance: Number(payload.remainingBalance),
      event_date: payload.eventDate,
      slot_assignment: payload.slotAssignment,
      pax_count: Number(payload.paxCount),
      package_option: payload.packageOption,
      status: payload.status
    };

    // Case A: User is the Owner -> Direct execute changes immediately
    if (isOwner) {
      const { data, error } = await supabase
        .from("bookings")
        .update(targetChangesPayload)
        .eq("id", bookingId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, bypassApproval: true, booking: data });
    }

    // Case B: User is an Admin -> Get "Before" data snapshot first, then log request
    const { data: originalBooking, error: fetchErr } = await supabase
      .from("bookings")
      .select("customer_name, customer_phone, account_name, reference_number, total_price, amount_paid, remaining_balance, event_date, slot_assignment, pax_count, package_option, status")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !originalBooking) {
      return NextResponse.json({ error: "Could not fetch original booking snapshot target." }, { status: 404 });
    }

    // Pack both snapshots into the approval table
    const { error: approvalError } = await supabase
      .from("booking_changes_approval")
      .insert([
        {
          booking_id: bookingId,
          requested_by: user?.id,
          proposed_changes: {
            before: originalBooking,
            after: targetChangesPayload
          },
          status: 'pending'
        }
      ]);

    if (approvalError) throw approvalError;

    return NextResponse.json({ 
      success: true, 
      requiresApproval: true, 
      message: "Modifications queued. Changes require Owner authorization parameters to update." 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ❌ PURGE / DELETE A RECORD FROM THE PERMANENT STACK
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get("bookingId");

    if (!bookingId) {
      return NextResponse.json({ error: "Missing mandatory booking ID parameter target." }, { status: 400 });
    }

    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}