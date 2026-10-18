import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { getDayGroup } from '@/utils/dateHelpers';
import { enforceRateLimit, RATE_LIMIT_PROFILES } from '@/utils/rateLimit';

const QuoteSchema = z.object({
  villaId: z.string().trim().uuid('Villa ID must be a valid UUID.'),
  eventDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().trim(),
  paxCount: z.coerce.number().int().min(1).max(500).default(1),
  packageOption: z.enum(['with_catering', 'venue_only', 'without_catering', 'accommodation_only']),
});

export async function POST(request: Request) {
  try {
    const rateLimitRes = enforceRateLimit(request, RATE_LIMIT_PROFILES.BOOKING_LOOKUP_AND_QUOTE);
    if (rateLimitRes) return rateLimitRes;

    const rawBody = await request.json().catch(() => null);
    const parsed = QuoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Please select a venue, date, and time slot.' },
        { status: 400 }
      );
    }

    const { villaId, eventDate, timeSlot, paxCount, packageOption } = parsed.data;

    const normalizedSlot: 'day' | 'evening' = String(timeSlot).toLowerCase().includes('day')
      ? 'day'
      : 'evening';

    const supabase = await createClient();
    const isAccommodation = packageOption === 'accommodation_only';

    const { data: rpcSlots, error: rpcErr } = await supabase.rpc('get_villa_booked_slots', {
      p_villa_id: villaId,
    });

    let hasOverlap = false;
    if (!rpcErr && Array.isArray(rpcSlots)) {
      hasOverlap = rpcSlots.some(
        (b: any) =>
          b.event_date === eventDate &&
          (isAccommodation ||
            b.package_option === 'accommodation_only' ||
            b.slot_assignment === normalizedSlot)
      );
    } else {
      let bookingQuery = supabase
        .from('bookings')
        .select('id, package_option, slot_assignment')
        .eq('villa_id', villaId)
        .eq('event_date', eventDate)
        .in('status', ['pending_verification', 'confirmed']);

      if (!isAccommodation) {
        bookingQuery = bookingQuery.or(
          `slot_assignment.eq.${normalizedSlot},package_option.eq.accommodation_only`
        );
      }

      const { data: overlappingBookings } = await bookingQuery;
      hasOverlap = Boolean(overlappingBookings && overlappingBookings.length > 0);
    }

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'This date and time slot is already booked. Please choose another date or slot.' },
        { status: 409 }
      );
    }

    const dayGroup = getDayGroup(eventDate);

    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .select('id, excess_pax_rate')
      .eq('villa_id', villaId)
      .eq('name', packageOption)
      .maybeSingle();

    if (packageError || !packageData) {
      return NextResponse.json(
        { error: 'The selected package is not available for this venue.' },
        { status: 404 }
      );
    }

    let targetSlotQuery: 'day' | 'evening' = normalizedSlot;

    let { data: rateTiers, error: tierError } = await supabase
      .from('rate_tiers')
      .select('base_pax, price, time_of_day')
      .eq('package_id', packageData.id)
      .eq('time_of_day', targetSlotQuery)
      .eq('day_group', dayGroup)
      .order('base_pax', { ascending: true });

    if ((!rateTiers || rateTiers.length === 0) && isAccommodation && normalizedSlot === 'evening') {
      targetSlotQuery = 'day';
      const fallbackResult = await supabase
        .from('rate_tiers')
        .select('base_pax, price, time_of_day')
        .eq('package_id', packageData.id)
        .eq('time_of_day', targetSlotQuery)
        .eq('day_group', dayGroup)
        .order('base_pax', { ascending: true });

      rateTiers = fallbackResult.data;
      tierError = fallbackResult.error;
    }

    if (tierError || !rateTiers || rateTiers.length === 0) {
      return NextResponse.json(
        { error: 'No rate found for the selected package, date, and time slot.' },
        { status: 404 }
      );
    }

    let matchedTier = rateTiers[0];
    for (const tier of rateTiers) {
      matchedTier = tier;
      if (Number(paxCount) <= tier.base_pax) {
        break;
      }
    }

    const baseRatePrice = Number(matchedTier.price);
    const excessPaxCount = Math.max(0, Number(paxCount) - matchedTier.base_pax);
    const excessPaxPrice = excessPaxCount * Number(packageData.excess_pax_rate || 0);
    const cleanupFee = isAccommodation ? 500 : 0;
    const computedTotal = baseRatePrice + excessPaxPrice + cleanupFee;

    return NextResponse.json({
      success: true,
      base_tier_used: matchedTier.base_pax,
      base_rate_price: baseRatePrice,
      excess_pax_count: excessPaxCount,
      excess_pax_price: excessPaxPrice,
      overnight_price: 0,
      total_price: computedTotal,
      is_slot_available: true,
    });
  } catch (err: any) {
    console.error('Quote calculation error:', err);
    return NextResponse.json(
      { error: err.message || 'Could not calculate booking quote.' },
      { status: 500 }
    );
  }
}