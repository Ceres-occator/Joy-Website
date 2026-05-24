// app/api/admin/bookings/verify/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Parse target booking ID and the specific action type ('approve' or 'reject')
    const { bookingId, action } = await req.json(); 

    if (!bookingId || !action) {
      return NextResponse.json(
        { error: "Missing required booking identifier or operation action code." }, 
        { status: 400 }
      );
    }

    // Map your frontend UI actions to your actual database status string values 💸
    // - Approving updates the column to 'confirmed' (locking the calendar slot permanently)
    // - Denying updates the column to 'rejected' (re-opening the slot to the public)
    const targetStatus = action === "approve" ? "confirmed" : "rejected";

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