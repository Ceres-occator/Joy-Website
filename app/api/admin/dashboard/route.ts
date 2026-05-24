// app/api/admin/dashboard/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch all processed bookings to compute historical metrics
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, total_price, status, package_option, created_at, customer_name, event_date")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 📊 Execute Analytical Array Reductions
    const confirmedBookings = bookings.filter(b => b.status === "confirmed" || b.status === "completed");
    
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);
    const totalBookingsCount = confirmedBookings.length;

    // Filter by product line distributions
    const eventBookingsCount = confirmedBookings.filter(b => b.package_option !== "accommodation_only").length;
    const accommodationBookingsCount = confirmedBookings.filter(b => b.package_option === "accommodation_only").length;

    return NextResponse.json({
      metrics: {
        totalRevenue,
        totalBookingsCount,
        eventBookingsCount,
        accommodationBookingsCount,
      },
      history: bookings.slice(0, 50) // Return the recent 50 transactions ledger lines
    });

  } catch (error: any) {
    console.error("Dashboard analytics compilation exception:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const { villaId, customerName, customerPhone, eventDate, timeSlot, packageOption, totalPrice } = body;

    if (!villaId || !customerName || !eventDate || !timeSlot || !packageOption || !totalPrice) {
      return NextResponse.json({ error: "Missing vital walk-in parameters." }, { status: 400 });
    }

    // 💸 Create manual Cash Walk-in entry bypassing receipt validation steps
    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          villa_id: villaId,
          event_date: eventDate,
          slot_assignment: timeSlot,
          customer_name: customerName,
          customer_phone: customerPhone || "N/A",
          pax_count: 50, // Sane baseline multiplier fallback
          package_option: packageOption,
          include_overnight: false,
          overnight_pax_count: 0,
          total_price: Number(totalPrice),
          reference_number: `CASH-${Date.now().toString().slice(-6)}`, // Auto-generated reference string
          account_name: "In-Person Cash Payment",
          status: "confirmed", // Confirmed instantly to lock out the availability calendar!
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, booking: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}