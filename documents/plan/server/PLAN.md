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

## Dependencies and verification

Use the local PostgreSQL instance for development. With synthetic data, verify database readiness, cross-tenant denial, and a receipt replay that leaves stock counted once. Coordinate the order and receipt contracts with [office web](../office-web/PLAN.md) and [worker mobile](../worker-mobile/PLAN.md).

[Server progress](../../progress/server/PROGRESS.md)
