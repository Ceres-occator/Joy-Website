// app/api/villas/[villaId]/availability/route.ts
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Extract the villa UUID directly out of the request URL path tokens
    const urlSegments = req.nextUrl.pathname.split('/');
    const villasIndex = urlSegments.indexOf('villas');
    const villaId = villasIndex !== -1 ? urlSegments[villasIndex + 1] : undefined;

    if (!villaId || !year || !month) {
      return NextResponse.json({ 
        error: `Missing mandatory calendar filter parameters. Extracted villaId: ${villaId}, year: ${year}, month: ${month}` 
      }, { status: 400 });
    }

    const supabase = await createClient();

    // Query both pending_verification and confirmed stays to map on the calendars
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("event_date, end_date, slot_assignment, package_option")
      .eq("villa_id", villaId)
      .in("status", ["pending_verification", "confirmed"]);

    if (error) throw error;

    const availability: Record<string, string[]> = {};

    if (bookings) {
      bookings.forEach((booking) => {
        // Enforce strict formatting parsing boundaries to prevent local timezone shifts
        const startDate = new Date(`${booking.event_date}T00:00:00Z`);
        const endDate = new Date(`${booking.end_date || booking.event_date}T00:00:00Z`);

        if (booking.package_option === 'accommodation_only') {
          // Dynamic date-walking loop across all booked nights
          let currentDateWalk = new Date(startDate);
          
          while (currentDateWalk <= endDate) {
            const yyyy = currentDateWalk.getUTCFullYear();
            const mm = String(currentDateWalk.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(currentDateWalk.getUTCDate()).padStart(2, '0');
            const dateString = `${yyyy}-${mm}-${dd}`;
            
            // 🌟 FIXED CALENDAR OVERLAP FILTER: 
            // If the current walking day falls into the year and month requested by the calendar UI,
            // or if month is set to 'all' by the BookingForm blockout, record it!
            const isTargetMonth = month === 'all' || String(Number(month)).padStart(2, '0') === mm;
            const isTargetYear = year === String(yyyy);

            if (isTargetYear && isTargetMonth) {
              if (!availability[dateString]) {
                availability[dateString] = [];
              }
              if (!availability[dateString].includes('day')) availability[dateString].push('day');
              if (!availability[dateString].includes('evening')) availability[dateString].push('evening');
            }
            
            currentDateWalk.setUTCDate(currentDateWalk.getUTCDate() + 1);
          }
        } else {
          // Standard single-day event mapping routines
          const dateString = booking.event_date;
          const [bYear, bMonth] = dateString.split('-');

          const isTargetMonth = month === 'all' || String(Number(month)).padStart(2, '0') === bMonth;
          const isTargetYear = year === bYear;

          if (isTargetYear && isTargetMonth) {
            if (!availability[dateString]) {
              availability[dateString] = [];
            }
            if (!availability[dateString].includes(booking.slot_assignment)) {
              availability[dateString].push(booking.slot_assignment);
            }
          }
        }
      });
    }

    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error("Availability matrix failure: ", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}