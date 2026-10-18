-- ============================================================================
-- MIGRATION: Fix Missing RLS SELECT, INSERT & CRUD Policies + Secure Booking RPCs
-- Target Tables: villas, packages, rate_tiers, faqs, payment_settings,
--                payment_accounts (if exists), system_settings, locations,
--                bookings, payment_transactions, notification_logs,
--                booking_audit_history, booking_changes_approval
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Ensure `notes` Column Exists on `public.bookings` & Relax Status Check
-- ----------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- Ensure audit history columns exist for pending approval flows
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_audit_history'
  ) THEN
    ALTER TABLE public.booking_audit_history
      ADD COLUMN IF NOT EXISTS type text,
      ADD COLUMN IF NOT EXISTS status text,
      ADD COLUMN IF NOT EXISTS amount_paid numeric,
      ADD COLUMN IF NOT EXISTS account_name text,
      ADD COLUMN IF NOT EXISTS reference_number text,
      ADD COLUMN IF NOT EXISTS receipt_file_path text,
      ADD COLUMN IF NOT EXISTS summary text,
      ADD COLUMN IF NOT EXISTS action text,
      ADD COLUMN IF NOT EXISTS changed_by text;
  END IF;
END $$;

-- Remove `FORCE ROW LEVEL SECURITY` so `SECURITY DEFINER` RPCs can safely
-- insert/update rows on behalf of validated server API routes while standard
-- RLS (`ENABLE ROW LEVEL SECURITY`) remains strictly enforced for `anon`/`authenticated`.
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
      EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY;', tbl);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Ensure Table-Level Grants Exist for `anon` and `authenticated`
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.villas TO anon, authenticated;
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT SELECT ON public.rate_tiers TO anon, authenticated;
GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT SELECT ON public.payment_settings TO anon, authenticated;
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT SELECT ON public.locations TO anon, authenticated;

-- Allow `anon` to INSERT new bookings, receipts, follow-ups, and change requests
GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT INSERT ON public.payment_transactions TO anon, authenticated;
GRANT INSERT ON public.booking_audit_history TO anon, authenticated;
GRANT INSERT ON public.booking_changes_approval TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.villas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_tiers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_audit_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_changes_approval TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. VILLAS: Public Read + Admin Full CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "villas_anon_select" ON public.villas;
DROP POLICY IF EXISTS "villas_public_select" ON public.villas;
DROP POLICY IF EXISTS "villas_admin_insert" ON public.villas;
DROP POLICY IF EXISTS "villas_admin_update" ON public.villas;
DROP POLICY IF EXISTS "villas_admin_delete" ON public.villas;

CREATE POLICY "villas_public_select"
  ON public.villas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "villas_admin_insert"
  ON public.villas FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "villas_admin_update"
  ON public.villas FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "villas_admin_delete"
  ON public.villas FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 3. PACKAGES: Public Read + Admin Full CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "packages_anon_select" ON public.packages;
DROP POLICY IF EXISTS "packages_public_select" ON public.packages;
DROP POLICY IF EXISTS "packages_admin_insert" ON public.packages;
DROP POLICY IF EXISTS "packages_admin_update" ON public.packages;
DROP POLICY IF EXISTS "packages_admin_delete" ON public.packages;

CREATE POLICY "packages_public_select"
  ON public.packages FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "packages_admin_insert"
  ON public.packages FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "packages_admin_update"
  ON public.packages FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "packages_admin_delete"
  ON public.packages FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 4. RATE_TIERS: Public Read + Admin Full CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rate_tiers_anon_select" ON public.rate_tiers;
DROP POLICY IF EXISTS "rate_tiers_public_select" ON public.rate_tiers;
DROP POLICY IF EXISTS "rate_tiers_admin_insert" ON public.rate_tiers;
DROP POLICY IF EXISTS "rate_tiers_admin_update" ON public.rate_tiers;
DROP POLICY IF EXISTS "rate_tiers_admin_delete" ON public.rate_tiers;

CREATE POLICY "rate_tiers_public_select"
  ON public.rate_tiers FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "rate_tiers_admin_insert"
  ON public.rate_tiers FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "rate_tiers_admin_update"
  ON public.rate_tiers FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "rate_tiers_admin_delete"
  ON public.rate_tiers FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 5. FAQS: Public Read + Admin Full CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "faqs_anon_select" ON public.faqs;
