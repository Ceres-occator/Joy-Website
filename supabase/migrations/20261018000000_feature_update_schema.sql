-- ============================================================================
-- JOY'S EVENTS AND PARTY PLACE — SUPABASE SCHEMA MIGRATION
-- Features:
--   1. Dynamic Deposit, Cancellation Forfeiture, and Catering Deadline Rules
--   2. PayMongo + Manual + Walk-In Cash Multi-Phase Payment Tracking & Refunds
--   3. Textbee SMS & Resend Email Notification / Receipt Audit Logs
--   4. OpenFreeMap Coordinates on Villas & Locations
--   5. Automatic Catering Deadline & Cancellation Forfeiture Functions
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SYSTEM SETTINGS TABLE (Admin-Editable Business Logic Variables)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  id text PRIMARY KEY DEFAULT 'default',
  min_deposit_percent numeric(5,2) NOT NULL DEFAULT 50.00
    CHECK (min_deposit_percent >= 0 AND min_deposit_percent <= 100),
  forfeiture_days integer NOT NULL DEFAULT 7
    CHECK (forfeiture_days >= 0),
  catering_required_amount numeric(12,2) NOT NULL DEFAULT 10000.00
    CHECK (catering_required_amount >= 0),
  catering_deadline_days integer NOT NULL DEFAULT 7
    CHECK (catering_deadline_days >= 1),
  catering_auto_action text NOT NULL DEFAULT 'flagged_unpaid'
    CHECK (catering_auto_action IN ('flagged_unpaid', 'cancelled')),
  admin_alert_phone text DEFAULT NULL,
  admin_alert_email text DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the default row so the app always has valid settings immediately
INSERT INTO public.system_settings (
  id,
  min_deposit_percent,
  forfeiture_days,
  catering_required_amount,
  catering_deadline_days,
  catering_auto_action
)
VALUES ('default', 50.00, 7, 10000.00, 7, 'flagged_unpaid')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. OPENFREEMAP COORDINATES ON LOCATIONS & VILLAS
-- ----------------------------------------------------------------------------
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS latitude double precision DEFAULT 7.0915,
  ADD COLUMN IF NOT EXISTS longitude double precision DEFAULT 125.5826,
  ADD COLUMN IF NOT EXISTS map_zoom integer DEFAULT 16;

ALTER TABLE public.villas
  ADD COLUMN IF NOT EXISTS address text DEFAULT 'Ma-a, Davao City, Philippines, 8000',
  ADD COLUMN IF NOT EXISTS latitude double precision DEFAULT 7.0915,
  ADD COLUMN IF NOT EXISTS longitude double precision DEFAULT 125.5826,
  ADD COLUMN IF NOT EXISTS map_zoom integer DEFAULT 16;

-- Backfill existing rows with default Davao City coordinates if null
UPDATE public.locations
SET latitude = COALESCE(latitude, 7.0915),
    longitude = COALESCE(longitude, 125.5826),
    map_zoom = COALESCE(map_zoom, 16)
WHERE latitude IS NULL OR longitude IS NULL;

UPDATE public.villas
SET address = COALESCE(address, 'Ma-a, Davao City, Philippines, 8000'),
    latitude = COALESCE(latitude, 7.0915),
    longitude = COALESCE(longitude, 125.5826),
    map_zoom = COALESCE(map_zoom, 16)
WHERE latitude IS NULL OR longitude IS NULL;

