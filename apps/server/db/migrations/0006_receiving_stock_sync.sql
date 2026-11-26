ALTER TABLE order_lines ADD CONSTRAINT order_lines_id_tenant_unique UNIQUE (id, tenant_id);

ALTER TABLE companies
  ADD COLUMN cbm_tolerance_percent numeric(5, 2) NOT NULL DEFAULT 3 CHECK (cbm_tolerance_percent BETWEEN 0 AND 100),
  ADD COLUMN weight_tolerance_percent numeric(5, 2) NOT NULL DEFAULT 5 CHECK (weight_tolerance_percent BETWEEN 0 AND 100);

CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  receipt_no text NOT NULL,
  order_id uuid,
  customer_id uuid,
  supplier_id uuid,
  received_by uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, receipt_no),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (order_id, tenant_id) REFERENCES orders(id, tenant_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (supplier_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (received_by, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE TABLE receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  receipt_id uuid NOT NULL,
  order_line_id uuid,
  product_id uuid NOT NULL,
  cartons integer NOT NULL CHECK (cartons > 0),
  qty integer CHECK (qty > 0),
  length_cm numeric(10, 2),
  width_cm numeric(10, 2),
  height_cm numeric(10, 2),
  cbm numeric(12, 6),
  weight_kg numeric(12, 3),
  condition text NOT NULL DEFAULT 'ok' CHECK (condition IN ('ok', 'damaged')),
  brand text,
  size text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  FOREIGN KEY (receipt_id, tenant_id) REFERENCES receipts(id, tenant_id),
  FOREIGN KEY (order_line_id, tenant_id) REFERENCES order_lines(id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id)
);

CREATE TABLE findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  receipt_id uuid NOT NULL,
  receipt_line_id uuid,
  order_line_id uuid,
  type text NOT NULL CHECK (type IN ('missing', 'extra', 'wrong', 'damaged', 'cbm', 'weight')),
  expected numeric(18, 6),
  actual numeric(18, 6),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (receipt_id, tenant_id) REFERENCES receipts(id, tenant_id),
  FOREIGN KEY (receipt_line_id, tenant_id) REFERENCES receipt_lines(id, tenant_id),
  FOREIGN KEY (order_line_id, tenant_id) REFERENCES order_lines(id, tenant_id)
);

CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  supplier_id uuid,
  brand text,
  customer_id uuid,
  product_id uuid,
  cartons integer NOT NULL,
  qty integer,
  cbm numeric(12, 6),
  kind text NOT NULL CHECK (kind IN ('receipt', 'dispatch', 'adjust')),
  ref_id uuid,
  receipt_line_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (supplier_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id),
  FOREIGN KEY (receipt_line_id, tenant_id) REFERENCES receipt_lines(id, tenant_id)
);

CREATE TABLE client_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  operation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  kind text NOT NULL,
  receipt_id uuid,
  request_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, operation_id),
  FOREIGN KEY (user_id, tenant_id) REFERENCES users(id, tenant_id),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (receipt_id, tenant_id) REFERENCES receipts(id, tenant_id)
);

CREATE TABLE document_counters (
  tenant_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL,
  next_value bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, kind)
);

CREATE TABLE sync_changes (
  seq bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id)
);

CREATE INDEX receipts_tenant_id_idx ON receipts(tenant_id);
CREATE INDEX receipts_order_id_idx ON receipts(order_id);
CREATE INDEX receipt_lines_receipt_id_idx ON receipt_lines(receipt_id);
CREATE INDEX receipt_lines_order_line_id_idx ON receipt_lines(order_line_id);
CREATE INDEX findings_receipt_id_idx ON findings(receipt_id);
CREATE INDEX findings_status_idx ON findings(status);
CREATE INDEX stock_movements_tenant_id_idx ON stock_movements(tenant_id);
CREATE INDEX stock_movements_warehouse_id_idx ON stock_movements(warehouse_id);
CREATE INDEX stock_movements_ref_id_idx ON stock_movements(ref_id);
CREATE UNIQUE INDEX stock_movements_receipt_line_idx ON stock_movements(receipt_line_id) WHERE kind = 'receipt';
CREATE INDEX client_operations_warehouse_id_idx ON client_operations(warehouse_id);
CREATE INDEX sync_changes_tenant_warehouse_seq_idx ON sync_changes(tenant_id, warehouse_id, seq);

CREATE TRIGGER receipts_set_updated_at BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER receipt_lines_set_updated_at BEFORE UPDATE ON receipt_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER findings_set_updated_at BEFORE UPDATE ON findings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER stock_movements_set_updated_at BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER client_operations_set_updated_at BEFORE UPDATE ON client_operations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER document_counters_set_updated_at BEFORE UPDATE ON document_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION public.receiving_received_cartons(p_order_id uuid, p_order_line_id uuid) RETURNS bigint
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT COALESCE(SUM(rl.cartons), 0)
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id AND o.tenant_id = ol.tenant_id
  JOIN public.receipt_lines rl
    ON rl.order_line_id = ol.id AND rl.product_id = ol.product_id AND rl.tenant_id = ol.tenant_id
  JOIN public.receipts r ON r.id = rl.receipt_id AND r.tenant_id = rl.tenant_id
  WHERE ol.id = p_order_line_id AND ol.order_id = p_order_id
    AND r.order_id = p_order_id AND r.warehouse_id = o.warehouse_id AND r.status = 'confirmed'
    AND ol.tenant_id = public.app_current_tenant_id()
