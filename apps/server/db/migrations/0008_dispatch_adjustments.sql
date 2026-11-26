ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_id_tenant_unique UNIQUE (id, tenant_id);

CREATE TABLE dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  dispatch_no text NOT NULL,
  customer_id uuid NOT NULL,
  destination text,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  dispatched_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, dispatch_no),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (dispatched_by, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE TABLE dispatch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  dispatch_id uuid NOT NULL,
  supplier_id uuid,
  brand text,
  product_id uuid,
  cartons integer NOT NULL CHECK (cartons > 0),
  qty integer,
  cbm numeric(12, 6),
  weight_kg numeric(12, 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (dispatch_id, tenant_id) REFERENCES dispatches(id, tenant_id),
  FOREIGN KEY (supplier_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id)
);

CREATE TABLE dispatch_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  dispatch_line_id uuid NOT NULL,
  receipt_line_id uuid NOT NULL,
  stock_movement_id uuid NOT NULL,
  cartons integer NOT NULL CHECK (cartons > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (dispatch_line_id, tenant_id) REFERENCES dispatch_lines(id, tenant_id),
  FOREIGN KEY (receipt_line_id, tenant_id) REFERENCES receipt_lines(id, tenant_id),
  FOREIGN KEY (stock_movement_id, tenant_id) REFERENCES stock_movements(id, tenant_id)
);

CREATE TABLE stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  adjustment_no text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  note text,
  photo_file_id uuid NOT NULL,
  supplier_id uuid,
  brand text,
  customer_id uuid,
  product_id uuid,
  receipt_line_id uuid,
  cartons integer NOT NULL CHECK (cartons <> 0),
  qty integer,
  cbm numeric(12, 6),
  adjusted_by uuid NOT NULL,
  adjusted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, adjustment_no),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (photo_file_id, tenant_id) REFERENCES files(id, tenant_id),
  FOREIGN KEY (supplier_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id),
  FOREIGN KEY (receipt_line_id, tenant_id) REFERENCES receipt_lines(id, tenant_id),
  FOREIGN KEY (adjusted_by, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE INDEX dispatches_tenant_id_idx ON dispatches(tenant_id);
CREATE INDEX dispatches_warehouse_id_idx ON dispatches(warehouse_id);
CREATE INDEX dispatches_customer_id_idx ON dispatches(customer_id);
CREATE INDEX dispatch_lines_dispatch_id_idx ON dispatch_lines(dispatch_id);
CREATE INDEX dispatch_allocations_dispatch_line_id_idx ON dispatch_allocations(dispatch_line_id);
CREATE INDEX dispatch_allocations_receipt_line_id_idx ON dispatch_allocations(receipt_line_id);
CREATE INDEX stock_adjustments_tenant_id_idx ON stock_adjustments(tenant_id);
CREATE INDEX stock_adjustments_warehouse_id_idx ON stock_adjustments(warehouse_id);
CREATE INDEX stock_movements_lot_drawdown_idx ON stock_movements(receipt_line_id) WHERE kind <> 'receipt';

CREATE TRIGGER dispatches_set_updated_at BEFORE UPDATE ON dispatches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dispatch_lines_set_updated_at BEFORE UPDATE ON dispatch_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER dispatch_allocations_set_updated_at BEFORE UPDATE ON dispatch_allocations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER stock_adjustments_set_updated_at BEFORE UPDATE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Dispatch draws stock from an identified lot; adjustments must reference their adjustment record.
DROP POLICY stock_movements_member_insert ON stock_movements;
CREATE POLICY stock_movements_member_insert ON stock_movements
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND (
      (kind = 'receipt' AND cartons > 0 AND receipt_line_id IS NOT NULL)
      OR (kind = 'dispatch' AND cartons < 0 AND receipt_line_id IS NOT NULL AND ref_id IS NOT NULL)
      OR (kind = 'adjust' AND cartons <> 0 AND ref_id IS NOT NULL)
    )
  );

ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY dispatches_member_select ON dispatches
  FOR SELECT USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
CREATE POLICY dispatches_member_insert ON dispatches
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));

CREATE POLICY dispatch_lines_member_select ON dispatch_lines
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM dispatches d
      WHERE d.id = dispatch_lines.dispatch_id
        AND d.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(d.warehouse_id)
    )
  );
CREATE POLICY dispatch_lines_member_insert ON dispatch_lines
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM dispatches d
      WHERE d.id = dispatch_lines.dispatch_id
        AND d.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(d.warehouse_id)
    )
  );

CREATE POLICY dispatch_allocations_member_select ON dispatch_allocations
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM dispatch_lines dl
      JOIN dispatches d ON d.id = dl.dispatch_id AND d.tenant_id = dl.tenant_id
      WHERE dl.id = dispatch_allocations.dispatch_line_id
        AND d.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(d.warehouse_id)
    )
  );
CREATE POLICY dispatch_allocations_member_insert ON dispatch_allocations
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM dispatch_lines dl
      JOIN dispatches d ON d.id = dl.dispatch_id AND d.tenant_id = dl.tenant_id
      WHERE dl.id = dispatch_allocations.dispatch_line_id
        AND d.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(d.warehouse_id)
    )
  );

CREATE POLICY stock_adjustments_member_select ON stock_adjustments
  FOR SELECT USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
-- Stock corrections are office work; workers record receipts and dispatches only.
CREATE POLICY stock_adjustments_office_insert ON stock_adjustments
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

REVOKE UPDATE, DELETE, TRUNCATE ON public.dispatches, public.dispatch_lines, public.dispatch_allocations, public.stock_adjustments FROM PUBLIC;

DO $$
DECLARE
  runtime_role text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF runtime_role IS NOT NULL THEN
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.dispatches, public.dispatch_lines, public.dispatch_allocations, public.stock_adjustments FROM %I', runtime_role);
  END IF;
END $$;