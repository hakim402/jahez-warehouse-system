# Jahez Warehouse System — Current Architecture Summary

**Scope:** current state only, at commit `e56d1e2` (main), 2026-11-26. Server Steps 1–8 verified; Steps 9–11 planned.
**Produced by:** `architecture-visualization:system-modeler` with `c4model` (Structurizr DSL) and `graphviz` (module map).
**Audience:** developers and the product owner; readable without opening the diagrams.

## Reading order

1. This summary — business picture and boundaries.
2. [jahez.structurizr.dsl](jahez.structurizr.dsl) — open with Qoder's Structurizr DSL viewer; views `SystemContext` (L1), `Containers` (L2), `ServerComponents` (L3).
3. [server-modules.dot](server-modules.dot) — open with Qoder's Graphviz DOT viewer for the dense NestJS module dependency map.
4. [system-model.evidence.md](system-model.evidence.md) — every node/edge with source refs, confidence, and validation tasks.

## What the system is

A multi-tenant warehouse operations platform for JAHEZ TRADE CO. One NestJS 11 modular monolith (`apps/server`) owns all business rules, a single PostgreSQL database enforces tenant isolation with row-level security, and evidence files (receipt photos, adjustment photos, expense invoices) live in pluggable storage (local disk default, S3-compatible or Alibaba OSS selectable). Two client apps exist as **placeholder scaffolds only**: a React/Vite office dashboard and a Flutter worker app. A separate worker process entry exists but currently only checks database readiness.

## Business capabilities (all server-side, verified)

| Capability | Module | Who |
| --- | --- | --- |
| Sign-in, sessions, device revocation | auth + tenancy | all roles |
| Suppliers/customers and products | catalog | office (owner/trader) |
| Manual order entry, confirm, cancel | orders | office |
| Receipt confirmation with photo evidence, findings | receiving | all roles (workers via future offline sync) |
| Stock balances, movement ledger, lot age | inventory | warehouse members |
| Signed stock adjustments with mandatory photo | inventory/adjustments | office only |
| FIFO dispatch with packing list and shortage reporting | dispatch | warehouse members |
| Expense recording (invoice file XOR no-invoice note), categories | expenses | office only; categories owner-managed |
| Evidence upload/download with purpose-based access | files | role-scoped |
| Offline operation replay (push) and change feed (pull) | sync | workers |
| Live warehouse updates over Socket.IO | realtime | warehouse members |

## Boundaries that define the architecture

- **Tenant boundary:** every request runs inside `DatabaseService.withTenant`, which sets transaction-local `app.tenant_id`/`app.user_id` GUCs; PostgreSQL RLS policies filter every table. Cross-tenant access is denied by the database, not just the app (`database.service.ts:35-54`, migrations 0003/0004).
- **Warehouse boundary:** `WarehouseAccessGuard` + `app_has_warehouse_access()` membership checks; realtime rooms are `tenant:{tenant}:warehouse:{warehouse}` with session revalidation on every delivery (`realtime.service.ts:74-79`).
- **Cost-isolation boundary (workers never see money):** expenses REST is office-only via RLS; `expense_invoice`/`invoice_source` file purposes are blocked for workers on upload/list/download; `expense.recorded` is withheld from worker sockets; expenses are deliberately kept out of the `sync_changes` pull feed (`expenses.service.ts`, `files.service.ts`, `realtime.service.ts:11,79`).
- **Append-only ledgers:** `stock_movements`, `audit_events`, `sync_changes`, dispatch tables, `stock_adjustments`, `expenses` reject UPDATE/DELETE at the privilege and policy level; corrections happen via new signed movements (migrations 0004/0006/0008/0009).
- **Idempotency boundary:** writes claim a `client_operations` row (`ON CONFLICT DO NOTHING`); replays return the stored response or 409 on mismatch — this is what makes offline retry safe (`receiving.service.ts`, `dispatch.service.ts`, `adjustments.service.ts`, `expenses.service.ts`).
- **Concurrency boundary:** dispatch and negative adjustments serialize on a per-warehouse advisory stock lock; FIFO lot allocation can never drive a lot negative (verified with concurrent dispatches, Step 7).

## End-to-end business path (candidate for flow-visualizer)

**Receipt → stock → live update → offline recovery:** a confirmed receipt claims an idempotency key, posts positive lot-linked stock movements, writes audit + `sync_changes`, commits, then publishes to the warehouse room. Workers replay queued confirmations through `POST /sync/push` (per-item accept/reject with retryable flags) and recover missed changes through `GET /sync/pull` cursors. Dispatch later draws the same lots down FIFO. If a diagram of this path is needed, route to `architecture-visualization:flow-visualizer`.

## Evidence strength and what is NOT built yet

- **High confidence, behavior-verified:** the entire server API, RLS/role enforcement, idempotency, FIFO, cost isolation, local file storage — exercised on disposable PostgreSQL with recorded check counts (`documents/progress/server/PROGRESS.md`).
- **Scaffolds (structure only, no behavior):** office-web renders "Jahez Office"; worker-mobile renders "Jahez Worker". Their `api/`, `offline/`, and feature folders are empty. Client→API edges in the diagrams are dashed **Planned**.
- **Stub:** the worker process does a readiness check only; pg-boss jobs + ExcelJS exports are Step 9.
- **Configured but runtime-unverified:** S3 and OSS providers (cloud checks pending staging credentials).
- **Planned, absent from current-state diagrams:** invoice ingestion with DeepSeek/Qwen (Step 10, empty module dir), reports/identity modules (empty dirs), regional deployment (Step 11, no IaC in repo — route to `deployment-topology-analyzer` then).

## Maintenance note

Regenerate by re-running `system-modeler` against the repo after each verified step; update the DSL/DOT sources and the evidence index together. The `.dsl` and `.dot` files are the source of truth; any rendered preview is derived. These artifacts are currently uncommitted; commit them with a docs update if they should become maintained repository assets.