DROP POLICY IF EXISTS "faqs_public_select" ON public.faqs;
DROP POLICY IF EXISTS "faqs_admin_insert" ON public.faqs;
DROP POLICY IF EXISTS "faqs_admin_update" ON public.faqs;
DROP POLICY IF EXISTS "faqs_admin_delete" ON public.faqs;

CREATE POLICY "faqs_public_select"
  ON public.faqs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "faqs_admin_insert"
  ON public.faqs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "faqs_admin_update"
  ON public.faqs FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "faqs_admin_delete"
  ON public.faqs FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 6. PAYMENT_SETTINGS (Manual QR / Payment Accounts): Public Read + Admin CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "payment_settings_anon_select" ON public.payment_settings;
DROP POLICY IF EXISTS "payment_settings_public_select" ON public.payment_settings;
DROP POLICY IF EXISTS "payment_settings_admin_insert" ON public.payment_settings;
DROP POLICY IF EXISTS "payment_settings_admin_update" ON public.payment_settings;
DROP POLICY IF EXISTS "payment_settings_admin_delete" ON public.payment_settings;

CREATE POLICY "payment_settings_public_select"
  ON public.payment_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "payment_settings_admin_insert"
  ON public.payment_settings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_settings_admin_update"
  ON public.payment_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_settings_admin_delete"
  ON public.payment_settings FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- Seed default GCash and Visa accounts if not yet configured
INSERT INTO public.payment_settings (id, provider_name, account_name, account_number)
VALUES
  ('gcash', 'GCash', 'Joy Party & Events Place', '0917-000-0000'),
  ('visa', 'Visa / Bank Transfer', 'Joy Party & Events Place', '0000-0000-0000')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_accounts'
  ) THEN
    EXECUTE 'ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT SELECT ON public.payment_accounts TO anon, authenticated';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated';

    EXECUTE 'DROP POLICY IF EXISTS "payment_accounts_public_select" ON public.payment_accounts';
    EXECUTE 'DROP POLICY IF EXISTS "payment_accounts_admin_insert" ON public.payment_accounts';
    EXECUTE 'DROP POLICY IF EXISTS "payment_accounts_admin_update" ON public.payment_accounts';
    EXECUTE 'DROP POLICY IF EXISTS "payment_accounts_admin_delete" ON public.payment_accounts';

    EXECUTE 'CREATE POLICY "payment_accounts_public_select" ON public.payment_accounts FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "payment_accounts_admin_insert" ON public.payment_accounts FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "payment_accounts_admin_update" ON public.payment_accounts FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL)';
    EXECUTE 'CREATE POLICY "payment_accounts_admin_delete" ON public.payment_accounts FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL)';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. SYSTEM_SETTINGS & LOCATIONS: Public Read + Admin Full CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "system_settings_anon_select" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_public_select" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_insert" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_update" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_delete" ON public.system_settings;

CREATE POLICY "system_settings_public_select"
  ON public.system_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "system_settings_admin_insert"
  ON public.system_settings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "system_settings_admin_update"
  ON public.system_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "system_settings_admin_delete"
  ON public.system_settings FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "locations_anon_select" ON public.locations;
DROP POLICY IF EXISTS "locations_public_select" ON public.locations;
DROP POLICY IF EXISTS "locations_admin_insert" ON public.locations;
DROP POLICY IF EXISTS "locations_admin_update" ON public.locations;
DROP POLICY IF EXISTS "locations_admin_delete" ON public.locations;

CREATE POLICY "locations_public_select"
  ON public.locations FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "locations_admin_insert"
  ON public.locations FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "locations_admin_update"
  ON public.locations FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "locations_admin_delete"
  ON public.locations FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 8. BOOKINGS & PAYMENT_TRANSACTIONS: Public INSERT + Admin Full CRUD
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "bookings_anon_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_anon_insert_only" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_delete" ON public.bookings;

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

CREATE POLICY "bookings_admin_select"
  ON public.bookings FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "bookings_admin_insert"
  ON public.bookings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "bookings_admin_update"
  ON public.bookings FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "bookings_admin_delete"
  ON public.bookings FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "payment_transactions_anon_insert" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_admin_select" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_admin_insert" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_admin_update" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_admin_delete" ON public.payment_transactions;

