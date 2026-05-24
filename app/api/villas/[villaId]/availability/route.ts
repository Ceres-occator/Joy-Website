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

  // Fetch all non-cancelled bookings for the specified month
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = `${year}-${month.padStart(2, '0')}-31`; // Postgres safely handles out-of-range dates

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("event_date, slot_assignment")
    .eq("villa_id", villaId)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reduce bookings into a clean lookup dictionary mapping dates to occupied slots
  const availabilityMap = bookings.reduce((acc: Record<string, string[]>, booking) => {
    const dateStr = booking.event_date;
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(booking.slot_assignment); // e.g., 'day' or 'evening'
    return acc;
  }, {});

  return NextResponse.json({ availability: availabilityMap });
}