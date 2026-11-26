# Server Plan

## First milestone

Connect the NestJS API to PostgreSQL and support the first order-to-stock workflow.

1. Load and validate the server environment and check database readiness.
2. Add initial migrations for companies, warehouses, users, and memberships. Enforce access using warehouse membership.
3. Implement manual orders and idempotent receipt sync. Post stock movements in the receipt transaction and publish live updates after it commits.

## Step 1 — Configuration and PostgreSQL readiness

Scope: shared API/worker configuration, PostgreSQL connectivity, versioned migration infrastructure, and database readiness only. Keep the existing liveness route unchanged. Do not add tenant, warehouse, user, membership, order, or stock tables in this step.

Steps:

1. Add typed server configuration loaded from `apps/server/.env` and shared by the API and worker entry points. Validate `PORT`, `DEPLOYMENT_PROFILE`, `DATABASE_URL`, and optional database pool/timeout settings before either entry point starts.
2. Add a PostgreSQL pool service with bounded readiness queries and graceful shutdown. The API must still start when PostgreSQL is unavailable so liveness and readiness remain observable.
3. Add `GET /api/v1/health/ready`: return `200` when a bounded `SELECT 1` succeeds and `503` when PostgreSQL is unavailable. Keep `GET /api/v1/health` as the independent liveness check.
4. Add versioned SQL migrations under `apps/server/db/migrations` and a migration entry point that records applied versions in `schema_migrations`, uses an advisory lock, applies each migration in a transaction, and detects checksum drift. Include only a baseline migration; Step 2 owns the tenant schema.
5. Make the worker use the same validated configuration and fail fast when database readiness fails, while the API stays available for health checks.

Dependencies: local PostgreSQL, server dependencies installed with pnpm, and a local `.env` based on `.env.example`. No office-web or worker-mobile contract changes are required beyond the new readiness route.

Verification criteria:

- `pnpm --dir apps/server typecheck` and `pnpm --dir apps/server build` pass.
- Migration entry point applies the baseline migration and is safe to run again.
- With PostgreSQL available, liveness and readiness return `200`.
- With PostgreSQL unavailable, liveness returns `200` and readiness returns `503`; the worker exits with a readiness failure.
- Invalid shared configuration is rejected before the API or worker starts.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), then stop before Step 2.

### Step 1 follow-up — least-privilege database roles

Scope: remain within Step 1. Separate runtime and migration database credentials, harden migration history checks, and verify role separation on a disposable database. Do not add Step 2 tenant or warehouse tables.

Steps:

1. Use `DATABASE_URL` for the least-privilege API/worker runtime role. Use `MIGRATION_DATABASE_URL` only for the migration entry point and migration role. Runtime configuration must not require the migration URL; the migration entry point must reject a missing or invalid migration URL.
2. Make the migration runner compare every applied version in `schema_migrations` against the SQL files on disk. Fail if an applied file is missing or renamed, in addition to the existing checksum-drift failure.
3. Document both URLs in `apps/server/.env.example`, with the runtime role restricted from schema changes and the migration role used for DDL.

Verification criteria on a disposable database:

- Create a disposable database with a migration role capable of DDL and a runtime role restricted to connection/readiness and future DML, without schema-change privileges.
- Run migrations with `MIGRATION_DATABASE_URL`; confirm success and idempotent rerun.
- Start the worker and API readiness with `DATABASE_URL`; confirm the worker starts and readiness returns `200`.
- Confirm the runtime role cannot change the schema, for example `CREATE TABLE`, `ALTER TABLE`, or `DROP TABLE` attempts fail.
- Remove or rename an already-applied SQL file and confirm the migration runner fails before applying anything.
- Run server typecheck and build.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), commit and push the step, then stop after Step 1.

## Step 2 — Companies, warehouses, users, memberships, and warehouse access

