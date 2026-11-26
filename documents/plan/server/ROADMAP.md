# Server Implementation Roadmap

The NestJS server owns the REST API, warehouse rules, PostgreSQL migrations, and background jobs. Steps 1–5 establish the first workflow using a manual purchase order. Steps 6–11 complete the pilot backend.

Read the [agent guide](../../../AGENTS.md), [project context](../../context/PROJECT-CONTEXT.md), [warehouse requirements](../../Requirments%20/REQUIREMENTS.md), and [approved technology stack](../../tech-stack/README.md). Use the requirements for warehouse behavior and the approved stack for infrastructure and provider choices. Follow the [server module layout](../../tech-stack/PROJECT-STRUCTURE.md#server).

## How the agent should work

Follow the [repository workflow](../../../AGENTS.md#workflow-for-every-step). Keep the same `Step N` heading in [Server Plan](PLAN.md) and [Server Progress](../../progress/server/PROGRESS.md). Save the plan before coding and include the verified progress entry in the commit pushed to `main`.

Implement in the owning server modules. Share business operations across REST, sync, and jobs. Record client contract changes in OpenAPI for Office Web and Worker Mobile.

## First workflow

### 1. Configuration and PostgreSQL readiness

- Share typed, validated configuration between the API and worker entry points. Update `.env.example` as settings are introduced and keep secrets out of logs and responses.
- Connect through a PostgreSQL pool using a least-privilege application role. Set up versioned migrations with a separate migration role. Keep `/api/v1/health` for liveness and add a database-backed readiness check.
- **Verify.** Start both entry points with valid configuration, reject missing or malformed required settings, and check that readiness reports unavailable when PostgreSQL is unreachable.

### 2. Identity, tenancy, and audit

- Add companies, warehouses, users, memberships, and tenant settings. Implement phone-based sign-in, JWT access tokens, refresh, sign-out, and device session revocation. Cover shared-device sign-in and idle-session policy in the step plan.
- Enforce owner, trader, and worker permissions using current membership. Scope records by tenant and warehouse, enforce PostgreSQL row-level security under the runtime role, and capture authenticated actors and timestamps for changes. Shape worker payloads without prices or costs.
- **Verify.** Use two synthetic tenants and two warehouses in one tenant. Test cross-tenant and unauthorized warehouse reads and writes, valid access, revoked sessions, and worker payloads.

### 3. Catalog and manual orders

- Add suppliers, customers and shipping marks, products, brands, and purchase orders. Validate quantities, amounts, dates, and totals when provided, preserving optional invoice fields for later import.
- Publish the draft, edit, confirm, and cancel endpoints and define their allowed status transitions. Expose confirmed orders in the warehouse's receiving queue with worker-safe fields.
- **Verify.** Create and confirm a synthetic order through `/api/v1`. An authorized worker can see its expected goods, and only authorized office roles can see or change its commercial fields.

### 4. Receiving, sync, and first stock movement

- Confirm online and synced receipts through the same service. Support multiple deliveries per order, server-assigned receipt numbers, CBM from carton dimensions, and findings for quantity, wrong items, damage, CBM, and weight. Apply the tenant's tolerances and save a receipt even when it raises findings.
- In one transaction, confirm the receipt, record stock by receipt lot, update order status, record findings and audit entries, and persist the client operation ID. Provide sync push and cursor-based pull. Preserve the original worker and define how retries and conflicting edits are reconciled.
- **Verify.** Submit an order in two deliveries, confirm that a discrepancy can be resolved separately, and replay a receipt concurrently. Verify one receipt number and one stock posting for the replay, correct partial status, and scoped catch-up from the sync cursor.

### 5. Stock reads and live updates

- Expose balances, movement history, and stock age by receipt lot. Support customer mark, supplier, brand, and product filters where required.
- Use Socket.IO to notify authorized tenant and warehouse subscribers of order, receipt, finding, and stock changes after the database commits. Use REST or sync pull to recover missed changes after reconnecting.
- **Verify.** Run a manual order → synced receipt → stock balance flow against PostgreSQL. Confirm that authorized subscribers get the update, other tenants get no event, a rolled-back receipt produces no event, and a reconnect recovers current state.

## Complete the pilot

### 6. Files and evidence

- Build one private file service with persistent VPS disk as the default and S3-compatible and Alibaba OSS providers selected through `.env`. Validate the selected provider on startup. Store each file's storage location and object key so existing files remain readable when the default write provider changes.
- Authorize uploads, linking, and downloads by tenant and warehouse. Link evidence to receipts, lines, pieces, adjustments, expenses, and imports. Let receipt confirmations and photo retries proceed independently.
- **Verify.** Test local persistence across restart, tenant access denial, upload retries, and reading an earlier file after switching providers. Check S3 and OSS in staging when their credentials are available.

### 7. Dispatch and stock adjustments

- Confirm dispatch online. Validate available cartons and allocate stock from identifiable receipt lots in the same transaction that records the movement. Expose packing-list data and preserve stock age after partial dispatches.
- Record stock adjustments as movements with a reason, photo, and actor.
- **Verify.** Submit two concurrent dispatches for insufficient combined stock and confirm that the ledger never goes negative. Check partial-lot balances, packing data, and adjustment evidence.

### 8. Expenses

- Record amount, currency, date, category, and optional customer or order link. Require invoice evidence or a trader's documented exception. Let the owner manage expense categories.
- **Verify.** Confirm both valid evidence paths, cross-tenant attachment denial, and that workers cannot retrieve expense or cost fields.

### 9. Background jobs and Excel exports

- Use pg-boss with the existing worker entry point. Return job IDs, restrict status and downloads to authorized users, and make retryable jobs safe to repeat.
- Use ExcelJS for receipts, dispatch and packing lists, inventory and stock movements, order comparisons, expenses, and the trilingual purchase order. Use the agreed templates, report filters, and authorized photo links or thumbnails as applicable.
- **Verify.** Run a report from enqueue through download. Check filters, totals, template columns, and job retries against seeded records.

### 10. Invoice ingestion and trader review

- Parse XLSX and searchable PDFs directly. Route scans and photos to the configured Model Studio profile, using DeepSeek Flash internationally and Qwen OCR in mainland China. Use the shared job and file services.
- Return purchase and expense drafts with source values and per-field uncertainty. Check quantities, line amounts, totals, deposits, freight, balance, and dates where applicable. Require review of uncertain fields and preserve manual order and expense entry.
- **Verify.** Use approved or synthetic samples covering spreadsheets, PDFs, printed images, and handwriting. Record missed lines, number errors, and correction time. Verify regional inference scope before sending live invoices.

### 11. Regional staging and pilot readiness

- Verify the same build and migrations for Hostinger internationally and Alibaba Cloud ECS in mainland China. Validate each profile's independent database, file storage, AI settings, Docker Compose services, and Nginx HTTPS and WebSocket routing.
- Check upgrade compatibility with the previous supported mobile version. Verify core API and live-update access from Yiwu without a VPN and practice restoring encrypted, region-local off-server backups of PostgreSQL and files.
- **Verify.** Record staging results per region and list any unresolved checks before pilot release.

## After the pilot

Use pilot feedback to improve handwritten invoice extraction, reports, and accounting exports. Plan customer onboarding, multi-warehouse administration, usage tracking, subscription billing, and customer read access as separate milestones.