$$;

-- Lock the same order row as the office lifecycle operations without granting workers order updates.
CREATE FUNCTION public.receiving_lock_order(p_order_id uuid, p_warehouse_id uuid)
RETURNS TABLE(id uuid, status text, customer_id uuid, supplier_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT o.id, o.status, o.customer_id, o.supplier_id FROM public.orders o
  WHERE o.id = p_order_id AND o.warehouse_id = p_warehouse_id
    AND o.tenant_id = public.app_current_tenant_id()
    AND public.app_has_warehouse_access(o.warehouse_id)
  FOR UPDATE OF o
$$;

CREATE FUNCTION public.receiving_refresh_order_status(p_order_id uuid, p_warehouse_id uuid) RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  UPDATE public.orders o
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.order_lines ol WHERE ol.order_id = o.id
        AND public.receiving_received_cartons(o.id, ol.id) < ol.cartons
    ) THEN 'partly_received'
    ELSE 'received'
  END
  WHERE o.id = p_order_id AND o.warehouse_id = p_warehouse_id
    AND o.tenant_id = public.app_current_tenant_id()
    AND public.app_has_warehouse_access(o.warehouse_id)
    AND o.status IN ('ready', 'partly_received', 'received')
    AND EXISTS (
      SELECT 1 FROM public.receipts r WHERE r.order_id = o.id AND r.warehouse_id = o.warehouse_id
        AND r.tenant_id = o.tenant_id AND r.status = 'confirmed'
    )
  RETURNING o.status
$$;

DO $$
DECLARE
  runtime_role text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF runtime_role IS NULL THEN
    RAISE EXCEPTION 'app.runtime_role is required to grant receiving function privileges';
  END IF;
  REVOKE EXECUTE ON FUNCTION public.receiving_lock_order(uuid, uuid), public.receiving_refresh_order_status(uuid, uuid) FROM PUBLIC;
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.receiving_lock_order(uuid, uuid), public.receiving_refresh_order_status(uuid, uuid) TO %I', runtime_role);
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.stock_movements FROM %I', runtime_role);
END $$;

REVOKE UPDATE, DELETE, TRUNCATE ON public.stock_movements FROM PUBLIC;

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY receipts_member_select ON receipts
  FOR SELECT USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
CREATE POLICY receipts_member_write ON receipts
  FOR ALL
  USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id))
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));

CREATE POLICY receipt_lines_member_select ON receipt_lines
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM receipts r
      WHERE r.id = receipt_lines.receipt_id
        AND r.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(r.warehouse_id)
    )
  );
CREATE POLICY receipt_lines_member_write ON receipt_lines
  FOR ALL
  USING (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM receipts r
      WHERE r.id = receipt_lines.receipt_id
        AND r.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(r.warehouse_id)
    )
  )
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM receipts r
      WHERE r.id = receipt_lines.receipt_id
        AND r.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(r.warehouse_id)
    )
  );

CREATE POLICY findings_member_select ON findings
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM receipts r
      WHERE r.id = findings.receipt_id
        AND r.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(r.warehouse_id)
    )
  );
CREATE POLICY findings_member_insert ON findings
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND EXISTS (SELECT 1 FROM receipts r WHERE r.id = findings.receipt_id)
  );
CREATE POLICY findings_office_update ON findings
  FOR UPDATE
  USING (
    tenant_id = app_current_tenant_id()
    AND app_current_user_role() IN ('owner', 'trader')
    AND EXISTS (SELECT 1 FROM receipts r WHERE r.id = findings.receipt_id)
  )
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND app_current_user_role() IN ('owner', 'trader')
    AND EXISTS (SELECT 1 FROM receipts r WHERE r.id = findings.receipt_id)
  );

CREATE POLICY stock_movements_member_select ON stock_movements
  FOR SELECT USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
CREATE POLICY stock_movements_member_insert ON stock_movements
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND kind = 'receipt' AND cartons > 0 AND receipt_line_id IS NOT NULL
  );

CREATE POLICY client_operations_actor ON client_operations
  FOR ALL
  USING (
    tenant_id = app_current_tenant_id() AND user_id = app_current_user_id()
    AND app_has_warehouse_access(warehouse_id)
  )
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND user_id = app_current_user_id()
    AND app_has_warehouse_access(warehouse_id)
  );

CREATE POLICY document_counters_tenant ON document_counters
  FOR ALL
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

CREATE POLICY sync_changes_member_select ON sync_changes
  FOR SELECT USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
CREATE POLICY sync_changes_member_write ON sync_changes
  FOR ALL
  USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id))
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
