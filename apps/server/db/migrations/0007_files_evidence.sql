CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  upload_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN (
    'receipt_photo', 'piece_photo', 'damage_photo', 'adjustment_photo',
    'expense_invoice', 'invoice_source', 'delivery_note', 'other'
  )),
  entity_type text CHECK (entity_type IN ('receipt', 'receipt_line', 'order', 'expense', 'adjustment', 'import')),
  entity_id uuid,
  provider text NOT NULL CHECK (provider IN ('local', 's3', 'oss')),
  object_key text NOT NULL,
  original_name text,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL,
  taken_at timestamptz,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, upload_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  CHECK ((entity_type IS NULL) = (entity_id IS NULL))
);

CREATE INDEX files_tenant_warehouse_idx ON files(tenant_id, warehouse_id);
CREATE INDEX files_entity_idx ON files(tenant_id, entity_type, entity_id);

CREATE TRIGGER files_set_updated_at BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY files_member_select ON files
  FOR SELECT
  USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));

CREATE POLICY files_member_insert ON files
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));

-- Evidence is append-only: no update or delete policies, and the runtime role keeps SELECT/INSERT only.
REVOKE UPDATE, DELETE ON files FROM PUBLIC;