Scope: tenant foundation and warehouse-membership authorization only. Add the initial companies/warehouses/users/memberships schema and enforce access from authenticated membership. Do not add orders, receipts, stock movements, dispatch, expenses, or invoice ingestion in this step.

Steps:

1. Add a versioned migration for `companies`, `warehouses`, `users`, and `memberships` with UUID keys, tenant references, `created_at`, `updated_at`, `created_by`, and `version`. Constrain memberships so the user, warehouse, and membership share one tenant.
2. Add JWT bearer authentication that resolves the user, tenant, and role from a signed token, and require `JWT_SECRET` in shared server configuration.
3. Add a tenancy service and warehouse-access guard that resolve access from `memberships` and deny cross-tenant or non-member warehouse access.
4. Add a protected warehouse read endpoint guarded by authentication and warehouse membership so the authorization path is exercised by the API.
5. Keep runtime database access least-privilege; schema changes remain migration-role only. Document runtime grants for the new tables.

Dependencies: Step 1 configuration, PostgreSQL pool, migration runner, and separate runtime/migration URLs. No office-web or worker-mobile changes are required in this step.

Verification criteria on a disposable database:

- Run the Step 2 migration under `MIGRATION_DATABASE_URL`; confirm success and idempotent rerun.
- Seed two synthetic tenants with users, warehouses, and memberships.
- Confirm a member receives `200` for an authorized warehouse.
- Confirm cross-tenant access, non-member access, and a token whose tenant does not match the membership receive `403`.
- Confirm missing or invalid bearer tokens receive `401`.
- Confirm the worker starts with the runtime role and the runtime role cannot change schema.
- Run server typecheck and build.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), commit and push the step, then stop after Step 2.

### Step 2 follow-up — auth sessions, RLS, audit, and hardening

Scope: remain within Step 2. Complete phone sign-in and device sessions, add PostgreSQL row-level security and audit events, and harden configuration and warehouse ID validation. Do not add orders, receipts, stock movements, dispatch, expenses, or invoice ingestion.

Steps:

1. Leave `JWT_SECRET` blank in `.env.example`. Reject blank, short, and placeholder secrets at startup. Return `400` for malformed warehouse IDs before authorization lookups.
2. Add phone sign-in using a password credential, short-lived access tokens, refresh-token rotation, sign-out, and device-session listing/revocation. Add `users.password_hash` and an `auth_sessions` table.
3. Add a new migration with PostgreSQL row-level security keyed by current tenant and user, warehouse-membership checks, and an `audit_events` table. Provide security-definer lookup helpers for sign-in and refresh so the runtime role remains least-privilege.
4. Enforce permissions from the current tenant and warehouse membership: validate active sessions on authenticated requests, require membership for warehouse reads, require owner/trader membership for warehouse writes, and run tenant-scoped writes in transactions that set RLS context and record audit events.

Dependencies: Step 2 schema and tenancy guards, Step 1 runtime/migration role separation, and local PostgreSQL for disposable verification. No office-web or worker-mobile changes are required in this follow-up.

Verification criteria on a disposable database:

- Run the new migration under `MIGRATION_DATABASE_URL`; confirm success and idempotent rerun.
- Seed two synthetic tenants with password credentials, warehouses, and memberships.
- Verify phone sign-in, refresh rotation, rejection of a rotated refresh token, sign-out, owner session revocation, expired access tokens, and revoked sessions.
- Verify cross-tenant and unauthorized warehouse reads/writes return `403` through the API and are denied by RLS under the runtime role; malformed warehouse IDs return `400`.
- Verify audit records exist for sign-in, refresh, sign-out, session revocation, and warehouse updates.
- Verify blank and placeholder `JWT_SECRET` values are rejected at startup.
- Run server typecheck and build.
- Record results, blockers, and open items in [Server progress](../../progress/server/PROGRESS.md), commit and push the follow-up, then stop before Step 3.

### Step 2 review fixes — atomic refresh, function grants, write RLS, append-only audit

