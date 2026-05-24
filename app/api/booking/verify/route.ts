// app/api/admin/bookings/verify/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { bookingId, action } = await req.json(); // action can be 'approve' or 'reject'

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID required." }, { status: 400 });
    }

    // Determine target status update mapping
    const targetStatus = action === "approve" ? "confirmed" : "rejected";

    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({ status: targetStatus })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, booking: updatedBooking });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}