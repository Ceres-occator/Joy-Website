import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  /** Unique bucket identifier (e.g. 'booking-confirm', 'paymongo-checkout', 'notifications-send') */
  namespace: string;
  /** Maximum allowed requests within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
}

interface SlidingWindowEntry {
  timestamps: number[];
  expiresAt: number;
}

const rateLimitStore = new Map<string, SlidingWindowEntry>();
let lastCleanupMs = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanupMs < CLEANUP_INTERVAL_MS) return;
  lastCleanupMs = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Extracts the client IP address from standard proxy headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Evaluates a sliding-window rate limit for a given client IP and endpoint namespace.
 */
export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const key = `${config.namespace}:${ip}`;
  const windowStart = now - config.windowMs;

  const existing = rateLimitStore.get(key);
  const activeTimestamps = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (activeTimestamps.length >= config.limit) {
    const oldestInWindow = activeTimestamps[0] || now;
    const resetAtMs = oldestInWindow + config.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));

    rateLimitStore.set(key, {
      timestamps: activeTimestamps,
      expiresAt: now + config.windowMs,
    });

    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAtMs,
      retryAfterSeconds,
    };
  }

  activeTimestamps.push(now);
  rateLimitStore.set(key, {
    timestamps: activeTimestamps,
    expiresAt: now + config.windowMs,
  });

  const remaining = Math.max(0, config.limit - activeTimestamps.length);
  const resetAtMs = (activeTimestamps[0] || now) + config.windowMs;

  return {
    allowed: true,
    limit: config.limit,
    remaining,
    resetAtMs,
    retryAfterSeconds: 0,
  };
}

/**
 * Enforces rate limiting on a Next.js Request / NextRequest.
 * Returns a `429 Too Many Requests` NextResponse if rate-limited, or `null` if allowed.
 */
export function enforceRateLimit(
  request: Request,
  config: RateLimitConfig
): NextResponse | null {
  const ip = getClientIp(request);
  const result = checkRateLimit(ip, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Predefined rate-limit profiles for sensitive booking, payment, and notification endpoints.
 */
export const RATE_LIMIT_PROFILES = {
  /** Booking creation: max 5 submissions per minute per IP */
  BOOKING_SUBMIT: {
    namespace: 'api:booking:confirm',
    limit: 5,
    windowMs: 60_000,
  },
  /** PayMongo checkout session initialization: max 8 requests per minute per IP */
  PAYMONGO_CHECKOUT: {
    namespace: 'api:paymongo:checkout',
    limit: 8,
    windowMs: 60_000,
  },
  /** SMS & Email notification dispatch (Textbee / Resend): max 5 requests per minute per IP */
  NOTIFICATION_SEND: {
    namespace: 'api:notifications:send',
    limit: 5,
    windowMs: 60_000,
  },
  /** Guest booking lookup & quote calculation: max 20 requests per minute per IP */
  BOOKING_LOOKUP_AND_QUOTE: {
    namespace: 'api:booking:lookup',
    limit: 20,
    windowMs: 60_000,
  },
} as const;

