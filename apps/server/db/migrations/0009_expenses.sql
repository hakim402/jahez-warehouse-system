CREATE TABLE expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  name_cn text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, name)
);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES companies(id),
  warehouse_id uuid NOT NULL,
  expense_no text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  expense_date date NOT NULL,
  category_id uuid NOT NULL,
  customer_id uuid,
  order_id uuid,
  invoice_file_id uuid,
  no_invoice_note text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, expense_no),
  FOREIGN KEY (warehouse_id, tenant_id) REFERENCES warehouses(id, tenant_id),
  FOREIGN KEY (category_id, tenant_id) REFERENCES expense_categories(id, tenant_id),
  FOREIGN KEY (customer_id, tenant_id) REFERENCES parties(id, tenant_id),
  FOREIGN KEY (order_id, tenant_id) REFERENCES orders(id, tenant_id),
  FOREIGN KEY (invoice_file_id, tenant_id) REFERENCES files(id, tenant_id),
  FOREIGN KEY (recorded_by, tenant_id) REFERENCES users(id, tenant_id),
  -- Exactly one evidence path: an invoice file or a documented no-invoice exception.
  CHECK (
    (invoice_file_id IS NOT NULL AND no_invoice_note IS NULL)
    OR (invoice_file_id IS NULL AND no_invoice_note IS NOT NULL AND length(btrim(no_invoice_note)) > 0)
  )
);

INSERT INTO expense_categories (tenant_id, name)
SELECT id, category FROM companies
CROSS JOIN (VALUES ('transport'), ('labor'), ('handling'), ('rent')) AS defaults(category);

-- New tenants get the same starting categories at provisioning time.
CREATE FUNCTION public.seed_expense_categories() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  INSERT INTO public.expense_categories (tenant_id, name)
  VALUES (NEW.id, 'transport'), (NEW.id, 'labor'), (NEW.id, 'handling'), (NEW.id, 'rent');
  RETURN NULL;
END $$;

CREATE TRIGGER companies_seed_expense_categories AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_expense_categories();

CREATE INDEX expense_categories_tenant_id_idx ON expense_categories(tenant_id);
CREATE INDEX expenses_tenant_id_idx ON expenses(tenant_id);
CREATE INDEX expenses_warehouse_id_idx ON expenses(warehouse_id);
CREATE INDEX expenses_category_id_idx ON expenses(category_id);
CREATE INDEX expenses_customer_id_idx ON expenses(customer_id);
CREATE INDEX expenses_order_id_idx ON expenses(order_id);

CREATE TRIGGER expense_categories_set_updated_at BEFORE UPDATE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER expenses_set_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Costs stay office-only: workers must not read expenses or their categories.
CREATE POLICY expense_categories_office_select ON expense_categories
  FOR SELECT
  USING (tenant_id = app_current_tenant_id() AND app_current_user_role() IN ('owner', 'trader'));
CREATE POLICY expense_categories_owner_insert ON expense_categories
  FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_current_user_role() = 'owner');
CREATE POLICY expense_categories_owner_update ON expense_categories
  FOR UPDATE
  USING (tenant_id = app_current_tenant_id() AND app_current_user_role() = 'owner')
  WITH CHECK (tenant_id = app_current_tenant_id() AND app_current_user_role() = 'owner');

CREATE POLICY expenses_office_select ON expenses
  FOR SELECT
  USING (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );
CREATE POLICY expenses_office_insert ON expenses
  FOR INSERT
  WITH CHECK (
    tenant_id = app_current_tenant_id() AND app_has_warehouse_access(warehouse_id)
    AND app_current_user_role() IN ('owner', 'trader')
  );

REVOKE UPDATE, DELETE, TRUNCATE ON public.expenses FROM PUBLIC;
REVOKE DELETE, TRUNCATE ON public.expense_categories FROM PUBLIC;

DO $$
DECLARE
  runtime_role text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF runtime_role IS NOT NULL THEN
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.expenses FROM %I', runtime_role);
    EXECUTE format('REVOKE DELETE, TRUNCATE ON public.expense_categories FROM %I', runtime_role);
  END IF;
END $$;