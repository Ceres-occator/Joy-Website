// app/actions/villas.ts
'use server'

import { createClient } from '@/utils/supabase/server'

export async function getVillas() {
  const supabase = await createClient()

  const { data: villas, error } = await supabase
    .from('villas')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching villas:', error)
    throw new Error('Could not load villas.')
  }

  return villas
}