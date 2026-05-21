// app/actions/booking.ts
'use server'

import { createClient } from '@/utils/supabase/server'
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

export interface BookingQuoteResponse {
  villaName: string
  base_tier_used: number
  base_rate_price: number
  excess_pax_count: number
  excess_pax_price: number
  overnight_price: number
  total_price: number
}

export async function getBookingQuote(data: QuoteRequest) {
  const supabase = await createClient()
  const dayGroup = getDayGroup(data.eventDate)

  const { data: packageData, error: packageError } = await supabase
    .from('packages')
    .select('id, excess_pax_rate')
    .eq('villa_id', data.villaId)
    .eq('name', data.packageName)
    .single()

  if (packageError || !packageData) {
    console.error('Package lookup failed:', packageError)
    throw new Error('Could not find package pricing for this villa.')
  }

  const { data: villaData, error: villaError } = await supabase
    .from('villas')
    .select('name')
    .eq('id', data.villaId)
    .single()

  if (villaError) {
    console.error('Villa lookup failed:', villaError)
  }

  const { data: rateTier, error: rateError } = await supabase
    .from('rate_tiers')
    .select('base_pax, price')
    .eq('package_id', packageData.id)
    .eq('time_of_day', data.timeOfDay)
    .eq('day_group', dayGroup)
    .lte('base_pax', data.paxCount)
    .order('base_pax', { ascending: false })
    .limit(1)
    .single()

  if (rateError || !rateTier) {
    console.error('Rate tier lookup failed:', rateError)
    throw new Error('Could not calculate pricing for the selected package and date.')
  }

  const baseTier = Number(rateTier.base_pax)
  const baseRatePrice = Number(rateTier.price)
  const excessPaxCount = Math.max(0, data.paxCount - baseTier)
  const excessPaxPrice = excessPaxCount * Number(packageData.excess_pax_rate)
  const overnightPrice = data.includeOvernight ? Number(data.overnightPaxCount) * 0 : 0
  const totalPrice = baseRatePrice + excessPaxPrice + overnightPrice

  return {
    villaName: villaData?.name ?? '',
    base_tier_used: baseTier,
    base_rate_price: baseRatePrice,
    excess_pax_count: excessPaxCount,
    excess_pax_price: excessPaxPrice,
    overnight_price: overnightPrice,
    total_price: totalPrice,
  } as BookingQuoteResponse
}
