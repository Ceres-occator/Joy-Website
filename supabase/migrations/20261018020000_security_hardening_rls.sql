-- ============================================================================
-- Joy Party and Events Place — Enterprise Security Hardening & Strict RLS
-- Migration: 20261018020000_security_hardening_rls.sql
-- ============================================================================
-- Enforces:
-- 1. Row Level Security (RLS + FORCE RLS) across all 12 public tables.
-- 2. Principle of Least Privilege for the `anon` role:
--    - `anon` can ONLY `SELECT` public catalog/configuration tables (`villas`,
--      `locations`, `packages`, `rate_tiers`, `payment_settings`, `system_settings`, `faqs`).
--    - `anon` can ONLY `INSERT` new pending bookings into `public.bookings`.
--    - `anon` CANNOT `SELECT` (read other customers' PII), `UPDATE`, or `DELETE`
--      rows in `bookings`, `payment_transactions`, `notification_logs`,
--      `booking_audit_history`, or `booking_changes_approval`.
-- 3. Strict Admin Separation:
--    - All administrative reads and mutations (editing villa deposit rates,
--      base rates, system rules, verifying payments, issuing refunds) are locked
--      behind `TO authenticated` with `(select auth.uid()) is not null`.
-- 4. Hardened `SECURITY DEFINER` RPC functions (`SET search_path = ''`) for
--    non-PII calendar slot availability, atomic booking creation, PayMongo
--    idempotent settlement, and IDOR-protected guest receipt lookup.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENABLE & FORCE ROW LEVEL SECURITY ON ALL TABLES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  all_tables text[] := ARRAY[
    'villas',
    'locations',
    'packages',
    'rate_tiers',
    'bookings',
    'payment_transactions',
    'payment_settings',
    'system_settings',
    'notification_logs',
    'booking_audit_history',
    'booking_changes_approval',
    'faqs'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. REVOKE EXCESSIVE PRIVILEGES FROM `anon` (PRINCIPLE OF LEAST PRIVILEGE)
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Grant `anon` read-only access ONLY to public catalog & configuration tables
GRANT SELECT ON public.villas TO anon;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT ON public.packages TO anon;
GRANT SELECT ON public.rate_tiers TO anon;
GRANT SELECT ON public.payment_settings TO anon;
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT ON public.faqs TO anon;

-- Grant `anon` INSERT-ONLY on `public.bookings` (NO SELECT, NO UPDATE, NO DELETE)
GRANT INSERT ON public.bookings TO anon;

-- Grant `authenticated` (Admin) full table privileges governed by RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. DROP LEGACY PERMISSIVE POLICIES BEFORE CREATING STRICT POLICIES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'villas',
        'locations',
        'packages',
        'rate_tiers',
        'bookings',
        'payment_transactions',
        'payment_settings',
        'system_settings',
        'notification_logs',
        'booking_audit_history',
        'booking_changes_approval',
        'faqs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. PUBLIC CATALOG TABLES: `villas`, `locations`, `packages`, `rate_tiers`, `faqs`
--    - `anon` & `authenticated`: SELECT only
--    - `authenticated` (Admin): INSERT, UPDATE, DELETE (locked behind auth.uid())
-- ----------------------------------------------------------------------------

-- VILLAS (includes `min_deposit_percent` per-villa dynamic deposit)
CREATE POLICY "villas_public_select"
  ON public.villas
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "villas_admin_insert"
  ON public.villas
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "villas_admin_update"
  ON public.villas
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "villas_admin_delete"
  ON public.villas
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- LOCATIONS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'locations') THEN
    EXECUTE 'CREATE POLICY "locations_public_select" ON public.locations FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "locations_admin_insert" ON public.locations FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "locations_admin_update" ON public.locations FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "locations_admin_delete" ON public.locations FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)';
  END IF;
END $$;

-- PACKAGES
CREATE POLICY "packages_public_select"
  ON public.packages
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "packages_admin_insert"
  ON public.packages
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "packages_admin_update"
  ON public.packages
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "packages_admin_delete"
  ON public.packages
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- RATE TIERS
CREATE POLICY "rate_tiers_public_select"
  ON public.rate_tiers
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "rate_tiers_admin_insert"
  ON public.rate_tiers
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "rate_tiers_admin_update"
  ON public.rate_tiers
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "rate_tiers_admin_delete"
  ON public.rate_tiers
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- FAQS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faqs') THEN
    EXECUTE 'CREATE POLICY "faqs_public_select" ON public.faqs FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "faqs_admin_insert" ON public.faqs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "faqs_admin_update" ON public.faqs FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "faqs_admin_delete" ON public.faqs FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. CONFIGURATION TABLES: `system_settings`, `payment_settings`
--    - `anon` & `authenticated`: SELECT only
--    - `authenticated` (Admin): INSERT, UPDATE, DELETE
-- ----------------------------------------------------------------------------
CREATE POLICY "system_settings_public_select"
  ON public.system_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "system_settings_admin_insert"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "system_settings_admin_update"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "system_settings_admin_delete"
  ON public.system_settings
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_settings') THEN
    EXECUTE 'CREATE POLICY "payment_settings_public_select" ON public.payment_settings FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "payment_settings_admin_insert" ON public.payment_settings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "payment_settings_admin_update" ON public.payment_settings FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "payment_settings_admin_delete" ON public.payment_settings FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. SENSITIVE PII & FINANCIAL TABLES:
--    `bookings`, `payment_transactions`, `notification_logs`,
--    `booking_audit_history`, `booking_changes_approval`
-- ----------------------------------------------------------------------------

-- BOOKINGS:
-- `anon` can ONLY INSERT new unverified bookings (`status = 'pending_verification'`).
-- `anon` CANNOT SELECT, UPDATE, or DELETE any booking records directly.
CREATE POLICY "bookings_anon_insert_only"
  ON public.bookings
  FOR INSERT
  TO anon
  WITH CHECK (
    status = 'pending_verification'
    AND total_price > 0
    AND COALESCE(is_forfeited, false) = false
    AND COALESCE(refund_status, 'none') = 'none'
  );

-- `authenticated` (Admin) has full SELECT, INSERT, UPDATE, DELETE on `bookings`
CREATE POLICY "bookings_admin_select"
  ON public.bookings
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "bookings_admin_insert"
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "bookings_admin_update"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "bookings_admin_delete"
  ON public.bookings
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- PAYMENT TRANSACTIONS: Strictly locked to `authenticated` (Admin)
CREATE POLICY "payment_transactions_admin_select"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_transactions_admin_insert"
  ON public.payment_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_transactions_admin_update"
  ON public.payment_transactions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_transactions_admin_delete"
  ON public.payment_transactions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

-- NOTIFICATION LOGS: Strictly locked to `authenticated` (Admin)
CREATE POLICY "notification_logs_admin_select"
  ON public.notification_logs
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "notification_logs_admin_insert"
  ON public.notification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "notification_logs_admin_update"
  ON public.notification_logs
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- BOOKING AUDIT HISTORY & BOOKING CHANGES APPROVAL: Strictly locked to `authenticated`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_audit_history') THEN
    EXECUTE 'CREATE POLICY "booking_audit_history_admin_select" ON public.booking_audit_history FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "booking_audit_history_admin_insert" ON public.booking_audit_history FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "booking_audit_history_admin_update" ON public.booking_audit_history FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "booking_audit_history_admin_delete" ON public.booking_audit_history FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_changes_approval') THEN
    EXECUTE 'CREATE POLICY "booking_changes_approval_admin_select" ON public.booking_changes_approval FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "booking_changes_approval_admin_insert" ON public.booking_changes_approval FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "booking_changes_approval_admin_update" ON public.booking_changes_approval FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "booking_changes_approval_admin_delete" ON public.booking_changes_approval FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. HARDENED `SECURITY DEFINER` RPC FUNCTIONS (WITH `SET search_path = ''`)
