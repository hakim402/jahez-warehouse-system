ALTER TABLE users ADD COLUMN password_hash text;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  refresh_token_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  user_id uuid,
  warehouse_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX auth_sessions_tenant_id_idx ON auth_sessions(tenant_id);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX audit_events_tenant_id_idx ON audit_events(tenant_id);
CREATE INDEX audit_events_entity_idx ON audit_events(entity, entity_id);

CREATE TRIGGER auth_sessions_set_updated_at BEFORE UPDATE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER audit_events_set_updated_at BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION app_current_user_role() RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM users
  WHERE id = app_current_user_id() AND tenant_id = app_current_tenant_id()
$$;

CREATE FUNCTION app_has_warehouse_access(p_warehouse_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.tenant_id = app_current_tenant_id()
      AND m.user_id = app_current_user_id()
      AND m.warehouse_id = p_warehouse_id
  )
$$;

CREATE FUNCTION auth_find_user(p_phone text, p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, tenant_id uuid, name text, role text, password_hash text)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT u.id, u.tenant_id, u.name, u.role, u.password_hash
  FROM users u
  WHERE u.phone = p_phone
    AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
$$;

CREATE FUNCTION auth_find_session(p_refresh_token_hash text)
RETURNS TABLE(id uuid, tenant_id uuid, user_id uuid, device_id text, expires_at timestamptz, revoked_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT s.id, s.tenant_id, s.user_id, s.device_id, s.expires_at, s.revoked_at
  FROM auth_sessions s
  WHERE s.refresh_token_hash = p_refresh_token_hash
$$;

GRANT EXECUTE ON FUNCTION app_current_tenant_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION app_has_warehouse_access(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_user(text, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_session(text) TO PUBLIC;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_tenant ON companies
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

CREATE POLICY users_tenant ON users
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY memberships_tenant ON memberships
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY warehouses_member ON warehouses
  USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(id))
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(id));

CREATE POLICY auth_sessions_tenant ON auth_sessions
  USING (
    tenant_id = app_current_tenant_id()
    AND (user_id = app_current_user_id() OR app_current_user_role() = 'owner')
  )
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY audit_events_tenant ON audit_events
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());