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

// 📝 UPDATE AN EXISTING BOOKING RECORD
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { bookingId, ...payload } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID identifier target is mandatory." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({
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
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, booking: data });
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