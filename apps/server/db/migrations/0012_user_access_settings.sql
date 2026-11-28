ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true;
CREATE INDEX users_directory ON users (tenant_id, id);
CREATE INDEX users_active_owners ON users (tenant_id) WHERE active AND role = 'owner';
-- Discovering assignment options does not grant warehouse business access.
CREATE POLICY warehouses_owner_settings_select ON warehouses FOR SELECT
  USING (tenant_id = app_current_tenant_id() AND app_current_user_role() = 'owner');
CREATE OR REPLACE FUNCTION public.app_current_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT role FROM public.users WHERE id = public.app_current_user_id()
    AND tenant_id = public.app_current_tenant_id() AND active
$$;
CREATE OR REPLACE FUNCTION public.app_has_warehouse_access(p_warehouse_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id AND u.tenant_id = m.tenant_id
    WHERE m.tenant_id = public.app_current_tenant_id() AND m.user_id = public.app_current_user_id()
      AND m.warehouse_id = p_warehouse_id AND u.active)
$$;
CREATE OR REPLACE FUNCTION public.auth_find_user(p_phone text, p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, tenant_id uuid, name text, role text, password_hash text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT u.id, u.tenant_id, u.name, u.role, u.password_hash FROM public.users u
  WHERE u.phone = p_phone AND u.active AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
$$;
