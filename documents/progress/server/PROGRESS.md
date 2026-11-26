# Server Progress

## 2026-11-26 — Step 3: Catalog and manual purchase orders

Completed:

- Added migration `0005_catalog_manual_orders` for `parties`, `products`, `orders`, and `order_lines` with tenant references, audit columns, warehouse assignment, order status checks, and composite tenant foreign keys.
- Added tenant RLS for catalog tables; order reads require warehouse membership and order writes require owner/trader warehouse membership; order-line access follows the parent order.
- Added catalog APIs for parties and products: create, list, read, and edit, limited to owner/trader roles, with audit events.
- Added manual purchase-order APIs: create draft, list/read, edit draft, confirm draft to `ready`, and cancel `draft`/`ready` orders. Writes require owner/trader warehouse membership; lifecycle changes are audited.
- Added `GET /api/v1/orders/awaiting?warehouseId=...` for the assigned warehouse queue. It returns only `ready` orders with worker-safe fields and excludes prices, amounts, deposits, totals, and currency.
- Normalized order date responses to `YYYY-MM-DD` and made confirm/cancel return `200`.
- Closed the four review findings. The auth guard reads the current role from the user tied to the active session. Order inputs validate calendar dates and monetary precision, and use integer arithmetic for line amounts and totals. Migration `0005` enforces customer and supplier types through foreign keys.

Checks:

- `npx --yes pnpm@9 --dir apps/server typecheck`: passed.
- `npx --yes pnpm@9 --dir apps/server build`: passed.
- Disposable database verification: created `jahez_step3_verify` with separate runtime and migration roles, then dropped the database and roles afterward.
- Migration under the migration role: applied `0005_catalog_manual_orders`; rerun reported `No pending migrations`.
- Trader lifecycle: created a draft order, edited it, confirmed it to `ready`, and cancelled it; editing after confirmation and confirming a cancelled order were rejected.
- Worker permissions: confirm and edit were denied; the assigned worker saw the confirmed order in the warehouse queue; a recursive key scan found no price, amount, deposit, total, or currency fields; the full office order endpoint was denied to the worker.
- Tenant isolation: another tenant could not read, edit, confirm, or cancel the order, could not query the other warehouse queue, and did not see the order in its own queue; direct runtime-role SQL under the other tenant context returned zero rows.
- Audit records: `party.create`, `product.create`, `order.create`, `order.update`, `order.confirm`, and `order.cancel` were present.
- Review fixes verified through the API on a fresh disposable PostgreSQL 17 instance. An existing trader token lost office access after a downgrade while retaining the worker-safe queue. Invalid dates, extra unit-price precision, and mismatched amounts or totals returned `400`. Referenced party type changes returned `409`, unreferenced changes succeeded, and PostgreSQL rejected a direct type change for a referenced supplier. Verified exact cent rounding, cross-tenant denial, audit records, and an idempotent migration rerun. Typecheck and build passed again.

Blockers and notes:

- No Step 3 catalog/manual-order blockers.
- Receipt sync, stock movements, dispatch, expenses, invoice extraction, and live updates remain unimplemented.
- The worker queue exposes only `ready` orders; partly received/received queue behavior belongs to receiving.
- Disposable runtime grants included DML on the new catalog/order tables and `SELECT/INSERT` only on `audit_events`. Production grants remain environment-managed.

**Next** — Step 4, receipt confirmation, stock ledger, and offline sync.

## 2026-11-26 — Step 2 review fixes: atomic refresh, function grants, write RLS, append-only audit

Completed:

- Made refresh-token rotation atomic by updating the session only where the presented refresh-token hash still matches and the session is active; concurrent refresh calls cannot both succeed.
- Added migration `0004_auth_grants_write_rls_append_only_audit`.
- Restricted the four privileged auth and RLS helpers to the runtime role. The migration entry point uses the PostgreSQL driver's effective user from `DATABASE_URL`. The functions qualify application objects and use `search_path = pg_catalog, pg_temp`.
- Split warehouse RLS into a membership read policy and an owner/trader write policy so workers can read assigned warehouses but cannot update them in PostgreSQL.
- Made `audit_events` append-only with select/insert policies only and revoked update/delete privileges from the runtime role and `PUBLIC`.
- Updated `.env.example` runtime-grant guidance for append-only audit and migration-managed auth-function grants.

Checks:

