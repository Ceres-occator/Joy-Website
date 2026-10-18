import { type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { enforceRateLimit, RATE_LIMIT_PROFILES } from '@/utils/rateLimit';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply sliding-window rate limiting on sensitive API routes before hitting database or 3rd-party APIs
  if (request.method === 'POST') {
    if (pathname.startsWith('/api/booking/confirm')) {
      const rateLimitResponse = enforceRateLimit(request, {
        ...RATE_LIMIT_PROFILES.BOOKING_SUBMIT,
        namespace: 'proxy:booking:confirm',
      });
      if (rateLimitResponse) return rateLimitResponse;
    } else if (pathname.startsWith('/api/paymongo/checkout')) {
      const rateLimitResponse = enforceRateLimit(request, {
        ...RATE_LIMIT_PROFILES.PAYMONGO_CHECKOUT,
        namespace: 'proxy:paymongo:checkout',
      });
      if (rateLimitResponse) return rateLimitResponse;
    } else if (pathname.startsWith('/api/notifications/send')) {
      const rateLimitResponse = enforceRateLimit(request, {
        ...RATE_LIMIT_PROFILES.NOTIFICATION_SEND,
        namespace: 'proxy:notifications:send',
      });
      if (rateLimitResponse) return rateLimitResponse;
    } else if (
      pathname.startsWith('/api/booking/quote') ||
      pathname.startsWith('/api/booking/lookup')
    ) {
      const rateLimitResponse = enforceRateLimit(request, {
        ...RATE_LIMIT_PROFILES.BOOKING_LOOKUP_AND_QUOTE,
        namespace: 'proxy:booking:lookup',
      });
      if (rateLimitResponse) return rateLimitResponse;
    }
  }

  // Enforce Supabase session refresh & admin route separation for /admin/* and /api/admin/*
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/notifications/send')
  ) {
    return updateSession(request);
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/booking/:path*',
    '/api/paymongo/checkout',
    '/api/notifications/:path*',
  ],
};