-- ----------------------------------------------------------------------------
-- 3. ENHANCE BOOKINGS TABLE (PayMongo, Refunds, Forfeiture, Catering Rules)
-- ----------------------------------------------------------------------------
ALTER TABLE public.bookings
  -- Email (already exists in DB, included with IF NOT EXISTS for safety)
  ADD COLUMN IF NOT EXISTS email text,
  -- Payment Gateway & Channel Tracking
  ADD COLUMN IF NOT EXISTS payment_gateway text NOT NULL DEFAULT 'manual'
    CHECK (payment_gateway IN ('manual', 'paymongo', 'cash')),
  ADD COLUMN IF NOT EXISTS payment_channel text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paymongo_payment_id text DEFAULT NULL,
  -- Dynamic Deposit Snapshot at Time of Booking
  ADD COLUMN IF NOT EXISTS required_deposit_percent numeric(5,2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS required_deposit_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  -- Catering Deadline Rules (1 week before appointment)
  ADD COLUMN IF NOT EXISTS catering_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (catering_status IN ('not_applicable', 'pending_payment', 'confirmed', 'flagged_unpaid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS catering_required_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS catering_deadline_date date DEFAULT NULL,
  -- Cancellation & Forfeiture Tracking
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_forfeited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forfeiture_reason text DEFAULT NULL,
  -- Refunds Tab Management
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'requested', 'approved', 'processed', 'rejected', 'forfeited')),
  ADD COLUMN IF NOT EXISTS refund_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS refund_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refund_processed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill catering fields for existing bookings with 'with_catering'
UPDATE public.bookings
SET catering_status = CASE
      WHEN package_option = 'with_catering' AND COALESCE(amount_paid, 0) >= 10000 THEN 'confirmed'
      WHEN package_option = 'with_catering' THEN 'pending_payment'
      ELSE 'not_applicable'
    END,
    catering_required_amount = CASE
      WHEN package_option = 'with_catering' THEN 10000.00
      ELSE 0.00
    END,
    catering_deadline_date = CASE
      WHEN package_option = 'with_catering' AND event_date IS NOT NULL THEN (event_date::date - INTERVAL '7 days')::date
      ELSE NULL
    END
WHERE catering_deadline_date IS NULL AND package_option = 'with_catering';

-- ----------------------------------------------------------------------------
-- 4. PAYMENT TRANSACTIONS TABLE (Downpayment, Full, Follow-Up, Refunds)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'downpayment'
    CHECK (phase IN ('downpayment', 'full_payment', 'catering_payment', 'follow_up', 'balance_settlement', 'refund')),
  payment_gateway text NOT NULL DEFAULT 'manual'
    CHECK (payment_gateway IN ('manual', 'paymongo', 'cash')),
  payment_channel text DEFAULT NULL, -- e.g. 'chinabank', 'gcash', 'card', 'cash', 'bdo'
  amount numeric(12,2) NOT NULL DEFAULT 0.00,
  account_name text DEFAULT NULL,
  reference_number text DEFAULT NULL,
  receipt_file_path text DEFAULT NULL,
  paymongo_checkout_id text DEFAULT NULL,
  paymongo_payment_id text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'paid', 'failed', 'refunded', 'rejected')),
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. NOTIFICATION LOGS TABLE (Textbee SMS & Resend Email Receipts/Alerts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms_textbee', 'email_resend')),
  recipient_type text NOT NULL CHECK (recipient_type IN ('admin', 'customer')),
  recipient text NOT NULL,
  event_type text NOT NULL, -- 'new_booking', 'booking_updated', 'payment_verified', 'catering_deadline', 'refund_update'
  subject text DEFAULT NULL,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  provider_response jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. RPC FUNCTIONS FOR CATERING DEADLINE & FORFEITURE EVALUATION
-- ----------------------------------------------------------------------------

-- Automatically flags or cancels catering arrangements that are unpaid 1 week before event_date
CREATE OR REPLACE FUNCTION public.enforce_catering_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_req_amount numeric(12,2);
  v_deadline_days integer;
  v_auto_action text;
  v_affected integer := 0;
BEGIN
  SELECT catering_required_amount, catering_deadline_days, catering_auto_action
  INTO v_req_amount, v_deadline_days, v_auto_action
  FROM public.system_settings
  WHERE id = 'default';

  v_req_amount := COALESCE(v_req_amount, 10000.00);
  v_deadline_days := COALESCE(v_deadline_days, 7);
  v_auto_action := COALESCE(v_auto_action, 'flagged_unpaid');

  UPDATE public.bookings
  SET catering_status = v_auto_action,
      updated_at = now()
  WHERE package_option = 'with_catering'
    AND status IN ('pending_verification', 'confirmed')
    AND catering_status = 'pending_payment'
    AND (event_date::date - CURRENT_DATE) <= v_deadline_days
    AND COALESCE(amount_paid, 0) < GREATEST(COALESCE(catering_required_amount, 0), v_req_amount);

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

-- Evaluates whether a cancellation is forfeited based on system_settings.forfeiture_days
CREATE OR REPLACE FUNCTION public.evaluate_booking_cancellation(
  p_booking_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_forfeiture_days integer;
  v_booking record;
  v_days_until_event integer;
  v_is_forfeited boolean;
  v_refund_status text;
  v_refund_amount numeric(12,2);
  v_forfeiture_reason text;
BEGIN
  SELECT forfeiture_days INTO v_forfeiture_days
  FROM public.system_settings
  WHERE id = 'default';

  v_forfeiture_days := COALESCE(v_forfeiture_days, 7);

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_days_until_event := (v_booking.event_date::date - CURRENT_DATE);

  IF v_days_until_event <= v_forfeiture_days THEN
    v_is_forfeited := true;
    v_refund_status := 'forfeited';
    v_refund_amount := 0.00;
    v_forfeiture_reason := format(
      'Cancelled %s day(s) before event date (within %s-day forfeiture window). Payment is forfeited.',
      v_days_until_event,
      v_forfeiture_days
    );
  ELSE
    v_is_forfeited := false;
    v_refund_status := CASE WHEN COALESCE(v_booking.amount_paid, 0) > 0 THEN 'requested' ELSE 'none' END;
    v_refund_amount := COALESCE(v_booking.amount_paid, 0);
    v_forfeiture_reason := NULL;
  END IF;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'days_until_event', v_days_until_event,
    'forfeiture_days_threshold', v_forfeiture_days,
    'is_forfeited', v_is_forfeited,
    'refund_status', v_refund_status,
    'refund_amount', v_refund_amount,
    'forfeiture_reason', v_forfeiture_reason
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES (Postgres Best Practices)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_villa_event_date ON public.bookings(villa_id, event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_refund_status ON public.bookings(refund_status) WHERE refund_status <> 'none';
CREATE INDEX IF NOT EXISTS idx_bookings_catering_status ON public.bookings(catering_status) WHERE package_option = 'with_catering';
CREATE INDEX IF NOT EXISTS idx_bookings_paymongo_checkout ON public.bookings(paymongo_checkout_id) WHERE paymongo_checkout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_booking_id ON public.payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_booking_id ON public.notification_logs(booking_id);

-- ----------------------------------------------------------------------------
-- 8. DATA API GRANTS & ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.system_settings TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.system_settings TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO anon, authenticated, service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- System settings: Anyone can read (needed for public booking form deposit/catering rules), authenticated admins can update
DROP POLICY IF EXISTS "Public read access to system_settings" ON public.system_settings;
CREATE POLICY "Public read access to system_settings"
  ON public.system_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin update access to system_settings" ON public.system_settings;
CREATE POLICY "Admin update access to system_settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payment transactions: Allow read/insert for booking flow & full access for authenticated admins
DROP POLICY IF EXISTS "Read payment_transactions" ON public.payment_transactions;
CREATE POLICY "Read payment_transactions"
  ON public.payment_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Insert payment_transactions" ON public.payment_transactions;
CREATE POLICY "Insert payment_transactions"
  ON public.payment_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Update payment_transactions" ON public.payment_transactions;
CREATE POLICY "Update payment_transactions"
  ON public.payment_transactions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Delete payment_transactions" ON public.payment_transactions;
CREATE POLICY "Delete payment_transactions"
  ON public.payment_transactions FOR DELETE
  TO authenticated
  USING (true);

-- Notification logs: Server routes insert logs, authenticated admins view logs
DROP POLICY IF EXISTS "Read notification_logs" ON public.notification_logs;
CREATE POLICY "Read notification_logs"
  ON public.notification_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Insert notification_logs" ON public.notification_logs;
CREATE POLICY "Insert notification_logs"
  ON public.notification_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

COMMIT;