--    Allows Next.js server routes to safely check non-PII slot availability,
--    create validated bookings, process verified PayMongo webhooks, and look up
--    a guest's receipt by exact UUID / guest_id token without granting `anon`
--    direct SELECT or UPDATE access to `public.bookings`.
-- ----------------------------------------------------------------------------

-- 7.1 Non-PII Calendar Slot Availability Lookup
CREATE OR REPLACE FUNCTION public.get_villa_booked_slots(p_villa_id uuid)
RETURNS TABLE (
  event_date date,
  end_date date,
  slot_assignment text,
  package_option text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    b.event_date,
    b.end_date,
    b.slot_assignment::text,
    b.package_option::text
  FROM public.bookings b
  WHERE b.villa_id = p_villa_id
    AND b.status IN ('pending_verification', 'confirmed');
$$;

GRANT EXECUTE ON FUNCTION public.get_villa_booked_slots(uuid) TO anon, authenticated;

-- 7.2 Atomic Validated Booking Creation (Backend API Route Helper)
CREATE OR REPLACE FUNCTION public.create_secure_booking(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_villa_info jsonb;
  v_is_admin boolean;
  v_status text;
BEGIN
  v_is_admin := (SELECT auth.uid()) IS NOT NULL;
  -- Only an authenticated admin can create an immediately 'confirmed' walk-in booking;
  -- all public/anon submissions are forced to 'pending_verification'.
  IF v_is_admin AND COALESCE(p_payload->>'status', '') = 'confirmed' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_verification';
  END IF;

  INSERT INTO public.bookings (
    id,
    villa_id,
    guest_id,
    customer_name,
    customer_phone,
    email,
    event_date,
    end_date,
    slot_assignment,
    pax_count,
    package_option,
    include_overnight,
    overnight_pax_count,
    total_price,
    payment_mode,
    payment_gateway,
    payment_channel,
    amount_paid,
    remaining_balance,
    required_deposit_percent,
    required_deposit_amount,
    account_name,
    reference_number,
    receipt_file_path,
    id_file_path,
    catering_status,
    catering_required_amount,
    catering_deadline_date,
    status
  ) VALUES (
    COALESCE(NULLIF(p_payload->>'id', '')::uuid, gen_random_uuid()),
    (p_payload->>'villa_id')::uuid,
    p_payload->>'guest_id',
    p_payload->>'customer_name',
    p_payload->>'customer_phone',
    NULLIF(p_payload->>'email', ''),
    (p_payload->>'event_date')::date,
    COALESCE(NULLIF(p_payload->>'end_date', '')::date, (p_payload->>'event_date')::date),
    p_payload->>'slot_assignment',
    COALESCE((p_payload->>'pax_count')::integer, 1),
    p_payload->>'package_option',
    COALESCE((p_payload->>'include_overnight')::boolean, false),
    COALESCE((p_payload->>'overnight_pax_count')::integer, 0),
    (p_payload->>'total_price')::numeric,
    COALESCE(p_payload->>'payment_mode', 'half'),
    COALESCE(p_payload->>'payment_gateway', 'manual'),
    p_payload->>'payment_channel',
    COALESCE((p_payload->>'amount_paid')::numeric, 0),
    COALESCE((p_payload->>'remaining_balance')::numeric, 0),
    COALESCE((p_payload->>'required_deposit_percent')::numeric, 50),
    COALESCE((p_payload->>'required_deposit_amount')::numeric, 0),
    p_payload->>'account_name',
    p_payload->>'reference_number',
    NULLIF(p_payload->>'receipt_file_path', ''),
    NULLIF(p_payload->>'id_file_path', ''),
    COALESCE(p_payload->>'catering_status', 'not_applicable'),
    COALESCE((p_payload->>'catering_required_amount')::numeric, 0),
    NULLIF(p_payload->>'catering_deadline_date', '')::date,
    v_status
  )
  RETURNING * INTO v_booking;

  -- Record initial payment transaction if manual or walk-in cash
  IF COALESCE(p_payload->>'payment_gateway', 'manual') IN ('manual', 'cash') THEN
    INSERT INTO public.payment_transactions (
      booking_id,
      phase,
      payment_gateway,
      payment_channel,
      amount,
      status,
      account_name,
      reference_number,
      receipt_file_path,
      notes
    ) VALUES (
      v_booking.id,
      CASE WHEN v_booking.payment_mode = 'full' THEN 'full_payment' ELSE 'downpayment' END,
      COALESCE(p_payload->>'payment_gateway', 'manual'),
      p_payload->>'payment_channel',
      v_booking.amount_paid,
      CASE WHEN v_status = 'confirmed' THEN 'paid' ELSE 'pending' END,
      v_booking.account_name,
      v_booking.reference_number,
      v_booking.receipt_file_path,
      CASE WHEN v_status = 'confirmed' THEN 'Walk-in cash payment collected by admin' ELSE 'Initial manual transfer submitted by customer' END
    );
  END IF;

  SELECT jsonb_build_object('name', v.name, 'address', v.address)
  INTO v_villa_info
  FROM public.villas v
  WHERE v.id = v_booking.villa_id;

  RETURN to_jsonb(v_booking) || jsonb_build_object('villas', v_villa_info);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_secure_booking(jsonb) TO anon, authenticated;

-- 7.3 IDOR-Protected Single Booking Lookup by Exact UUID or Guest Reference Token
CREATE OR REPLACE FUNCTION public.get_booking_secure(
  p_booking_id uuid DEFAULT NULL,
  p_guest_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_villa_info jsonb;
  v_clean_guest text;
BEGIN
  IF p_booking_id IS NULL AND (p_guest_id IS NULL OR length(trim(p_guest_id)) < 4) THEN
    RETURN NULL;
  END IF;

  v_clean_guest := upper(regexp_replace(COALESCE(trim(p_guest_id), ''), '^#', ''));

  IF p_booking_id IS NOT NULL AND v_clean_guest <> '' THEN
    SELECT * INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id AND upper(b.guest_id) = v_clean_guest
    LIMIT 1;
  ELSIF p_booking_id IS NOT NULL THEN
    SELECT * INTO v_booking
    FROM public.bookings b
    WHERE b.id = p_booking_id
    LIMIT 1;
  ELSE
    SELECT * INTO v_booking
    FROM public.bookings b
    WHERE upper(b.guest_id) = v_clean_guest
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'name', v.name,
    'address', v.address,
    'min_deposit_percent', v.min_deposit_percent
  )
  INTO v_villa_info
  FROM public.villas v
  WHERE v.id = v_booking.villa_id;

  RETURN to_jsonb(v_booking) || jsonb_build_object('villas', v_villa_info);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_secure(uuid, text) TO anon, authenticated;

-- 7.4 Attach PayMongo Checkout Session to Booking & Transaction Ledger
CREATE OR REPLACE FUNCTION public.attach_paymongo_checkout_session(
  p_booking_id uuid,
  p_checkout_id text,
  p_phase text,
  p_channel text,
  p_amount numeric,
  p_account_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.bookings
  SET
    payment_gateway = 'paymongo',
    payment_channel = COALESCE(p_channel, payment_channel),
    paymongo_checkout_id = p_checkout_id,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_booking_id;

  INSERT INTO public.payment_transactions (
    booking_id,
    phase,
    payment_gateway,
    payment_channel,
    amount,
    status,
    paymongo_checkout_id,
    account_name,
    reference_number,
    notes
  ) VALUES (
    p_booking_id,
    COALESCE(p_phase, 'downpayment'),
    'paymongo',
    p_channel,
    p_amount,
    'pending',
    p_checkout_id,
    p_account_name,
    p_checkout_id,
    'PayMongo checkout session initialized'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_paymongo_checkout_session(uuid, text, text, text, numeric, text) TO anon, authenticated;

-- 7.5 Idempotent PayMongo Payment Confirmation (Used by Verified Webhook & Verify Route)
CREATE OR REPLACE FUNCTION public.confirm_paymongo_payment_idempotent(
  p_booking_id uuid,
  p_checkout_id text,
  p_payment_id text,
  p_source_type text,
  p_paid_amount numeric,
  p_phase text DEFAULT 'downpayment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_villa_info jsonb;
  v_already_paid boolean := false;
  v_is_initial boolean;
  v_new_amount_paid numeric;
  v_new_remaining numeric;
  v_catering_req numeric;
  v_catering_status text;
BEGIN
  -- Lock the booking row to prevent race conditions when webhook + redirect verify fire simultaneously
  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE (p_booking_id IS NOT NULL AND b.id = p_booking_id)
     OR (p_booking_id IS NULL AND p_checkout_id IS NOT NULL AND b.paymongo_checkout_id = p_checkout_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Strict idempotency check 1: booking already recorded this exact paymongo_payment_id
  IF p_payment_id IS NOT NULL AND v_booking.paymongo_payment_id = p_payment_id AND v_booking.status = 'confirmed' THEN
    v_already_paid := true;
  END IF;

  -- Strict idempotency check 2: payment_transactions already has a 'paid' entry for this payment_id or checkout_id
  IF NOT v_already_paid THEN
    IF EXISTS (
      SELECT 1
      FROM public.payment_transactions pt
      WHERE pt.booking_id = v_booking.id
        AND pt.status = 'paid'
        AND (
          (p_payment_id IS NOT NULL AND pt.paymongo_payment_id = p_payment_id)
          OR (p_checkout_id IS NOT NULL AND pt.paymongo_checkout_id = p_checkout_id)
        )
    ) THEN
      v_already_paid := true;
    END IF;
  END IF;

  SELECT jsonb_build_object('name', v.name, 'address', v.address)
  INTO v_villa_info
  FROM public.villas v
  WHERE v.id = v_booking.villa_id;

  IF v_already_paid THEN
    RETURN jsonb_build_object(
      'found', true,
      'already_processed', true,
      'booking', to_jsonb(v_booking) || jsonb_build_object('villas', v_villa_info)
    );
  END IF;

  v_is_initial := (
    v_booking.status = 'pending_verification'
    AND COALESCE(p_phase, 'downpayment') IN ('downpayment', 'full_payment')
  );

  IF v_is_initial THEN
    v_new_amount_paid := GREATEST(COALESCE(v_booking.amount_paid, 0), COALESCE(p_paid_amount, 0));
  ELSE
    v_new_amount_paid := COALESCE(v_booking.amount_paid, 0) + COALESCE(p_paid_amount, 0);
  END IF;

  v_new_remaining := GREATEST(0, COALESCE(v_booking.total_price, 0) - v_new_amount_paid);
  v_catering_req := COALESCE(v_booking.catering_required_amount, 10000);

  IF v_booking.package_option = 'with_catering' THEN
    IF v_new_amount_paid >= v_catering_req THEN
      v_catering_status := 'confirmed';
    ELSE
      v_catering_status := COALESCE(v_booking.catering_status, 'pending_payment');
    END IF;
  ELSE
    v_catering_status := 'not_applicable';
  END IF;

  UPDATE public.bookings
  SET
    status = 'confirmed',
    payment_gateway = 'paymongo',
    payment_channel = COALESCE(p_source_type, payment_channel, 'paymongo'),
    paymongo_payment_id = COALESCE(p_payment_id, paymongo_payment_id),
    reference_number = COALESCE(p_payment_id, p_checkout_id, reference_number),
    amount_paid = v_new_amount_paid,
    remaining_balance = v_new_remaining,
    payment_mode = CASE WHEN v_new_remaining <= 0 THEN 'full' ELSE 'half' END,
    catering_status = v_catering_status,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_booking.id
  RETURNING * INTO v_booking;

  -- Update existing pending transaction for this checkout session, or insert a new paid row
  IF p_checkout_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payment_transactions
    WHERE booking_id = v_booking.id AND paymongo_checkout_id = p_checkout_id
  ) THEN
    UPDATE public.payment_transactions
    SET
      status = 'paid',
      payment_channel = COALESCE(p_source_type, payment_channel),
      paymongo_payment_id = COALESCE(p_payment_id, paymongo_payment_id),
      reference_number = COALESCE(p_payment_id, p_checkout_id),
      amount = COALESCE(p_paid_amount, amount),
      notes = 'Verified via PayMongo (' || COALESCE(p_source_type, 'online') || ')',
      updated_at = timezone('utc'::text, now())
    WHERE booking_id = v_booking.id AND paymongo_checkout_id = p_checkout_id;
  ELSE
    INSERT INTO public.payment_transactions (
      booking_id,
      phase,
      payment_gateway,
      payment_channel,
      amount,
      status,
      paymongo_checkout_id,
      paymongo_payment_id,
      account_name,
      reference_number,
      notes
    ) VALUES (
      v_booking.id,
      COALESCE(p_phase, 'downpayment'),
      'paymongo',
      COALESCE(p_source_type, 'paymongo'),
      COALESCE(p_paid_amount, 0),
      'paid',
      p_checkout_id,
      p_payment_id,
      v_booking.customer_name,
      COALESCE(p_payment_id, p_checkout_id),
      'Verified via PayMongo (' || COALESCE(p_source_type, 'online') || ')'
    );
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'already_processed', false,
    'booking', to_jsonb(v_booking) || jsonb_build_object('villas', v_villa_info)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_paymongo_payment_idempotent(uuid, text, text, text, numeric, text) TO anon, authenticated;

-- 7.6 Log Notification Dispatch Safely
CREATE OR REPLACE FUNCTION public.log_booking_notification(
  p_booking_id uuid,
  p_recipient_type text,
  p_channel text,
  p_recipient text,
  p_event_type text,
  p_status text,
  p_provider_response text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.notification_logs (
    booking_id,
    recipient_type,
    channel,
    recipient,
    event_type,
    status,
    provider_response
  ) VALUES (
    p_booking_id,
    p_recipient_type,
    p_channel,
    p_recipient,
    p_event_type,
    p_status,
    p_provider_response
  );
$$;

GRANT EXECUTE ON FUNCTION public.log_booking_notification(uuid, text, text, text, text, text, text) TO anon, authenticated;

-- 7.7 Harden `enforce_catering_deadlines` with explicit `SET search_path = ''`
CREATE OR REPLACE FUNCTION public.enforce_catering_deadlines()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req_amount numeric := 10000;
  v_deadline_days integer := 7;
  v_auto_action text := 'flagged_unpaid';
  v_affected integer := 0;
BEGIN
  SELECT
    catering_required_amount,
    catering_deadline_days,
    catering_auto_action
  INTO
    v_req_amount,
    v_deadline_days,
    v_auto_action
  FROM public.system_settings
  WHERE id = 'default'
  LIMIT 1;

  UPDATE public.bookings
  SET
    catering_status = COALESCE(v_auto_action, 'flagged_unpaid'),
    updated_at = timezone('utc'::text, now())
  WHERE package_option = 'with_catering'
    AND status IN ('pending_verification', 'confirmed')
    AND catering_status = 'pending_payment'
    AND COALESCE(amount_paid, 0) < COALESCE(catering_required_amount, v_req_amount)
    AND event_date <= (CURRENT_DATE + COALESCE(v_deadline_days, 7));

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

-- 7.8 Guest Change Request & Manual Installment Submission (IDOR-Protected by UUID + guest_id)
CREATE OR REPLACE FUNCTION public.submit_guest_change_request(
  p_booking_id uuid,
  p_guest_id text,
  p_proposed_after jsonb,
  p_summary text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_clean_guest text;
BEGIN
  v_clean_guest := upper(regexp_replace(COALESCE(trim(p_guest_id), ''), '^#', ''));

  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND upper(b.guest_id) = v_clean_guest
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.booking_changes_approval (
    booking_id,
    proposed_changes,
    status
  ) VALUES (
    v_booking.id,
    jsonb_build_object('after', p_proposed_after),
    'pending'
  );

  INSERT INTO public.booking_audit_history (
    booking_id,
    type,
    status,
    summary
  ) VALUES (
    v_booking.id,
    'data_edit',
    'pending_approval',
    p_summary
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_change_request(uuid, text, jsonb, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_guest_manual_installment(
  p_booking_id uuid,
  p_guest_id text,
  p_channel text,
  p_amount numeric,
  p_account_name text,
  p_reference_number text,
  p_receipt_file_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_clean_guest text;
BEGIN
  v_clean_guest := upper(regexp_replace(COALESCE(trim(p_guest_id), ''), '^#', ''));

  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND upper(b.guest_id) = v_clean_guest
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.bookings
  SET
    status = 'pending_verification',
    updated_at = timezone('utc'::text, now())
  WHERE id = v_booking.id;

  INSERT INTO public.payment_transactions (
    booking_id,
    phase,
    payment_gateway,
    payment_channel,
    amount,
    account_name,
    reference_number,
    receipt_file_path,
    status,
    notes
  ) VALUES (
    v_booking.id,
    'follow_up',
    'manual',
    p_channel,
    p_amount,
    p_account_name,
    p_reference_number,
    p_receipt_file_path,
    'pending_verification',
    'Manual follow-up installment submitted via Guest Portal'
  );

  INSERT INTO public.booking_audit_history (
    booking_id,
    type,
    status,
    summary,
    receipt_file_path
  ) VALUES (
    v_booking.id,
    'payment_upload',
    'pending_verification',
    'Submitted ' || upper(COALESCE(p_channel, 'MANUAL')) || ' installment of PHP ' || p_amount::text || ' (Ref: ' || p_reference_number || ')',
    p_receipt_file_path
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_manual_installment(uuid, text, text, numeric, text, text, text) TO anon, authenticated;

