# Server Progress

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
