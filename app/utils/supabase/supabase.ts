import { createClient } from '@supabase/supabase-js'

// Use this for Server Components / API Routes
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
