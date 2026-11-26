-- Resolve only qualified application objects inside privileged functions.
CREATE OR REPLACE FUNCTION public.app_current_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT role FROM public.users
  WHERE id = public.app_current_user_id() AND tenant_id = public.app_current_tenant_id()
$$;

CREATE OR REPLACE FUNCTION public.app_has_warehouse_access(p_warehouse_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = public.app_current_tenant_id()
      AND m.user_id = public.app_current_user_id()
      AND m.warehouse_id = p_warehouse_id
  )
$$;

CREATE OR REPLACE FUNCTION public.auth_find_user(p_phone text, p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, tenant_id uuid, name text, role text, password_hash text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT u.id, u.tenant_id, u.name, u.role, u.password_hash
  FROM public.users u
  WHERE u.phone = p_phone
    AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
$$;

CREATE OR REPLACE FUNCTION public.auth_find_session(p_refresh_token_hash text)
RETURNS TABLE(id uuid, tenant_id uuid, user_id uuid, device_id text, expires_at timestamptz, revoked_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT s.id, s.tenant_id, s.user_id, s.device_id, s.expires_at, s.revoked_at
  FROM public.auth_sessions s
  WHERE s.refresh_token_hash = p_refresh_token_hash
$$;

DO $$
DECLARE
  runtime_role text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF runtime_role IS NULL THEN
    RAISE EXCEPTION 'app.runtime_role is required to grant auth function privileges';
  END IF;

  REVOKE EXECUTE ON FUNCTION public.auth_find_user(text, uuid) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.auth_find_session(text) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.app_current_user_role() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.app_has_warehouse_access(uuid) FROM PUBLIC;

  EXECUTE format('GRANT EXECUTE ON FUNCTION public.auth_find_user(text, uuid) TO %I', runtime_role);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.auth_find_session(text) TO %I', runtime_role);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.app_current_user_role() TO %I', runtime_role);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.app_has_warehouse_access(uuid) TO %I', runtime_role);

  EXECUTE format('REVOKE UPDATE, DELETE ON audit_events FROM %I', runtime_role);
END $$;

REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;

DROP POLICY warehouses_member ON warehouses;

CREATE POLICY warehouses_member_select ON warehouses
  FOR SELECT
  USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(id));

CREATE POLICY warehouses_owner_trader_write ON warehouses
  FOR ALL
  USING (
    tenant_id = app_current_tenant_id()
    AND app_has_warehouse_access(id)
    AND app_current_user_role() IN ('owner', 'trader')
  )
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND app_has_warehouse_access(id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

DROP POLICY audit_events_tenant ON audit_events;

CREATE POLICY audit_events_select ON audit_events
  FOR SELECT
  USING (tenant_id = app_current_tenant_id());

CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant_id());
