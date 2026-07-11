// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Instantiate the SSR Cookie Client session mapper
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set({ name, value }))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }))
        },
      },
    }
  )

  // Retrieve active session token parameter values safely
  const { data: { user } } = await supabase.auth.getUser()

  // 🛡️ SECURITY GATEWAY POLICY: 
  if (request.nextUrl.pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin-auth'
    return NextResponse.redirect(url)
  }

  // 🌟 CRITICAL FIX: Return the active mutated response instance containing the fresh session cookies!
  return response
}

export const config = {
  matcher: [
    // Tell Next.js to run this middleware across all admin routes explicitly
    '/admin/:path*',
  ],
}