import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const { 
      villaId, 
      eventDate, 
      timeSlot, 
      paxCount, 
      packageOption, 
      includeOvernight, 
      overnightPaxCount 
    } = await request.json()

    if (!villaId || !eventDate || !timeSlot) {
      return NextResponse.json({ error: `Missing required data. Received: villaId=${villaId}, eventDate=${eventDate}, timeSlot=${timeSlot}` }, { status: 400 })
    }

    // Determine weekend_holiday (Fri-Sun) vs weekday (Mon-Thu)
    const dateObj = new Date(eventDate)
    const dayOfWeek = dateObj.getDay()
    const dayGroup = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) ? 'weekend_holiday' : 'weekday'

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('calculate_booking_quote', {
      p_villa_id: villaId,
      p_package_name: packageOption,
      p_time_of_day: timeSlot,
      p_day_group: dayGroup,
      p_pax_count: Number(paxCount),
      p_event_date: eventDate,
      p_include_overnight: Boolean(includeOvernight),
      p_overnight_pax_count: Number(overnightPaxCount)
    })

    // ❌ OLD CODE: return NextResponse.json({ error: 'Could not compute calculation values.' }, { status: 400 })
    //  NEW DEEPER DEBUGGING CODE:
    if (error) {
      return NextResponse.json({ error: `Supabase Database Error: ${error.message} (Code: ${error.code})` }, { status: 400 })
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: `Database executed but returned no rows for dayGroup: ${dayGroup}, slot: ${timeSlot}` }, { status: 404 })
    }

    const quoteResult = data[0]
    
    if (!quoteResult.is_slot_available) {
      return NextResponse.json({ error: 'This schedule slot has already been booked.' }, { status: 409 })
    }

    return NextResponse.json(quoteResult)
  } catch (err: any) {
    return NextResponse.json({ error: `Fatal Next.js API Crash: ${err.message}` }, { status: 500 })
  }
}