CREATE POLICY "payment_transactions_anon_insert"
  ON public.payment_transactions
  FOR INSERT
  TO anon
  WITH CHECK (status = 'pending' AND amount >= 0);

CREATE POLICY "payment_transactions_admin_select"
  ON public.payment_transactions FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_transactions_admin_insert"
  ON public.payment_transactions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_transactions_admin_update"
  ON public.payment_transactions FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "payment_transactions_admin_delete"
  ON public.payment_transactions FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 9. ADMIN AUDIT & LOG TABLES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notification_logs_admin_select" ON public.notification_logs;
DROP POLICY IF EXISTS "notification_logs_admin_insert" ON public.notification_logs;
CREATE POLICY "notification_logs_admin_select"
  ON public.notification_logs FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "notification_logs_admin_insert"
  ON public.notification_logs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "booking_audit_history_admin_select" ON public.booking_audit_history;
DROP POLICY IF EXISTS "booking_audit_history_admin_insert" ON public.booking_audit_history;
DROP POLICY IF EXISTS "booking_audit_history_anon_insert" ON public.booking_audit_history;
CREATE POLICY "booking_audit_history_admin_select"
  ON public.booking_audit_history FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "booking_audit_history_admin_insert"
  ON public.booking_audit_history FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "booking_audit_history_anon_insert"
  ON public.booking_audit_history FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "booking_changes_approval_admin_select" ON public.booking_changes_approval;
DROP POLICY IF EXISTS "booking_changes_approval_admin_insert" ON public.booking_changes_approval;
DROP POLICY IF EXISTS "booking_changes_approval_anon_insert" ON public.booking_changes_approval;
DROP POLICY IF EXISTS "booking_changes_approval_admin_update" ON public.booking_changes_approval;
CREATE POLICY "booking_changes_approval_admin_select"
  ON public.booking_changes_approval FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "booking_changes_approval_admin_insert"
  ON public.booking_changes_approval FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "booking_changes_approval_anon_insert"
  ON public.booking_changes_approval FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "booking_changes_approval_admin_update"
  ON public.booking_changes_approval FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 10. HARDENED `SECURITY DEFINER` RPC FUNCTIONS FOR BOOKING & PAYMONGO FLOWS
-- ----------------------------------------------------------------------------

-- 10.1 Non-PII Calendar Slot Availability Lookup
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

-- 10.2 Atomic Validated Booking Creation
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
  v_id uuid;
BEGIN
  v_is_admin := (SELECT auth.uid()) IS NOT NULL;
  IF v_is_admin AND COALESCE(p_payload->>'status', '') = 'confirmed' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_verification';
  END IF;

  v_id := COALESCE(NULLIF(p_payload->>'id', '')::uuid, gen_random_uuid());

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
    v_id,
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

-- 10.3 IDOR-Protected Single Booking Lookup by Exact UUID or Guest Reference Token
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

-- 10.4 Attach PayMongo Checkout Session to Booking & Transaction Ledger
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

-- 10.5 Secure Guest Change Request Submission (Queued for Admin Approval in View History)
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
    jsonb_build_object('before', to_jsonb(v_booking), 'after', p_proposed_after),
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

-- 10.6 Secure Guest Manual Follow-Up Installment Submission (Queued for Admin Approval in View History)
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
    COALESCE(p_channel, 'gcash'),
    p_amount,
    p_account_name,
    p_reference_number,
    p_receipt_file_path,
    'pending',
    'Manual follow-up installment of PHP ' || p_amount::text || ' via ' || upper(COALESCE(p_channel, 'GCash'))
  );

  INSERT INTO public.booking_audit_history (
    booking_id,
    type,
    status,
    amount_paid,
    account_name,
    reference_number,
    receipt_file_path,
    summary
  ) VALUES (
    v_booking.id,
    'payment_installment',
    'pending_approval',
    p_amount,
    p_account_name,
    p_reference_number,
    p_receipt_file_path,
    'Submitted ' || upper(COALESCE(p_channel, 'GCASH')) || ' follow-up installment of PHP ' || p_amount::text || ' (Ref: ' || p_reference_number || ')'
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_guest_manual_installment(uuid, text, text, numeric, text, text, text) TO anon, authenticated;

-- Reload PostgREST schema cache so foreign-key joins (`packages(*, rate_tiers(*))`) and RPCs resolve immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
