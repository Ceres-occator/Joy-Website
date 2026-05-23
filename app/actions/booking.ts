// app/actions/booking.ts
'use server'

import { createClient } from '@/utils/supabase/server' // Path to your backend supabase setup
import { getDayGroup } from '@/utils/dateHelpers'

interface QuoteRequest {
  villaId: string
  packageName: 'with_catering' | 'venue_only'
  timeOfDay: 'day' | 'evening'
  eventDate: string
  paxCount: number
  includeOvernight: boolean
  overnightPaxCount: number
}

export async function getBookingQuote(data: QuoteRequest) {
  const supabase = await createClient()
  const dayGroup = getDayGroup(data.eventDate)

  const { data: quote, error } = await supabase
    .rpc('calculate_booking_quote', {
      p_villa_id: data.villaId,
      p_package_name: data.packageName,
      p_time_of_day: data.timeOfDay,
      p_day_group: dayGroup,
      p_pax_count: data.paxCount,
      p_include_overnight: data.includeOvernight,
      p_overnight_pax_count: data.overnightPaxCount
    })

  if (error) {
    console.error('Pricing lookup failed:', error)
    throw new Error('Could not calculate pricing.')
  }

  return quote[0]
}