BEGIN;

GRANT USAGE ON SCHEMA public TO warehouse_runtime;
GRANT SELECT ON companies, warehouses, users, memberships, auth_sessions, audit_events,
  parties, products, orders, order_lines, client_operations, document_counters, receipts,
  receipt_lines, findings, stock_movements, sync_changes, files, dispatches, dispatch_lines,
  dispatch_allocations, stock_adjustments, expenses, expense_categories, export_jobs,
  invoice_imports TO warehouse_runtime;

GRANT INSERT ON users, memberships, auth_sessions, audit_events, parties, products, orders,
  order_lines, client_operations, document_counters, receipts, receipt_lines, findings,
  stock_movements, sync_changes, files, dispatches, dispatch_lines, dispatch_allocations,
  stock_adjustments, expenses, expense_categories, export_jobs, invoice_imports TO warehouse_runtime;

GRANT UPDATE ON companies, warehouses, users, auth_sessions, parties, products, orders,
  order_lines, client_operations, document_counters, findings, expense_categories TO warehouse_runtime;
GRANT DELETE ON memberships, order_lines TO warehouse_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO warehouse_runtime;

COMMIT;
