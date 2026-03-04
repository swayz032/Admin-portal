-- Bootstrap admin access for production recovery and initial setup.
-- Idempotent by design.

INSERT INTO public.admin_allowlist (email)
VALUES ('tonioscott39@yahoo.com')
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower('tonioscott39@yahoo.com')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
