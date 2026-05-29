// app/api/admin/dashboard/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // 🌟 1. Fetch all pending and confirmed bookings to build metrics
    const { data: bookings, error: dbError } = await supabase
      .from("bookings")
      .select("id, customer_name, total_price, amount_paid, remaining_balance, payment_mode, status, package_option, event_date, slot_assignment, pax_count, created_at, villas(name)")
      .in("status", ["pending_verification", "confirmed"])
      .order("created_at", { ascending: false });

    if (dbError) throw dbError;

    // 🌟 2. REVENUE COMPUTATION ENGINE OVERHAUL
    // Instead of multiplying everything by 0.5 under the hood, we evaluate exact database column parameters
    let totalRevenue = 0;
    let eventBookingsCount = 0;
    let accommodationBookingsCount = 0;

    if (bookings) {
      bookings.forEach((booking) => {
        // Compute Total Collected Earnings safely
        // If the transaction is marked 'full', capture the complete gross price. 
        // Otherwise, pull the direct amount_paid value or fallback cleanly to 50% only if amount_paid is completely empty.
        let actualCollectedFunds = 0;
        if (booking.payment_mode === 'full') {
          actualCollectedFunds = Number(booking.total_price);
        } else {
          actualCollectedFunds = booking.amount_paid && Number(booking.amount_paid) > 0 
            ? Number(booking.amount_paid) 
            : Number(booking.total_price) * 0.5;
        }

        totalRevenue += actualCollectedFunds;

        // Categorize stay distributions metrics accurately
        if (booking.package_option === 'accommodation_only') {
          accommodationBookingsCount++;
        } else {
          eventBookingsCount++;
        }
      });
    }

    const metrics = {
      totalRevenue,
      totalBookingsCount: bookings ? bookings.length : 0,
      eventBookingsCount,
      accommodationBookingsCount
    };

    // Return the clean data structure straight to your front-end view ticker table components
    return NextResponse.json({ metrics, history: bookings || [] });
  } catch (error: any) {
    console.error("Dashboard calculation engine exception error log:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 🌟 3. WALK-IN CASH TRANSACTION INTAKE HANDLER
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const {
      villaId,
      customerName,
      customerPhone,
      eventDate,
      timeSlot,
      packageOption,
      totalPrice,
      paymentMode,
      amountPaid,
      remainingBalance
    } = body;

    if (!villaId || !customerName || !eventDate || !totalPrice) {
      return NextResponse.json({ error: "Missing mandatory walk-in details bounds." }, { status: 400 });
    }

    // Direct insert into bookings table ensuring database constraint schema properties align perfectly
    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          villa_id: villaId,
          customer_name: customerName,
          customer_phone: customerPhone || "",
          event_date: eventDate,
          end_date: eventDate, // Sane baseline matching single-day structures
          slot_assignment: timeSlot || "day",
          package_option: packageOption || "venue_only",
          total_price: Number(totalPrice),
          payment_mode: paymentMode || "full",
          amount_paid: Number(amountPaid),
          remaining_balance: Number(remainingBalance),
          status: "confirmed" // In-person cash skips verification queue lines entirely
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, booking: data[0] });
  } catch (error: any) {
    console.error("Walkin submission pipeline refusal error log:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}