import { z } from 'zod';

/**
 * Strict XSS-prevention regex: forbids `<` and `>` HTML tag delimiters.
 */
export const NO_HTML_REGEX = /^[^<>]*$/;

/**
 * Strict E.164 international phone number regex:
 * Leading `+`, followed by country/subscriber digits (1-15 digits total, no leading 0 after +).
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * ISO 8601 calendar date format (YYYY-MM-DD) or range ("YYYY-MM-DD to YYYY-MM-DD").
 */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_OR_RANGE_REGEX = /^\d{4}-\d{2}-\d{2}(\s+to\s+\d{4}-\d{2}-\d{2})?$/;

/**
 * Helper to normalize phone whitespace before strict E.164 validation.
 * Converts local Philippine mobile numbers (`09XXXXXXXXX`) to `+639XXXXXXXXX` if needed,
 * then enforces strict E.164 `/^\+[1-9]\d{1,14}$/`.
 */
export function normalizeToE164(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const stripped = raw.replace(/[\s()-]/g, '').trim();
  if (/^09\d{9}$/.test(stripped)) {
    return `+63${stripped.slice(1)}`;
  }
  return stripped;
}

/**
 * Reusable sanitized text field that strips leading/trailing whitespace and rejects HTML tags.
 */
export const safeTextField = (fieldName: string, minLen = 1, maxLen = 200) =>
  z
    .string()
    .trim()
    .min(minLen, `${fieldName} is required.`)
    .max(maxLen, `${fieldName} must be at most ${maxLen} characters.`)
    .regex(NO_HTML_REGEX, `${fieldName} must not contain HTML tags (< or >).`);

/**
 * Optional email field: empty string / null / undefined becomes undefined;
 * if provided, strictly validated as a valid email address with no HTML tags.
 */
export const optionalEmailSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string' && val.trim() === '') return undefined;
    return typeof val === 'string' ? val.trim() : val;
  },
  z
    .string()
    .max(254, 'Email address is too long.')
    .email('Please provide a valid email address.')
    .regex(NO_HTML_REGEX, 'Email must not contain HTML tags.')
    .optional()
);

/**
 * Core Booking Form & API Submission Schema
 * Enforces:
 * - No-HTML regex (/^[^<>]*$/) on names and special requests
 * - Strict E.164 phone format (/^\+[1-9]\d{1,14}$/)
 * - Optional, strictly validated email
 * - UUID validation on villaId
 * - .coerce.number() on guest counts (adults, children, extraGuests, paxCount, overnightPaxCount)
 * - .refine() check ensuring checkOutDate > checkInDate
 */
