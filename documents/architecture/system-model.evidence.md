# Jahez Warehouse System — Evidence Index

Current-state model at commit `e56d1e2` (main), 2026-11-26. Server Steps 1–8 verified on disposable PostgreSQL; Steps 9–11 pending. Companion sources: [jahez.structurizr.dsl](jahez.structurizr.dsl), [server-modules.dot](server-modules.dot). Paths are relative to the repository root.

Confidence: **high** = direct code/schema/config evidence (behavior verified where noted), **medium** = partial signals, **low** = inferred, **unknown** = validation task.

## Nodes

| ID | Label | Type | Confidence | sourceRefs | Notes |
| --- | --- | --- | --- | --- | --- |
| actor.owner | Owner | actor | high | `apps/server/src/modules/tenancy/types.ts:3,36` | Role in `UserRole`; owner-only checks in expenses service |
| actor.trader | Trader | actor | high | `apps/server/src/modules/tenancy/types.ts:3,36` | Office role (`isOfficeRole`) |
| actor.worker | Worker | actor | high | `apps/server/src/modules/tenancy/types.ts:3` | Cost-isolation checks across files/expenses/realtime/sync |
| container.office-web | Office Web Dashboard | container | high (scaffold state) | `apps/office-web/src/app/app.tsx:1-7`, `apps/office-web/package.json` | Renders only "Jahez Office"; `src/api`, `src/features/*` dirs empty |
| container.worker-mobile | Worker Mobile App | container | high (scaffold state) | `apps/worker-mobile/lib/app/worker_app.dart:1-13`, `apps/worker-mobile/pubspec.yaml` | Renders only "Jahez Worker"; `lib/api`, `lib/offline`, feature dirs empty; no deps beyond Flutter |
| container.api | Warehouse API | container | high | `apps/server/src/main.ts:6-13`, `apps/server/src/app.module.ts:16-19` | REST prefix `api/v1`; Socket.IO attached to same HTTP server; behavior verified Steps 1–8 (`documents/progress/server/PROGRESS.md`) |
| container.worker-process | Background Worker Process | container | high (stub state) | `apps/server/src/worker.ts:5-17`, `apps/server/package.json` (`start:worker`) | Readiness check only; no job queue yet |
| container.migrator | Migration Runner | container | high | `apps/server/src/migrate.ts`, `apps/server/src/platform/migrator.ts`, `apps/server/db/migrations/0001_baseline.sql`…`0009_expenses.sql` | Ledger + advisory lock + checksum drift; applied to local DB through 0009 |
| container.db | Warehouse Database | container | high | `apps/server/src/platform/database.service.ts:35-54`, `apps/server/db/migrations/0003_rls_audit_auth_sessions.sql`, `0004`, `0006`, `0008`, `0009` | RLS GUCs `app.tenant_id`/`app.user_id`; append-only ledgers; `client_operations` idempotency; `document_counters` |
| container.local-files | Local File Storage | container | high | `apps/server/src/platform/storage.service.ts:57-85`, `apps/server/.env.example` (`STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`) | Default driver; path-traversal guard; persistence verified in Step 6 |
| external.s3 | S3-compatible Object Storage | external-system | medium | `apps/server/src/platform/storage.service.ts:87-118`, `apps/server/src/platform/server-config.ts:153-165` | Code path implemented; runtime cloud checks pending staging credentials (PROGRESS Step 6) |
| external.oss | Alibaba Cloud OSS | external-system | medium | `apps/server/src/platform/storage.service.ts:120-151` | Same: implemented, runtime unverified |
| component.tenancy | Tenancy | module | high | `apps/server/src/modules/tenancy/tenancy.module.ts:10-13`, `auth.guard.ts`, `warehouse-access.guard.ts`, `session-auth.service.ts` | JWT + `auth_sessions` revalidation |
| component.auth | Auth | module | high | `apps/server/src/modules/auth/auth.controller.ts:6-34` | login/refresh/logout/sessions routes |
| component.catalog | Catalog | module | high | `apps/server/src/modules/catalog/parties.controller.ts:6-29`, `products.controller.ts:6-29` | Parties + products CRUD |
| component.orders | Orders | module | high | `apps/server/src/modules/orders/orders.controller.ts:20-64` | awaiting/create/confirm/cancel |
| component.receiving | Receiving | module | high | `apps/server/src/modules/receiving/receiving.controller.ts:6-19`, `findings.controller.ts:6-16`, `receiving.service.ts` | Idempotent receipt confirm; findings |
| component.inventory | Inventory | module | high | `apps/server/src/modules/inventory/inventory.controller.ts:8-34`, `inventory.service.ts`, `adjustments.service.ts` | balances/movements/age/adjustments |
| component.dispatch | Dispatch | module | high | `apps/server/src/modules/dispatch/dispatch.service.ts`, `dispatch.controller.ts:6-21`, `apps/server/db/migrations/0008_dispatch_adjustments.sql` | FIFO allocation verified (54 checks, Step 7) |
| component.expenses | Expenses | module | high | `apps/server/src/modules/expenses/expenses.service.ts`, `expenses.controller.ts:6-36`, `apps/server/db/migrations/0009_expenses.sql` | Office-only; verified (59 checks, Step 8) |
| component.files | Files & Evidence | module | high | `apps/server/src/modules/files/files.service.ts`, `files.controller.ts:23-54`, `apps/server/db/migrations/0007_files_evidence.sql` | Purpose-based office-only set; content-type allowlist |
| component.sync | Offline Sync | module | high | `apps/server/src/modules/sync/sync.service.ts:15-68`, `sync.controller.ts:7-23` | Push = receipt replay only; pull = `sync_changes` cursor feed |
| component.realtime | Realtime Gateway | module | high | `apps/server/src/modules/realtime/realtime.service.ts:11,20-90` | Rooms `tenant:{t}:warehouse:{w}`; `OFFICE_ONLY_ACTIONS` skip worker sockets |
| component.platform | Platform | module | high | `apps/server/src/platform/platform.module.ts`, `database.service.ts`, `storage.service.ts`, `audit.ts`, `server-config.ts` | Shared config/DB/storage/audit |
| placeholder.identity / invoice-ingestion / reports | Empty module dirs | module (planned) | high (empty state) | `apps/server/src/modules/identity/`, `invoice-ingestion/`, `reports/` (no files) | Roadmap Steps 9–10 (`documents/plan/server/PLAN.md`) |

