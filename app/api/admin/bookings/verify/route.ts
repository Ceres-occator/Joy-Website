// app/api/admin/bookings/verify/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Parse target booking ID and the specific action type ('approve' or 'reject')
    const { bookingId, action } = await req.json(); 

    if (!bookingId || !action) {
    return NextResponse.json({ error: "Missing payload arguments" }, { status: 400 });
    }

    // 🌟 Upgraded Status Map Variable Assignment
    let targetStatus = "pending_verification";

    if (action === "approve") {
    targetStatus = "confirmed";
    } else if (action === "reject") {
    targetStatus = "rejected";
    } else if (action === "complete") {
    targetStatus = "completed"; // 👈 Moves out of active upcoming schedule tracking views
    }

    const { data, error } = await supabase
    .from("bookings")
    .update({ status: targetStatus })
    .eq("id", bookingId)
    .select()
    .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Booking has been successfully marked as ${targetStatus}.`,
      booking: data 
    });

  } catch (error: any) {
    console.error("Admin verification state update failure:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update row status state." }, 
      { status: 500 }
    );
  }
}