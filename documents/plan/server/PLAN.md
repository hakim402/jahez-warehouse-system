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

## Dependencies and verification

Use the local PostgreSQL instance for development. With synthetic data, verify database readiness, cross-tenant denial, and a receipt replay that leaves stock counted once. Coordinate the order and receipt contracts with [office web](../office-web/PLAN.md) and [worker mobile](../worker-mobile/PLAN.md).

[Server progress](../../progress/server/PROGRESS.md)
