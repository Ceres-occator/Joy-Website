import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getDayGroup } from '@/utils/dateHelpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { villaId, eventDate, timeSlot, paxCount, packageOption } = body;

    if (!villaId || !eventDate || !timeSlot) {
      return NextResponse.json(
        { error: 'Please select a venue, date, and time slot.' },
        { status: 400 }
      );
    }

    const normalizedSlot: 'day' | 'evening' = String(timeSlot).toLowerCase().includes('day')
      ? 'day'
      : 'evening';

    const supabase = await createClient();
    const isAccommodation = packageOption === 'accommodation_only';

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

    if (overlappingBookings && overlappingBookings.length > 0) {
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