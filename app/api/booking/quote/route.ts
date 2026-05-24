// app/api/booking/quote/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      villaId, 
      eventDate, 
      timeSlot, 
      paxCount, 
      packageOption 
    } = body;

    if (!villaId || !eventDate || !timeSlot) {
      return NextResponse.json({ error: 'Missing calculation criteria targets.' }, { status: 400 });
    }

    const supabase = await createClient();

    // 🌟 1. ADVANCED SLOT OVERLAP VERIFICATION (Protects Accommodation Stays)
    // If renting accommodation, it blocks both slots. If booking a single slot, it catches existing accommodation blocks.
    const isAccommodation = packageOption === 'accommodation_only';
    
    let bookingQuery = supabase
      .from('bookings')
      .select('id, package_option, slot_assignment')
      .eq('villa_id', villaId)
      .eq('event_date', eventDate)
      .in('status', ['pending_verification', 'confirmed']);

    // If customer is only searching for a single slot, but an active whole-villa accommodation block exists, flag conflict
    if (!isAccommodation) {
      bookingQuery = bookingQuery.or(`slot_assignment.eq.${timeSlot},package_option.eq.accommodation_only`);
    }

    const { data: overlappingBookings } = await bookingQuery;

    if (overlappingBookings && overlappingBookings.length > 0) {
      return NextResponse.json(
        { error: 'This schedule date/slot has already been reserved or locked by an accommodation stay.' },
        { status: 409 } 
      );
    }

    // 🌟 2. FIX: SAFE TIMEZONE-AGNOSTIC CALENDAR DAY MATCHING
    // Split the 'YYYY-MM-DD' string directly by parts to completely isolate server/client UTC variations
    const [year, month, day] = eventDate.split('-').map(Number);
    const localDateObject = new Date(year, month - 1, day);
    const dayOfWeek = localDateObject.getDay(); 

    // In local layout metrics, Friday (5), Saturday (6), and Sunday (0) represent weekend blocks
    const dayGroup = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) 
      ? 'weekend_holiday' 
      : 'weekday';

    // 🌟 3. FETCH VILLA PACKAGE DEFINITION SCHEMA
    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .select('id, excess_pax_rate')
      .eq('villa_id', villaId)
      .eq('name', packageOption)
      .maybeSingle();

    if (packageError || !packageData) {
      return NextResponse.json({ 
        error: `The selected package option (${packageOption}) is not configured for this villa.` 
      }, { status: 404 });
    }

    // 🌟 4. QUERY STRUCTURAL RATE TIERS WITH SAFE FALLBACK
    // Accommodation stays often don't have distinct day/evening entries since they represent full stays.
    // If 'evening' slot is queried for accommodation but empty, fallback to evaluate against 'day' rate metrics.
    let targetSlotQuery = timeSlot;
    
    let { data: rateTiers, error: tierError } = await supabase
      .from('rate_tiers')
      .select('base_pax, price, time_of_day')
      .eq('package_id', packageData.id)
      .eq('time_of_day', targetSlotQuery)
      .eq('day_group', dayGroup)
      .order('base_pax', { ascending: true });

    // Fallback trigger mechanism to save you from 404 blockages during booking tests
    if ((!rateTiers || rateTiers.length === 0) && isAccommodation && timeSlot === 'evening') {
      targetSlotQuery = 'day'; // Fallback look up to evaluate baseline pricing maps
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
      return NextResponse.json({ 
        error: 'No matching base rate tier found for this schedule, package, and slot configuration.' 
      }, { status: 404 });
    }

    // 🌟 5. EXPAND CORRESPONDING PASSENGER BRACKET MATRIX
    let matchedTier = rateTiers[0]; 
    for (const tier of rateTiers) {
      matchedTier = tier;
      if (Number(paxCount) <= tier.base_pax) {
        break; 
      }
    }

    // Compute numerical invoice values
    const baseRatePrice = Number(matchedTier.price);
    const excessPaxCount = Math.max(0, Number(paxCount) - matchedTier.base_pax);
    const excessPaxPrice = excessPaxCount * Number(packageData.excess_pax_rate || 0);

    // Dynamic clean-up infrastructure multiplier surcharge rules
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
      is_slot_available: true
    });

  } catch (err: any) {
    console.error("Quote computation system failure:", err);
    return NextResponse.json({ error: `Quotation Processing Error: ${err.message}` }, { status: 500 });
  }
}