- `npx --yes pnpm@9 --dir apps/server typecheck`: passed.
- `npx --yes pnpm@9 --dir apps/server build`: passed.
- Disposable database verification: created `jahez_step2r_verify` with runtime, migration, and unrelated roles, then dropped the database and roles afterward.
- Migration under the migration role: applied `0004_auth_grants_write_rls_append_only_audit`; rerun reported `No pending migrations`.
- Concurrent refresh: eight simultaneous calls with the same refresh token produced exactly one `201` and seven `401`.
- Unrelated database role: calls to `auth_find_user` and `auth_find_session` were denied with permission errors; the runtime role could still sign in and refresh.
- Worker warehouse access: API read `200`, API write `403`; direct runtime-role SQL read returned one row and update affected zero rows. Owner and trader API writes succeeded; owner direct SQL update affected one row.
- Audit append-only: runtime-role audit insert succeeded; runtime-role audit update and delete were denied.
- Follow-up verification on a separate PostgreSQL 17 instance applied `0004` over `0003` and confirmed an idempotent rerun. Verified all four search paths and confirmed execution grants follow the `user` URL option when it differs from the username in the URL authority. Reran sign-in, eight concurrent refresh attempts, worker versus owner/trader warehouse access, and append-only audit checks using synthetic records.

Blockers and notes:

- No review-fix blockers.
- When rotating to a different runtime role, explicitly grant the new role execution of the four privileged helpers and the required table privileges. Verify the new role, then revoke the old role's privileges. The migration runner skips an already-applied `0004`.
- Phone sign-in still uses a password credential; SMS/OTP delivery remains unimplemented.

**Next** — Step 3, catalog and manual purchase orders.

## 2026-11-26 — Step 2 follow-up: auth sessions, RLS, audit, and hardening

Completed:

- Left `JWT_SECRET` blank in `apps/server/.env.example` and rejected blank, short, and placeholder secrets at startup.
- Returned `400` for malformed warehouse IDs before membership lookup.
- Added phone sign-in with scrypt password hashes, 15-minute JWT access tokens, opaque refresh tokens stored as SHA-256 hashes, refresh rotation, sign-out, session listing, and owner device-session revocation.
- Checked session activity on every authenticated request so revoked or expired sessions fail even if the access token has not expired.
- Added migration `0003_rls_audit_auth_sessions` with `auth_sessions`, `audit_events`, tenant-context helper functions, and row-level security for companies, users, warehouses, memberships, sessions, and audit events.
- Enforced warehouse reads and writes through current tenant and warehouse membership; workers cannot write warehouses through the API.
- Added audit records for sign-in, refresh, sign-out, session revocation, and warehouse updates.
- Fixed a SQL parameter/column name collision in `app_has_warehouse_access` that would have allowed any warehouse in the tenant for a user with at least one membership.

Checks:

- `npx --yes pnpm@9 --dir apps/server typecheck`: passed.
- `npx --yes pnpm@9 --dir apps/server build`: passed.
- Disposable database verification: created `jahez_step2f_verify` with separate runtime and migration roles, then dropped the database and roles afterward.
- Migration under the migration role: applied `0003_rls_audit_auth_sessions`; rerun reported `No pending migrations`.
- Blank and placeholder `JWT_SECRET`: API startup exited with code `1`.
- Phone sign-in, refresh rotation, rotated-refresh rejection, sign-out, expired access token, revoked-session access token, and revoked-session refresh token: passed.
- Owner revocation of another user’s device session: passed; the revoked session’s access token returned `401`.
- Warehouse authorization: owner write `200`; worker write `403`; cross-tenant read/write `403`; non-member read/write `403`; malformed warehouse ID `400`.
- Runtime-role RLS checks with tenant/user context: cross-tenant and non-member warehouse reads returned zero rows; cross-tenant and non-member writes affected zero rows; cross-tenant audit insert was denied; runtime `CREATE TABLE` was denied.
- Audit records: `auth.sign_in`, `auth.refresh`, `auth.sign_out`, `auth.session_revoked`, and `warehouse.update` were present and tenant-scoped.

Blockers and notes:

- No Step 2 follow-up blockers.
- Phone sign-in currently uses a password credential; SMS/OTP delivery is not implemented.
- Set a long random `JWT_SECRET` in the local `.env` before starting the API or worker.
- Disposable runtime grants were `USAGE` on schema public and `SELECT/INSERT/UPDATE/DELETE` on the application tables, with no DDL. Production grants remain environment-managed.

Next: Stop before Step 3. Step 3 remains unstarted.

## 2026-11-25 — Step 2: Companies, warehouses, users, memberships, and warehouse access

Completed:

- Added migration `0002_companies_warehouses_users_memberships` with UUID keys, tenant references, `created_at`, `updated_at`, `created_by`, and `version`.
- Constrained memberships with composite foreign keys so the membership, user, and warehouse share one tenant; added `updated_at` triggers.
- Added JWT bearer authentication and required `JWT_SECRET` with a minimum length of 32 characters.
- Added a tenancy service that resolves warehouse access from memberships and a warehouse-access guard that denies cross-tenant, non-member, and mismatched-token-tenant access.
- Added protected `GET /api/v1/warehouses/:id` guarded by authentication and warehouse membership.
- Added a tenant-scoped query path through `DatabaseService` for module queries.

Checks:

- `npx --yes pnpm@9 --dir apps/server typecheck`: passed.
- `npx --yes pnpm@9 --dir apps/server build`: passed.
- Disposable database verification: created `jahez_step2_verify` with separate runtime and migration roles, then dropped the database and roles afterward.
- Migration under the migration role: applied `0001_baseline` and `0002_companies_warehouses_users_memberships`; rerun reported `No pending migrations`.
- Synthetic two-tenant seed: member access returned `200`; cross-tenant access returned `403`; non-member access returned `403`; a token whose tenant did not match the membership returned `403`.
- Missing bearer token and invalid bearer token both returned `401`.
- Worker with runtime `DATABASE_URL`: started and remained running.
- Runtime role schema-change denial: `CREATE TABLE` failed.

Blockers and notes:

- No Step 2 blockers.
- `JWT_SECRET` is now required; set a long random secret in the local `.env` before starting the API or worker.
- Disposable runtime grants were `USAGE` on schema public and `SELECT/INSERT/UPDATE/DELETE` on the four application tables, with no DDL. Production grants remain environment-managed.

Next: Stop after Step 2. Step 3 remains unstarted.

## 2026-11-25 — Step 1 follow-up: least-privilege database roles

Completed:

- Split database credentials: `DATABASE_URL` is the least-privilege API/worker runtime role; `MIGRATION_DATABASE_URL` is used only by the migration entry point.
- Made the migration entry point reject a missing or invalid `MIGRATION_DATABASE_URL` while runtime configuration does not require it.
- Hardened the migration runner to fail when a previously applied SQL file is missing or renamed, in addition to checksum drift.
- Documented both roles and URLs in `apps/server/.env.example`.

Checks:

- `npx --yes pnpm@9 --dir apps/server typecheck`: passed.
- `npx --yes pnpm@9 --dir apps/server build`: passed.
- Disposable database verification: created `jahez_step1_verify` with separate runtime and migration roles, then dropped the database and roles afterward.
- Migration entry point without `MIGRATION_DATABASE_URL`: exited with code `1` and required-URL error.
- Migrations under the migration role: applied `0001_baseline`; rerun reported `No pending migrations`.
- Runtime role schema-change denial: `CREATE TABLE`, `ALTER TABLE schema_migrations`, and `DROP TABLE schema_migrations` all failed.
- Worker with runtime `DATABASE_URL`: started and remained running.
- API with runtime `DATABASE_URL`: liveness and readiness returned `200`.
- Missing/renamed applied file check: renaming `0001_baseline.sql` caused migration failure with `Applied migration file missing or renamed: 0001_baseline`; the file was restored.

Blockers and notes:

- No Step 1 follow-up blockers.
- The local configured role was used only to create and clean up the disposable verification database and roles; application verification used the separate runtime and migration roles.

Next: Stop after Step 1. Step 2 remains unstarted.

## 2026-11-25 — Step 1: Configuration and PostgreSQL readiness

Completed:

- Added shared typed configuration for the API and worker, validating `PORT`, `DEPLOYMENT_PROFILE`, `DATABASE_URL`, `DATABASE_POOL_MAX`, and `DATABASE_TIMEOUT_MS`.
- Added a PostgreSQL pool service with bounded `SELECT 1` readiness checks and graceful shutdown.
- Added `GET /api/v1/health/ready` returning `200` when PostgreSQL is reachable and `503` when it is unavailable; kept `GET /api/v1/health` as the independent liveness route.
- Added a versioned SQL migration runner using `schema_migrations`, an advisory lock, per-migration transactions, and checksum drift detection. Applied the Step 1 baseline migration only.
- Made the worker fail fast when database readiness fails.

Checks:

- `npx --yes pnpm@9 --dir apps/server typecheck`: passed.
- `npx --yes pnpm@9 --dir apps/server build`: passed.
- `npx --yes pnpm@9 --dir apps/server migrate`: applied `0001_baseline`; second run reported `No pending migrations`.
- PostgreSQL available: `/api/v1/health` returned `200` with `{"status":"ok"}`; `/api/v1/health/ready` returned `200` with `{"status":"ok","database":"up","latencyMs":48}`.
- PostgreSQL unavailable via unreachable `127.0.0.1:59999`: `/api/v1/health` returned `200`; `/api/v1/health/ready` returned `503` with `{"status":"error","database":"down"}`; worker exited with code `1`.
- Invalid `DATABASE_URL`: API and worker both exited with code `1` before startup.

Blockers and notes:

- No Step 1 blockers.
- Local tooling note: `pnpm` was not on PATH and the corepack cache was missing its pnpm entry, so checks used `npx --yes pnpm@9`.
- The unavailable-database check used an unreachable endpoint; the local PostgreSQL instance was left running.

Next: Step 2 — companies, warehouses, users, and memberships migrations with warehouse membership authorization. Stop before Step 2.

## 2026-11-25 — Project baseline

- Available: NestJS API starter, health route, background worker entry point, and environment example.
- Checked previously: a direct local PostgreSQL query and a direct DeepSeek text request succeeded. API-level connectivity still needs verification.
- Next: validate the server environment and connect the API to PostgreSQL.

[Server plan](../../plan/server/PLAN.md)