**Status** — Review fixes verified on disposable PostgreSQL 17.

Scope: remain within Step 2. Address the four review findings without adding Step 3 order, receipt, or stock functionality.

Steps:

1. Make refresh-token rotation atomic: rotate by updating the session only where the presented refresh-token hash still matches and the session is active, so concurrent refresh calls cannot both succeed.
2. Add migration `0004` that revokes `PUBLIC` execute on the privileged security-definer auth/RLS helper functions and grants execute only to the intended runtime role. The migration entry point supplies the runtime role from `DATABASE_URL` through `app.runtime_role`.
3. In the same migration, split warehouse RLS into a membership read policy and an owner/trader write policy so workers can read assigned warehouses but cannot update them in PostgreSQL.
4. Make `audit_events` append-only: replace the all-command policy with select/insert policies only and revoke update/delete privileges, so the runtime role cannot edit or delete audit records.
5. Harden the four privileged functions in `0004` by qualifying application objects and setting a trusted search path with `pg_temp` last. Resolve the runtime role through the PostgreSQL driver so the grants follow the effective connection user. Document explicit grant and revoke steps for role rotation.

Verification criteria on a disposable database:

- Run migrations under `MIGRATION_DATABASE_URL`; confirm `0004` applies and rerun is idempotent.
- Issue concurrent refresh calls with the same refresh token; confirm exactly one succeeds and the others receive `401`.
- Confirm an unrelated database role cannot call the privileged auth functions, while the runtime role can sign in and refresh.
- Verify that the four function definitions use the hardened search path and that `0004` grants execution to the effective PostgreSQL user when the connection URL specifies a `user` query parameter.
- Confirm a worker can read its assigned warehouse through the API and direct runtime-role SQL, but cannot update it through the API or direct runtime-role SQL; owner/trader writes still succeed.
- Confirm the runtime role cannot update or delete audit records, while audit inserts still succeed.
- Run server typecheck and build.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), then stop before Step 3 for review.

## Step 3 — Catalog and manual purchase orders

**Status** — Implementation and review fixes verified on disposable PostgreSQL 17.

Scope: catalog parties/products and manual purchase-order lifecycle only: draft, edit, confirm, cancel, and a worker-safe confirmed-order queue for the assigned warehouse. Do not add invoice extraction, receipt sync, stock movements, dispatch, expenses, or reports in this step.

Steps:

1. Add migration `0005` for `parties`, `products`, `orders`, and `order_lines` with tenant references, audit columns, warehouse assignment on orders, and status values `draft`, `ready`, `partly_received`, `received`, and `cancelled`. Add tenant RLS; restrict order writes to owner/trader warehouse members and order reads to warehouse members. Make order-line access follow the parent order.
2. Add catalog APIs for parties and products: create, list, read, and edit under `/api/v1/parties` and `/api/v1/products`, limited to owner/trader roles and the current tenant. Record audit events for catalog changes.
3. Add manual purchase-order APIs under `/api/v1/orders`: create draft, list/read, edit draft, confirm draft to `ready`, and cancel `draft`/`ready` orders. Require owner/trader warehouse membership for writes and warehouse membership for reads. Validate supplier, customer, warehouse, and line references within the tenant. Record audit events for order lifecycle changes.
4. Expose `GET /api/v1/orders/awaiting?warehouseId=...` for the assigned warehouse queue. Return only `ready` orders and worker-safe fields: order identifiers, supplier/customer names, dates, status, and line product/brand/size/carton/quantity/CBM/weight fields. Exclude prices, amounts, deposits, totals, and currency from worker responses.
5. Keep runtime database access least-privilege; document runtime grants for the new tables.
6. Close the review findings. Resolve the role from the active session's current user, validate real calendar dates, calculate money at PostgreSQL precision, and enforce customer and supplier types on order references.

Dependencies: Step 2 tenancy guards, auth sessions, RLS helpers, and append-only audit. No office-web or worker-mobile changes are required in this step.

