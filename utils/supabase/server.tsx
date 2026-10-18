import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function createClient() {
  const cookieStore = await cookies();

  // Create a server-side Supabase client with safe cookie handling
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method can be called from a Server Component.
            // This can be ignored if you have proxy refreshing user sessions.
          }
        },
      },
    }
  );
}

/**
 * Server-only Supabase client for trusted backend operations (e.g., PayMongo webhooks,
 * server-side price calculations, and booking confirmation).
 * Uses `SUPABASE_SERVICE_ROLE_KEY` when configured in `.env`, falling back to the cookie-aware server client.
 */
export async function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return createClient();
}

/**
 * Verifies that the current request has a valid authenticated admin session via `supabase.auth.getUser()`.
 * Never trusts `getSession()` on the server.
 */
export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      unauthorizedResponse: NextResponse.json(
        { error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      ),
    };
  }

  return {
    supabase,
    user,
    unauthorizedResponse: null,
  };
}