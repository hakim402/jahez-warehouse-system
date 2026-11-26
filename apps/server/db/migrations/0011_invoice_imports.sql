-- Step 10: invoice ingestion drafts. Office-only, warehouse-scoped; the draft jsonb holds extracted
-- header/lines with per-field value+confidence+source and the trader's review. Committed drafts point
-- at the order/expense they created via committed_entity_id.
CREATE TABLE invoice_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('purchase', 'expense')),
  source_file_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'draft', 'committed', 'failed')),
  provider text,
  draft jsonb NOT NULL DEFAULT '{}',
  requested_by uuid NOT NULL,
  committed_entity_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (source_file_id, tenant_id) REFERENCES files(id, tenant_id),
  FOREIGN KEY (requested_by, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE INDEX invoice_imports_warehouse_created_idx ON invoice_imports(warehouse_id, created_at DESC);
CREATE INDEX invoice_imports_pending_idx ON invoice_imports(status) WHERE status IN ('queued', 'processing');

CREATE TRIGGER invoice_imports_set_updated_at BEFORE UPDATE ON invoice_imports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE invoice_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_imports_office_select ON invoice_imports
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

CREATE POLICY invoice_imports_office_insert ON invoice_imports
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
    AND requested_by = app_current_user_id()
  );

CREATE POLICY invoice_imports_office_update ON invoice_imports
  FOR UPDATE
  USING (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

REVOKE DELETE, TRUNCATE ON public.invoice_imports FROM PUBLIC;
REVOKE UPDATE ON public.invoice_imports FROM PUBLIC;

DO $$
DECLARE
  runtime_role text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF runtime_role IS NOT NULL THEN
    EXECUTE format('REVOKE DELETE, TRUNCATE, UPDATE ON public.invoice_imports FROM %I', runtime_role);
    EXECUTE format(
      'GRANT UPDATE (status, provider, draft, committed_entity_id, error, updated_at) ON public.invoice_imports TO %I',
      runtime_role
    );
  END IF;
END $$;
