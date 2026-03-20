-- Enable RLS + create ownership policies.
-- This matches the brief:
-- - Users can only read/write their own QR codes
-- - Public redirect can only read the single QR code needed (via SECURITY DEFINER function)
-- - Scan events cannot be inserted by public/anon; should be inserted server-side

-- QR codes ownership
ALTER TABLE "qr_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scan_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own
      ON "profiles"
      FOR SELECT
      TO authenticated
      USING (id = auth.uid()::text);
  END IF;
END $$;

-- Projects: owner-only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_select_own'
  ) THEN
    CREATE POLICY projects_select_own
      ON "projects"
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_insert_own'
  ) THEN
    CREATE POLICY projects_insert_own
      ON "projects"
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_update_own'
  ) THEN
    CREATE POLICY projects_update_own
      ON "projects"
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_delete_own'
  ) THEN
    CREATE POLICY projects_delete_own
      ON "projects"
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- QR codes: owner-only CRUD
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qr_codes' AND policyname = 'qr_codes_select_own'
  ) THEN
    CREATE POLICY qr_codes_select_own
      ON "qr_codes"
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qr_codes' AND policyname = 'qr_codes_insert_own'
  ) THEN
    CREATE POLICY qr_codes_insert_own
      ON "qr_codes"
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qr_codes' AND policyname = 'qr_codes_update_own'
  ) THEN
    CREATE POLICY qr_codes_update_own
      ON "qr_codes"
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qr_codes' AND policyname = 'qr_codes_delete_own'
  ) THEN
    CREATE POLICY qr_codes_delete_own
      ON "qr_codes"
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;
END $$;

-- Scan events:
-- - Owner can read their scan events
-- - INSERT is blocked for anon; allow only when auth.uid() owns the qr_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_events' AND policyname = 'scan_events_select_owner'
  ) THEN
    CREATE POLICY scan_events_select_owner
      ON "scan_events"
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM "qr_codes" qc
          WHERE qc.id = "scan_events".qr_code_id
            AND qc.user_id = auth.uid()::text
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_events' AND policyname = 'scan_events_insert_server_or_owner'
  ) THEN
    CREATE POLICY scan_events_insert_server_or_owner
      ON "scan_events"
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM "qr_codes" qc
          WHERE qc.id = "scan_events".qr_code_id
            AND qc.user_id = auth.uid()::text
        )
      );
  END IF;
END $$;

-- Subscriptions & usage limits: owner-only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_select_own'
  ) THEN
    CREATE POLICY subscriptions_select_own
      ON "subscriptions"
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_insert_own'
  ) THEN
    CREATE POLICY subscriptions_insert_own
      ON "subscriptions"
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_update_own'
  ) THEN
    CREATE POLICY subscriptions_update_own
      ON "subscriptions"
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_delete_own'
  ) THEN
    CREATE POLICY subscriptions_delete_own
      ON "subscriptions"
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_limits' AND policyname = 'usage_limits_select_own'
  ) THEN
    CREATE POLICY usage_limits_select_own
      ON "usage_limits"
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_limits' AND policyname = 'usage_limits_insert_own'
  ) THEN
    CREATE POLICY usage_limits_insert_own
      ON "usage_limits"
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_limits' AND policyname = 'usage_limits_update_own'
  ) THEN
    CREATE POLICY usage_limits_update_own
      ON "usage_limits"
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid()::text)
      WITH CHECK (user_id = auth.uid()::text);
  END IF;
END $$;

-- SECURITY DEFINER function for the public redirect endpoint
-- Allows reading *only* the target_url for one qr_code id.
CREATE OR REPLACE FUNCTION public.get_qr_code_target_url(p_qr_code_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qc.target_url
  FROM public.qr_codes qc
  WHERE qc.id = p_qr_code_id
    AND qc.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_qr_code_target_url(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_qr_code_target_url(text) TO authenticated;
