// app/api/villas/[villaId]/availability/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ villaId: string }> }
) {
  const { villaId } = await params;
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || String(new Date().getFullYear());
  const month = searchParams.get("month") || String(new Date().getMonth() + 1);

  const supabase = await createClient();

  // Fetch only active, un-archived reservations for the specified month 💸
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("event_date, slot_assignment")
    .eq("villa_id", villaId)
    .in("status", ["pending_verification", "confirmed"]); // 👈 Keeps completed/rejected out of the map!

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const availabilityMap = bookings.reduce((acc: Record<string, string[]>, booking) => {
    const dateStr = booking.event_date;
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(booking.slot_assignment);
    return acc;
  }, {});

  return NextResponse.json({ availability: availabilityMap });
} 