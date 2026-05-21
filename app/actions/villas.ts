'use server'

import { createClient } from '@/utils/supabase/server'

export interface VillaListItem {
  id: string
  name: string
  description: string | null
  location_id?: string | null
  location?: {
    name: string
  }[] | null
}

export async function getVillas() {
  const supabase = await createClient()

  // Try with location relation first
  let { data: villas, error } = await supabase
    .from('villas')
    .select('id, name, description, location_id, location:locations(name)')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching villas with location relation:', error)
    // Fallback: fetch villas without location relation
    const { data: villasWithoutLocation, error: fallbackError } = await supabase
      .from('villas')
      .select('id, name, description, location_id')
      .order('name', { ascending: true })

    if (fallbackError) {
      console.error('Error fetching villas:', fallbackError)
      throw new Error('Could not load villas.')
    }
    villas = villasWithoutLocation as any
  }

  if (!villas) {
    throw new Error('No villas found.')
  }

  return villas as VillaListItem[]
}

export async function getVillaById(id: string) {
  const supabase = await createClient()

  console.log('Fetching villa with ID:', id)

  // Try with location relation first
  let { data: villa, error } = await supabase
    .from('villas')
    .select('id, name, description, location_id, location:locations(name)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching villa with location relation:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    // Fallback: fetch villa without location relation
    const { data: villaWithoutLocation, error: fallbackError } = await supabase
      .from('villas')
      .select('id, name, description, location_id')
      .eq('id', id)
      .single()

    if (fallbackError) {
      console.error('Error fetching villa (fallback):', {
        code: fallbackError.code,
        message: fallbackError.message,
        details: fallbackError.details,
        hint: fallbackError.hint,
      })
      throw new Error(`Could not load villa. Error: ${fallbackError.message}`)
    }
    villa = villaWithoutLocation as any
  }

  if (!villa) {
    throw new Error('Villa not found.')
  }

  console.log('Successfully fetched villa:', villa)
  return villa as VillaListItem | null
}

export async function getVillaStartingPrice(villaId: string): Promise<number | null> {
  const supabase = await createClient()

  // First, get all packages for this villa
  const { data: packages, error: packageError } = await supabase
    .from('packages')
    .select('id')
    .eq('villa_id', villaId)

  if (packageError || !packages || packages.length === 0) {
    return null
  }

  const packageIds = packages.map((p) => p.id)

  // Then, get the minimum rate tier price across all packages
  const { data: minRate, error: rateError } = await supabase
    .from('rate_tiers')
    .select('price')
    .in('package_id', packageIds)
    .order('price', { ascending: true })
    .limit(1)
    .single()

  if (rateError || !minRate) {
    return null
  }

  return Number(minRate.price)
}