## Edges

| ID | From → To | Type / protocol | Confidence | sourceRefs |
| --- | --- | --- | --- | --- |
| edge.web-api | office-web → api | calls / HTTPS+WS — **planned, not implemented** | low (intent from AGENTS.md + roadmap) | `AGENTS.md`, empty `apps/office-web/src/api/` |
| edge.mobile-api | worker-mobile → api | calls / HTTPS+WS — **planned, not implemented** | low | `AGENTS.md`, empty `apps/worker-mobile/lib/api/`, `lib/offline/` |
| edge.api-db | api → db | reads+writes / SQL (pg pool, RLS GUCs per transaction) | high (verified) | `apps/server/src/platform/database.service.ts:35-54` |
| edge.api-local | api → local-files | writes+reads / file | high (verified Step 6) | `storage.service.ts:57-85`, `files.service.ts` |
| edge.api-s3 | api → s3 | writes+reads / S3 API | medium (code only; runtime pending) | `storage.service.ts:87-118` |
| edge.api-oss | api → oss | writes+reads / OSS SDK | medium (code only; runtime pending) | `storage.service.ts:120-151` |
| edge.worker-db | worker-process → db | reads / SQL (`SELECT 1`) | high | `apps/server/src/worker.ts:9-12`, `database.service.ts:56-67` |
| edge.migrator-db | migrator → db | writes / SQL (privileged role) | high | `apps/server/src/platform/migrator.ts` |
| edge.sync-receiving | sync → receiving | calls / in-process (`confirmReceipt` per queued op) | high (verified) | `sync.service.ts:27`, `sync.module.ts:9` |
| edge.dispatch-inventory | dispatch → inventory | calls / in-process (`postDispatchMovements`) | high (verified) | `dispatch.service.ts`, `inventory.service.ts`, `dispatch.module.ts:10` |
| edge.receiving-inventory | receiving → inventory | calls / in-process (receipt movements) | high (verified) | `receiving.module.ts:12`, `inventory.service.ts` |
| edge.*-realtime | orders/receiving/inventory/dispatch/expenses → realtime | publishes / in-process, post-commit | high (verified) | module `imports:` arrays; `realtime.service.ts:58-62` |
| edge.realtime-tenancy | realtime → tenancy | calls / in-process (session revalidation per delivery) | high | `realtime.service.ts:24,41,74` |
| edge.*-tenancy | all feature modules → tenancy | depends-on / guards | high | `*.module.ts` imports; `*.controller.ts` `@UseGuards(AuthGuard)` |
| edge.*-platform | all feature modules → platform | depends-on / DB, storage, audit | high | `*.module.ts` imports |
| edge.actors-clients | owner/trader → office-web; worker → worker-mobile | uses — **intended; UIs are scaffolds** | medium (role split evidenced server-side; UI assignment from AGENTS.md) | `AGENTS.md`, `tenancy/types.ts:36`, office-only RLS policies in 0009 |

## Assumptions and unknowns (validation tasks)

1. **Client integrations are unimplemented.** Both apps render placeholder text; no HTTP client, socket client, or offline queue code exists. The dashed "Planned" edges must not be read as working integrations. Validate when office-web/worker-mobile roadmaps start.
2. **Worker process is a stub.** Only a readiness check; pg-boss jobs and ExcelJS exports are Step 9 (planned). No queue technology is present in `apps/server/package.json` today.
3. **S3/OSS runtime behavior unverified.** Providers are implemented and config-validated, but cloud checks were deferred pending staging credentials (PROGRESS Step 6). Validate against a real bucket before Step 11 deployment.
4. **No deployment/IaC evidence in repo.** Regional staging (Hostinger international / Alibaba ECS CN) is Step 11 planned; runtime topology is unknown. Route to `deployment-topology-analyzer` when that step starts.
5. **Invoice ingestion external AI providers (DeepSeek/Qwen) are planned (Step 10), not current state.** `invoice-ingestion` module dir is empty; they are intentionally absent from the diagrams.
6. **Actor→client assignment** (office staff on web, workers on mobile) is evidenced by server role restrictions and AGENTS.md, but no client code confirms it; labeled intended/medium.

## Behavior verification evidence

Steps 1–8 were exercised end-to-end against disposable PostgreSQL databases with synthetic tenants, JWT sessions, and RLS-denial probes; results and check counts are recorded per step in `documents/progress/server/PROGRESS.md` (Step 7: 54 checks; Step 8: 59 checks). This is test-runtime evidence, not production telemetry.