Verification criteria on a disposable database:

- Run migrations under `MIGRATION_DATABASE_URL`; confirm `0005` applies and rerun is idempotent.
- Seed or create two synthetic tenants with parties, products, warehouses, and memberships.
- Verify a trader can create, edit, confirm, and cancel a manual order; confirm changes status to `ready`; edit is rejected after confirmation; worker confirm/edit is denied.
- Verify the assigned worker sees the confirmed order in the warehouse queue and the response contains no price, amount, deposit, total, or currency fields.
- Verify another tenant cannot read, edit, confirm, or cancel the order, and cannot see it in its own warehouse queue.
- Verify an existing access token loses office access after a role downgrade. Check impossible dates, exact line and total arithmetic, mismatched supplied amounts, and party type changes with and without existing orders.
- Run server typecheck and build.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), then stop for review before receipt sync.

## Step 4 — Receipt confirmation, stock ledger, and offline sync

**Status** — Implementation and review fixes verified on disposable PostgreSQL 17. [Step 5](ROADMAP.md#5-stock-reads-and-live-updates) is next.

Scope: one shared receipt-confirmation operation for online requests and offline sync, partial deliveries, server-assigned receipt numbers, CBM calculation, discrepancy findings, transactional stock posting, and cursor-based sync. Do not add dispatch, expenses, reports, invoice extraction, or live WebSocket updates in this step.

Steps:

1. Add migration `0006` for `receipts`, `receipt_lines`, `findings`, `stock_movements`, `client_operations`, `document_counters`, and `sync_changes`. Add tenant/warehouse RLS, worker-safe receipt writes for warehouse members, and a restricted security-definer helper for receipt-driven order status updates so workers do not gain general order-write access.
2. Add a receiving service used by both the online API and sync push. In one transaction: claim the client operation ID, assign the server receipt number, save the receipt and lines, calculate CBM from measurements, create discrepancy findings, post stock movements through the inventory service, update order status for partial/full delivery, record audit, and append a worker-safe sync change. Replays of the same operation ID return the original receipt without new stock.
3. Support partial deliveries: compare received cartons with ordered cartons, flag missing/extra/wrong/damaged/CBM/weight findings, keep the order `partly_received` until all lines are covered, and set `received` when cumulative receipts cover the order. A discrepancy must not block receipt confirmation.
4. Add online receiving endpoints and sync endpoints: `POST /api/v1/receipts/confirm`, `GET /api/v1/receipts/:id`, `POST /api/v1/sync/push`, and `GET /api/v1/sync/pull?warehouseId=...&cursor=...`. Sync push invokes the same receiving service; pull returns worker-safe changes after the cursor for the assigned warehouse.
5. Keep prices and costs out of worker receipt, finding, stock, and sync responses. Document runtime grants for the new tables.
6. Close the review findings. Lock the order for receipt confirmation, restrict the privileged database helpers to the assigned warehouse, and make stock movements append-only. Preserve actual products and compare deliveries against outstanding quantities and tenant tolerances. Show partial orders in the queue, bind replays to the original request, return individual sync outcomes, and let traders resolve findings separately.

Dependencies: Step 3 orders/order lines, Step 2 warehouse membership and RLS helpers, append-only audit, and local PostgreSQL for disposable verification. No office-web or worker-mobile changes are required in this step.

Verification criteria on a disposable database:

- Run migrations under `MIGRATION_DATABASE_URL`; confirm `0006` applies and rerun is idempotent.
- Verify two partial deliveries can complete one order: first delivery leaves `partly_received`, second sets `received`, and stock movements sum to the ordered cartons.
- Verify a short delivery creates a discrepancy finding but still confirms the receipt and posts stock.
- Verify concurrent retries of the same client operation ID create exactly one receipt and one stock movement, and return the same receipt number.
- Verify tenant and warehouse isolation: another tenant cannot confirm or pull the receipt, and a non-member warehouse cannot confirm or pull changes.
- Verify worker responses and sync payloads contain no price/cost fields.
- Exercise both order cancellation race outcomes, a substituted product, an omitted line, proportional measurements, changed replay payloads, a mixed-result sync batch, and scoped finding resolution. Verify stock edits and deletes are denied under the runtime role.
- Run server typecheck and build.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), then stop before Step 5 for review.

