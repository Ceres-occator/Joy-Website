import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ villaId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const resolvedParams = await context.params.catch(() => ({ villaId: '' }));
    const urlSegments = req.nextUrl.pathname.split('/');
    const villasIndex = urlSegments.indexOf('villas');
    const villaId =
      resolvedParams?.villaId ||
      (villasIndex !== -1 ? urlSegments[villasIndex + 1] : undefined);

    if (!villaId || !year || !month) {
      return NextResponse.json(
        { error: 'Missing villa ID, year, or month for calendar availability.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('event_date, end_date, slot_assignment, package_option')
      .eq('villa_id', villaId)
      .in('status', ['pending_verification', 'confirmed']);

    if (error) throw error;

    const availability: Record<string, string[]> = {};

    const addSlot = (dateStr: string, slot: 'day' | 'evening') => {
      if (!availability[dateStr]) {
        availability[dateStr] = [];
      }
      if (!availability[dateStr].includes(slot)) {
        availability[dateStr].push(slot);
      }
    };

    const matchesFilter = (yyyy: string, mm: string) => {
      const isTargetYear = year === yyyy;
      const isTargetMonth = month === 'all' || String(Number(month)).padStart(2, '0') === mm;
      return isTargetYear && isTargetMonth;
    };

    if (bookings) {
      bookings.forEach((booking) => {
        if (!booking.event_date) return;

        const startDate = new Date(`${booking.event_date}T00:00:00Z`);
        const endDate = new Date(`${booking.end_date || booking.event_date}T00:00:00Z`);

        if (booking.package_option === 'accommodation_only') {
          const currentDateWalk = new Date(startDate);
          // If endDate > startDate, walk each night [startDate, endDate - 1 day];
          // if startDate === endDate, mark that single date.
          const lastNight =
            endDate > startDate
              ? new Date(endDate.getTime() - 86400000)
              : endDate;

          while (currentDateWalk <= lastNight) {
            const yyyy = String(currentDateWalk.getUTCFullYear());
            const mm = String(currentDateWalk.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(currentDateWalk.getUTCDate()).padStart(2, '0');
            const dateString = `${yyyy}-${mm}-${dd}`;

            if (matchesFilter(yyyy, mm)) {
              addSlot(dateString, 'day');
              addSlot(dateString, 'evening');
            }

            currentDateWalk.setUTCDate(currentDateWalk.getUTCDate() + 1);
          }
        } else {
          const dateString = booking.event_date;
          const [bYear, bMonth] = dateString.split('-');

          if (matchesFilter(bYear, bMonth)) {
            const slot = booking.slot_assignment === 'day' ? 'day' : 'evening';
            addSlot(dateString, slot);
          }
        }
      });
    }

    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error('Availability lookup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}