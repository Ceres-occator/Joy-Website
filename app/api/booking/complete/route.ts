// Example snippet for app/api/booking/quote/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDayGroup } from '@/utils/dateHelpers' // The utility we wrote earlier

export async function POST(request: Request) {
  try {
    const { villaId, schedule, paxCount, packageOption, includeOvernight, overnightPaxCount } = await request.json()

    // 1. Split Date and determine if Time represents Day or Evening
    const eventDate = schedule.split('T')[0]
    const timeString = schedule.split('T')[1]
    const hour = parseInt(timeString.split(':')[0], 10)
    const timeOfDay = hour >= 17 ? 'evening' : 'day'
    
    // 2. Parse day group (weekend vs weekday)
    const dayGroup = getDayGroup(eventDate)

    const supabase = await createClient()
    
    // 3. Request data directly via RPC execution
    const { data, error } = await supabase.rpc('calculate_booking_quote', {
      p_villa_id: villaId,
      p_package_name: packageOption,
      p_time_of_day: timeOfDay,
      p_day_group: dayGroup,
      p_pax_count: paxCount,
      p_include_overnight: includeOvernight,
      p_overnight_pax_count: overnightPaxCount
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Return the first element of the row output pipeline directly
    return NextResponse.json(data[0])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}