## Step 5 — Stock visibility and commit-scoped live updates

**Status** — Implementation and review fixes verified on disposable PostgreSQL 17. [Step 6](ROADMAP.md#6-files-and-evidence) is next.

Scope: stock balances, movement history, stock age by receipt lot, and Socket.IO updates published only after committed changes. Do not add dispatch, expenses, reports, invoice extraction, or photo uploads in this step.

Steps:

1. Extend the inventory module with worker-safe read APIs: `GET /api/v1/stock`, `GET /api/v1/stock/movements`, and `GET /api/v1/stock/age`. Require warehouse membership. Support filters for customer mark, supplier, brand, and product. Derive balances from `stock_movements`; age lots from confirmed receipts.
2. Add a realtime module using Socket.IO attached to the API HTTP server. Authenticate sockets with the same JWT/session rules, authorize warehouse subscriptions from memberships, and scope rooms by tenant and warehouse.
3. Publish receipt/stock events only after the receipt transaction commits. Replays and rolled-back transactions must emit no event. Keep event payloads worker-safe.
4. Support reconnect recovery by letting clients re-subscribe and refresh missed changes through REST or cursor-based sync pull.
5. Close the review findings. Reuse REST session validation for sockets, check active sessions and warehouse membership before delivery, use canonical room IDs, and contain subscription errors. Add worker-safe order confirmation, cancellation, and finding-resolution events with transactional sync records.
6. Validate stock filters and movement paging input. Keep stock totals beyond the 32-bit range and page movement history with an opaque cursor that preserves the full timestamp and row ID.

Movement history accepts `limit` from 1 to 200 and a `cursor` from the previous response's `nextCursor`. Stock counts are JSON numbers within JavaScript's safe integer range and decimal strings above it. Socket.IO and sync pull carry `order.confirmed`, `order.cancelled`, `receipt.confirmed`, and `finding.resolved`. Use live messages to refresh the affected view and sync pull to catch up in commit order after reconnect.

Dependencies: Step 4 receipt confirmation, stock movements, sync changes, and warehouse membership. No office-web or worker-mobile changes are required in this step.

Verification criteria on a disposable database:

- Run server typecheck and build.
- Verify a synced receipt updates stock balances, movement history, and receipt-lot age; filters for customer mark, supplier, brand, and product work.
- Verify a replay of the same client operation adds no duplicate movement and emits no duplicate live event.
- Verify a rolled-back receipt confirmation emits no event.
- Verify unauthorized tenants/warehouses cannot subscribe and receive no events.
- Verify reconnect recovery: after disconnect and a new receipt, re-subscribe and pull missed changes from the sync cursor.
- Verify already-connected sockets lose access after revocation, token expiry, or membership removal. Check canonical subscriptions, malformed acknowledgments, and order and finding events, including recovery from the sync cursor.
- Verify malformed and repeated stock filters return `400`, movement pages have neither gaps nor repeats, and stock totals above the 32-bit range remain accurate.
- Record results and blockers in [Server progress](../../progress/server/PROGRESS.md), then stop before Step 6 for review.

## Dependencies and verification

Use the local PostgreSQL instance for development. With synthetic data, verify database readiness, cross-tenant denial, and a receipt replay that leaves stock counted once. Coordinate the order and receipt contracts with [office web](../office-web/PLAN.md) and [worker mobile](../worker-mobile/PLAN.md).

[Server progress](../../progress/server/PROGRESS.md)
