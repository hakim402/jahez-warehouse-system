# Server Progress

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
