-- Step 9: background export jobs. pg-boss owns its schema; export_jobs tracks tenant-visible job state.
CREATE TABLE export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'goods_received', 'goods_dispatched', 'inventory', 'stock_movements',
    'order_vs_received', 'expenses', 'purchase_order'
  )),
  filters jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  requested_by uuid NOT NULL,
  storage_provider text CHECK (storage_provider IN ('local', 's3', 'oss')),
  object_key text,
  file_name text,
  size_bytes bigint CHECK (size_bytes >= 0),
  error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (requested_by, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE INDEX export_jobs_warehouse_created_idx ON export_jobs(warehouse_id, created_at DESC);
CREATE INDEX export_jobs_pending_idx ON export_jobs(status) WHERE status IN ('queued', 'processing');

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_jobs_office_select ON export_jobs
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

CREATE POLICY export_jobs_office_insert ON export_jobs
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
    AND requested_by = app_current_user_id()
  );

-- The job runner updates progress columns as the requesting user; full-row UPDATE stays revoked.
CREATE POLICY export_jobs_office_update ON export_jobs
  FOR UPDATE
  USING (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

REVOKE DELETE, TRUNCATE ON public.export_jobs FROM PUBLIC;
REVOKE UPDATE ON public.export_jobs FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS pgboss;

DO $$
DECLARE
  runtime_role text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF runtime_role IS NOT NULL THEN
    EXECUTE format('REVOKE DELETE, TRUNCATE, UPDATE ON public.export_jobs FROM %I', runtime_role);
    EXECUTE format(
      'GRANT UPDATE (status, storage_provider, object_key, file_name, size_bytes, error, completed_at, updated_at) ON public.export_jobs TO %I',
      runtime_role
    );
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA pgboss TO %I', runtime_role);
  END IF;
END $$;
