import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set({ name, value })
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicFaqRead =
    pathname === '/api/admin/faqs' && request.method === 'GET';

  // Block unauthenticated API requests to /api/admin/* (except public FAQ GET) and /api/notifications/send
  if (
    !isPublicFaqRead &&
    (pathname.startsWith('/api/admin') || pathname.startsWith('/api/notifications/send')) &&
    !user
  ) {
    return NextResponse.json(
      { error: 'Unauthorized: Authenticated admin session required.' },
      { status: 401 }
    );
  }

  // Redirect unauthenticated browser visits to /admin/* to login page
  if (pathname.startsWith('/admin') && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin-auth';
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const createClient = updateSession;