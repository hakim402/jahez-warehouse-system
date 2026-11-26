# Server Progress

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
