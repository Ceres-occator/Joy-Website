import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const VillaIdSchema = z.string().trim().uuid('Villa ID must be a valid UUID.');

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
    const rawVillaId =
      resolvedParams?.villaId ||
      (villasIndex !== -1 ? urlSegments[villasIndex + 1] : undefined);

    if (!rawVillaId || !year || !month) {
      return NextResponse.json(
        { error: 'Missing villa ID, year, or month for calendar availability.' },
        { status: 400 }
      );
    }

    const parsedVillaId = VillaIdSchema.safeParse(rawVillaId);
    if (!parsedVillaId.success) {
      return NextResponse.json({ error: 'Invalid Villa UUID.' }, { status: 400 });
    }
    const villaId = parsedVillaId.data;

    const supabase = await createClient();

    // Use non-PII SECURITY DEFINER RPC `get_villa_booked_slots` (with fallback)
    let bookings: Array<{
      event_date: string;
      end_date: string | null;
      slot_assignment: string;
      package_option: string;
    }> = [];

    const { data: rpcSlots, error: rpcErr } = await supabase.rpc('get_villa_booked_slots', {
      p_villa_id: villaId,
    });

    if (!rpcErr && Array.isArray(rpcSlots)) {
      bookings = rpcSlots;
    } else {
      const { data: directBookings, error } = await supabase
        .from('bookings')
        .select('event_date, end_date, slot_assignment, package_option')
        .eq('villa_id', villaId)
        .in('status', ['pending_verification', 'confirmed']);

      if (error) throw error;
      bookings = directBookings || [];
    }

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

    bookings.forEach((booking) => {
      if (!booking.event_date) return;

      const startDate = new Date(`${booking.event_date}T00:00:00Z`);
      const endDate = new Date(`${booking.end_date || booking.event_date}T00:00:00Z`);

      if (booking.package_option === 'accommodation_only') {
        const currentDateWalk = new Date(startDate);
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

    return NextResponse.json({ availability });
  } catch (error: any) {
    console.error('Availability lookup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}