export const BookingSchema = z
  .object({
    villaId: z.string().trim().uuid('Villa ID must be a valid UUID.'),

    fullName: safeTextField('Full name', 2, 120),

    phone: z.preprocess(
      normalizeToE164,
      z
        .string()
        .regex(
          E164_PHONE_REGEX,
          'Phone number must be in international E.164 format (e.g., +639171234567).'
        )
    ),

    email: optionalEmailSchema,

    specialRequests: z
      .preprocess(
        (val) => (val === null || val === undefined ? '' : String(val).trim()),
        z
          .string()
          .max(1000, 'Special requests must not exceed 1,000 characters.')
          .regex(NO_HTML_REGEX, 'Special requests must not contain HTML tags (< or >).')
      )
      .optional()
      .default(''),

    // Guest count fields using .coerce.number() with min/max constraints
    adults: z.coerce
      .number()
      .int('Adults count must be a whole number.')
      .min(1, 'At least 1 adult guest is required.')
      .max(300, 'Adults count cannot exceed 300.')
      .default(1),

    children: z.coerce
      .number()
      .int('Children count must be a whole number.')
      .min(0, 'Children count cannot be negative.')
      .max(200, 'Children count cannot exceed 200.')
      .default(0),

    extraGuests: z.coerce
      .number()
      .int('Extra guests count must be a whole number.')
      .min(0, 'Extra guests cannot be negative.')
      .max(200, 'Extra guests cannot exceed 200.')
      .default(0),

    paxCount: z.coerce
      .number()
      .int('Total guest count must be a whole number.')
      .min(1, 'At least 1 guest is required.')
      .max(500, 'Guest count cannot exceed 500.')
      .optional(),

    selectedBasePaxTier: z.coerce
      .number()
      .int()
      .min(0)
      .max(500)
      .optional(),

    includeOvernight: z.coerce.boolean().optional().default(false),

    overnightPaxCount: z.coerce
      .number()
      .int()
      .min(0, 'Overnight guests cannot be negative.')
      .max(200, 'Overnight guests cannot exceed 200.')
      .default(0),

    // Dates: supports explicit checkInDate/checkOutDate and/or eventDate ("YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD")
    checkInDate: z
      .string()
      .trim()
      .regex(ISO_DATE_REGEX, 'Check-in date must be in YYYY-MM-DD format.')
      .optional(),

    checkOutDate: z
      .string()
      .trim()
      .regex(ISO_DATE_REGEX, 'Check-out date must be in YYYY-MM-DD format.')
      .optional(),

    eventDate: z
      .string()
      .trim()
      .regex(ISO_DATE_OR_RANGE_REGEX, 'Event date must be a valid YYYY-MM-DD date or range.')
      .optional(),

    timeSlot: z
      .string()
      .trim()
      .regex(NO_HTML_REGEX, 'Invalid time slot.')
      .optional()
      .default('day'),

    packageOption: z
      .enum(['with_catering', 'venue_only', 'without_catering', 'accommodation_only'])
      .optional()
      .default('with_catering'),

    paymentMode: z.enum(['half', 'full']).optional().default('half'),

    paymentGateway: z.enum(['paymongo', 'manual', 'cash']).optional().default('manual'),

    paymentChannel: z
      .string()
      .trim()
      .max(60)
      .regex(NO_HTML_REGEX, 'Invalid payment channel.')
      .optional()
      .nullable(),

    accountName: z
      .preprocess(
        (val) => (val === null || val === undefined ? undefined : String(val).trim()),
        z
          .string()
          .max(120, 'Account name is too long.')
          .regex(NO_HTML_REGEX, 'Account name must not contain HTML tags (< or >).')
          .optional()
      ),

    referenceNumber: z
      .preprocess(
        (val) => (val === null || val === undefined ? undefined : String(val).trim()),
        z
          .string()
          .max(120, 'Reference number is too long.')
          .regex(NO_HTML_REGEX, 'Reference number must not contain HTML tags (< or >).')
          .optional()
      ),

    receiptFilePath: z
      .preprocess(
        (val) => (val === null || val === undefined ? undefined : String(val).trim()),
        z
          .string()
          .max(300)
          .regex(/^[a-zA-Z0-9/_.-]*$/, 'Invalid receipt storage path.')
          .optional()
      ),

    idFilePath: z
      .preprocess(
        (val) => (val === null || val === undefined ? undefined : String(val).trim()),
        z
          .string()
          .max(300)
          .regex(/^[a-zA-Z0-9/_.-]*$/, 'Invalid ID storage path.')
          .optional()
      ),
  })
  .refine(
    (data) => {
      // Must provide either checkInDate or eventDate
      return Boolean(data.checkInDate || data.eventDate);
    },
    {
      message: 'A valid check-in date or event date is required.',
      path: ['checkInDate'],
    }
  )
  .refine(
    (data) => {
      // 1. If explicit checkInDate and checkOutDate are provided, checkOutDate must be strictly after checkInDate
      if (data.checkInDate && data.checkOutDate) {
        const start = new Date(`${data.checkInDate}T00:00:00Z`);
        const end = new Date(`${data.checkOutDate}T00:00:00Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return end.getTime() > start.getTime();
      }

      // 2. If eventDate contains a date range ("YYYY-MM-DD to YYYY-MM-DD"), end date must be strictly after start date
      if (data.eventDate && data.eventDate.includes(' to ')) {
        const [rawStart, rawEnd] = data.eventDate.split(' to ').map((s) => s.trim());
        const start = new Date(`${rawStart}T00:00:00Z`);
        const end = new Date(`${rawEnd}T00:00:00Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return end.getTime() > start.getTime();
      }

      // 3. If packageOption is accommodation_only without a range, require checkOutDate > checkInDate
      if (data.packageOption === 'accommodation_only' && data.checkInDate && !data.checkOutDate) {
        return false;
      }

      return true;
    },
    {
      message: 'Check-out date must be strictly after check-in date.',
      path: ['checkOutDate'],
    }
  );

export type ValidatedBookingInput = z.infer<typeof BookingSchema>;

/**
 * Schema for initializing a PayMongo Checkout Session (`/api/paymongo/checkout`).
 * Note: The server recalculates the authoritative total and deposit from Supabase
 * rather than trusting client-supplied prices.
 */
export const PaymongoCheckoutSchema = z.object({
  bookingId: z.string().trim().uuid('Booking ID must be a valid UUID.'),
  phase: z
    .enum(['downpayment', 'full_payment', 'catering_payment', 'balance_settlement', 'follow_up'])
    .default('downpayment'),
  preferredChannel: z
    .enum(['chinabank', 'qrph', 'gcash', 'paymaya', 'card', 'dob', 'brankas'])
    .optional()
    .default('chinabank'),
  /**
   * Optional client-requested installment/custom amount (only honored when >= required minimum
   * and <= authoritative remaining balance calculated on the server).
   */
  amount: z.coerce.number().min(0).max(10_000_000).optional(),
  successRedirectPath: z
    .string()
    .trim()
    .regex(/^\/[a-zA-Z0-9/_-]*$/, 'Redirect path must be a relative internal path.')
    .optional(),
  cancelRedirectPath: z
    .string()
    .trim()
    .regex(/^\/[a-zA-Z0-9/_-]*$/, 'Redirect path must be a relative internal path.')
    .optional(),
});

export type ValidatedPaymongoCheckoutInput = z.infer<typeof PaymongoCheckoutSchema>;

/**
 * Schema for IDOR-protected Guest Booking Lookup (`/api/booking/lookup`).
 */
export const GuestLookupSchema = z.object({
  guestId: z
    .string()
    .trim()
    .min(4, 'Booking reference code is required.')
    .max(32, 'Booking reference code is too long.')
    .regex(/^[A-Za-z0-9#-]+$/, 'Invalid booking reference code format.'),
  bookingId: z.string().trim().uuid().optional(),
});
