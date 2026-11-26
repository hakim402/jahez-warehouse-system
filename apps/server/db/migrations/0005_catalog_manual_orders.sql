CREATE TABLE parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL,
  name_cn text,
  type text NOT NULL CHECK (type IN ('customer', 'supplier')),
  shipping_mark text,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (id, tenant_id, type)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  name_ar text,
  name_en text,
  name_cn text,
  model_no text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  order_no text NOT NULL,
  customer_id uuid NOT NULL,
  customer_type text GENERATED ALWAYS AS ('customer'::text) STORED,
  supplier_id uuid NOT NULL,
  supplier_type text GENERATED ALWAYS AS ('supplier'::text) STORED,
  order_date date,
  expected_date date,
  deposit numeric(14, 2),
  total_amount numeric(14, 2),
  currency text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'partly_received', 'received', 'cancelled')),
  source text NOT NULL DEFAULT 'manual',
  source_file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, order_no),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  CONSTRAINT orders_customer_party_fk
    FOREIGN KEY (customer_id, tenant_id, customer_type) REFERENCES parties(id, tenant_id, type),
  CONSTRAINT orders_supplier_party_fk
    FOREIGN KEY (supplier_id, tenant_id, supplier_type) REFERENCES parties(id, tenant_id, type)
);

CREATE TABLE order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  brand text,
  size text,
  cartons integer NOT NULL CHECK (cartons > 0),
  qty_per_carton integer NOT NULL CHECK (qty_per_carton > 0),
  qty integer NOT NULL CHECK (qty > 0),
  unit_price numeric(14, 4),
  amount numeric(14, 2),
  cbm numeric(12, 6),
  weight numeric(12, 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  FOREIGN KEY (order_id, tenant_id) REFERENCES orders(id, tenant_id),
  FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id)
);

CREATE INDEX parties_tenant_id_idx ON parties(tenant_id);
CREATE INDEX products_tenant_id_idx ON products(tenant_id);
CREATE INDEX orders_tenant_id_idx ON orders(tenant_id);
CREATE INDEX orders_warehouse_status_idx ON orders(warehouse_id, status);
CREATE INDEX order_lines_order_id_idx ON order_lines(order_id);
CREATE INDEX order_lines_tenant_id_idx ON order_lines(tenant_id);

CREATE TRIGGER parties_set_updated_at BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER order_lines_set_updated_at BEFORE UPDATE ON order_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY parties_tenant_select ON parties
  FOR SELECT USING (tenant_id = app_current_tenant_id());
CREATE POLICY parties_owner_trader_write ON parties
  FOR ALL
  USING (tenant_id = app_current_tenant_id() AND app_current_user_role() IN ('owner', 'trader'))
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_current_user_role() IN ('owner', 'trader'));

CREATE POLICY products_tenant_select ON products
  FOR SELECT USING (tenant_id = app_current_tenant_id());
CREATE POLICY products_owner_trader_write ON products
  FOR ALL
  USING (tenant_id = app_current_tenant_id() AND app_current_user_role() IN ('owner', 'trader'))
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_current_user_role() IN ('owner', 'trader'));

CREATE POLICY orders_member_select ON orders
  FOR SELECT
  USING (tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id));
CREATE POLICY orders_owner_trader_write ON orders
  FOR ALL
  USING (
    tenant_id = app_current_tenant_id()
    AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  )
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

CREATE POLICY order_lines_member_select ON order_lines
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
        AND o.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(o.warehouse_id)
    )
  );
CREATE POLICY order_lines_owner_trader_write ON order_lines
  FOR ALL
  USING (
    tenant_id = app_current_tenant_id()
    AND app_current_user_role() IN ('owner', 'trader')
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
        AND o.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(o.warehouse_id)
    )
  )
  WITH CHECK (
    tenant_id = app_current_tenant_id()
    AND app_current_user_role() IN ('owner', 'trader')
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
        AND o.tenant_id = app_current_tenant_id()
        AND app_has_warehouse_access(o.warehouse_id)
    )
  );
