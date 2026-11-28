# Server Plan

The core server workflows have passed the recorded local checks. The follow-ups below remain open for client integration and pilot release. Use the [Server Roadmap](ROADMAP.md) for scope, the [agent workflow](../../../AGENTS.md#workflow-for-every-step) for the order of work, and [Server Progress](../../progress/server/PROGRESS.md) for results. Update the matching step here before editing server code.

## Follow-ups during client development

**Status** — Deferred for now. Review this checklist when starting Office Web or Worker Mobile work. Plan the relevant server changes under their original step number and record verification in Server Progress before marking an item complete.

| When to revisit | Server step | Open task and completion evidence |
| --- | --- | --- |
| Before Office Web and Worker Mobile sign-in integration | 2 | Provide a repeatable account-provisioning workflow for companies, owners, workers, and warehouse memberships. Verify that provisioned users can sign in with the intended access. |
| During Worker Mobile session implementation | 2 | Define and verify shared-tablet idle sign-out, local data cleanup, and remote device revocation with the client. |
| During Office Web integration | 11 | Start Hostinger staging and verify Docker API/worker startup, restricted database roles, Nginx HTTPS, WebSockets, and the complete order-to-stock flow. |
| During Office Web invoice review implementation | 10 | Add direct searchable-PDF parsing and benchmark DeepSeek/Qwen extraction on approved samples. Record accuracy, uncertain fields, and trader corrections before enabling live use. |
| During invoice testing | 10 | Evaluate handwritten invoices with manual correction available. Record the supported formats and remaining automation limits. |
| During Worker Mobile photo and sync integration | 6 | Verify receipt confirmation independently of photo retries, persistent local files, and S3/OSS upload/download round-trips. Confirm earlier files remain readable after a provider switch. |
| Before the warehouse pilot | 11 | Test recovery from encrypted database and file backups on the regional off-server target. Include all referenced S3/OSS objects in the recovery drill. |
| Before use in the Yiwu warehouse | 11 | Verify sign-in, receiving, photos, stock, and live updates on mainland Wi-Fi and mobile data without a VPN. |
| When two supported mobile versions exist | 11 | Verify the previous mobile release against the deployed API and test upgrade recovery with queued offline work. |

Use [Office Web's roadmap](../office-web/ROADMAP.md) and [Worker Mobile's roadmap](../worker-mobile/ROADMAP.md) to identify the relevant integration milestone. Keep deferred items open until their recorded checks pass.

## Step 1 — Configuration and PostgreSQL Readiness

**Local setup documentation** — Add the verified macOS PostgreSQL 14/17 service-conflict recovery to the server README, including listener inspection, service switching, API restart, and readiness verification.

**Review follow-up** — Queue startup no longer gates API liveness. Queue sends and worker consumption wait for initialization and retry a failed start.

**Status** — Verified.

1. Share typed configuration between the NestJS API and worker. Validate the deployment profile, connection settings, port, pool size, and timeouts.
2. Connect the API and worker with the restricted `DATABASE_URL` role. Use `MIGRATION_DATABASE_URL` for versioned SQL. Keep the migration ledger, advisory lock, transactions, checksum checks, and detection of deleted or renamed applied migrations.
3. Keep liveness at `GET /api/v1/health` and use `GET /api/v1/health/ready` for a bounded PostgreSQL check. Make the worker fail fast if the database is unreachable.

**Acceptance checks** — Typecheck and build. Verify healthy and unavailable database behavior, valid and invalid configuration, successful worker startup, migration rerun, missing migration detection, and runtime DDL denial.

## Step 2 — Identity, Tenancy, and Audit

### Core Office Web settings support — Implemented and synthetically verified (2026-11-28)

**Local sign-in recovery — Infrastructure verified; account sign-in pending (2026-11-28).** The running development database is at migration 0009 and lacks `users.active`, required by the updated authentication service. Apply existing forward migrations 0010–0012 using the configured migration role; verify migration checksums, database readiness, active-user schema/defaults and synthetic invalid-credential handling. Do not reset passwords or alter account assignments. Applied 0010–0012 successfully and started the stopped local API. Direct API and Office Web proxy readiness returned 200; synthetic nonexistent-user login returned expected 401. Credentials/assignments were not modified. Actual account sign-in remains user verification. Recovery recorded under Server Step 2.

This is an authorized follow-up to support Office Web Step 5. The existing verified Step 2 baseline remains unchanged. The user approved the mockups on 2026-11-28 and authorized implementation. Use a forward migration and disposable database verification; no deployment or live account changes.

1. Add owner-only tenant-scoped user/settings services and controllers. Contracts: `GET /users/:id` for explicit conflict reload and `GET /users` with search/role/active/cursor/limit (default 50, max 200) returning safe user records and `nextCursor`; `POST /users` with name/phone/role/initial password/warehouseIds; `PATCH /users/:id` with editable identity/role/active/warehouseIds plus expected version; `POST /users/:id/password-reset` with new password and expected version; `GET /settings/warehouses` returning existing company id/name/code options; GET/PATCH `/settings/receiving-tolerances` returning/updating both percentages and version. Return no passwords/hashes. Keep existing APIs compatible.
2. Add a forward migration for active-user status (existing accounts active), indexes, narrowly scoped owner access, and required runtime grants/functions. Reuse existing user/company versions for stale-write checks and increment versions on successful changes. Do not rewrite applied migrations, seed/rename categories, delete users, or create warehouses.
3. Perform user creation and membership assignment, and user edits plus membership replacement, transactionally. Validate company scope for every user and warehouse ID, enforce duplicate-phone handling, and audit safe field changes. Serialize owner-affecting changes with a company-row NO KEY UPDATE lock (compatible with sign-in foreign-key checks) so concurrent demotions/disables cannot remove the last active owner; reject self-disable. Preserve historical user IDs and warehouse records.
4. Hash initial/reset passwords with the existing scrypt helper; enforce 12–128 characters. Revoke affected sessions transactionally on password/role/access/active changes. Reject disabled users at login, refresh, authenticated REST, and Socket.IO revalidation, including old access tokens. Reactivation never revives revoked sessions. Keep mobile wire shapes stable; no forced password-change flow or deletion of pending offline operations.
5. Read/update company tolerance fields through an owner-only service. Validate 0–100 with at most two decimals and an expected-version conflict check; save both values atomically and audit before/after. Preserve 3% CBM/5% weight defaults and the existing receiving comparison service. Apply the new values on subsequent receipt processing; never regenerate historical findings.
6. Update the Backend Integration Guide with request/response/error shapes and access rules. Test on disposable PostgreSQL: owner success, trader/worker denial, cross-tenant and invalid-warehouse rejection, duplicate phone, stale versions, concurrent last-owner protection, self-disable, password bounds/reset, disable/reactivate, old-token/refresh/realtime rejection, audit redaction, migration rerun/runtime restrictions, and next-receipt tolerance changes without historical rewrites. Run server typecheck/build and Office Web build, record actual progress, and commit/push the verified implementation/documents together. Live-account and previous-mobile integration checks remain separate until exercised.

**Design dependency** Office Web references 17–19, linked from its Step 5 plan. **Current status** Implemented and synthetically verified; mockups approved. Server typecheck/build and Office Web build passed. The checked-in disposable regression covers real Nest HTTP/auth/owner guards, all planned service/RLS/concurrency/session/tolerance checks and receipt-history preservation. Migration 0012 was exercised and rerun only in disposable databases. Live application migration, owner/trader permission changes, actual Socket.IO delivery and previous-mobile checks remain pending.


**Status** — Verified for the recorded server scope. See the [pilot setup notes](../../progress/server/PROGRESS.md#step-2--identity-tenancy-and-audit).

1. Use migrations 0002–0004 to add companies, warehouses, users, memberships, authentication sessions, audit events, and tenant and warehouse row-level security.
2. Add phone-and-password sign-in, short-lived JWTs, atomic refresh rotation, sign-out, and device revocation. Require a real local `JWT_SECRET` and validate warehouse UUIDs before database queries.
3. Authorize warehouse reads by membership and writes by current owner/trader roles. Grant privileged functions to the effective runtime role, harden their search paths, and keep audit records append-only.

**Acceptance checks** — Typecheck and build. Verify session expiry and revocation, a single winner during concurrent refresh, cross-tenant and same-tenant non-member denials, worker read and write permissions, hardened function grants, and scoped audit records on disposable PostgreSQL.

## Step 3 — Catalog and Manual Purchase Orders

**Status** — Verified.

1. Add migration 0005, catalog endpoints for parties and products, and manual orders with drafts, edits, confirmation, cancellation, and tenant and warehouse access controls.
2. Enforce supplier and customer types with database constraints. Validate calendar dates, unit-price precision, line amounts, and totals. Resolve the authorizing role from the current session user.
3. Expose confirmed orders in a warehouse-scoped worker queue with an explicit field allowlist. Step 4 extends this queue with partial orders and outstanding cartons.

**Acceptance checks** — Typecheck and build. Create, edit, confirm, and cancel an order. Verify worker-safe fields, denial after a role downgrade, cross-tenant isolation, exact rounding, invalid input responses, and prevention of party type changes on referenced orders.

## Step 4 — Receiving, Offline Sync, and First Stock Movement

**Status** — Verified.

1. Add migration 0006 for receipts, receipt lines, findings, the append-only stock ledger, actor-scoped operation IDs, receipt counters, and warehouse sync changes.
2. Use one receipt-confirmation transaction for online requests and sync push. Lock the order against cancellation, record the actual products and receipt quantities, calculate CBM, and derive order status from confirmed receipt coverage.
3. Compare deliveries against outstanding cartons and proportional measurements using tenant tolerances. Keep partial orders visible and allow office roles to resolve findings separately.
4. Bind retries to the original actor, warehouse, order, and payload. Return the stored acknowledgment for identical requests, report each sync operation's result, and recover committed changes through a cursor.

**Acceptance checks** — Typecheck and build. Verify both cancellation race outcomes, actual-product stock posting, omitted lines, partial and final deliveries, scoped finding resolution, idempotent retries, mixed sync batches, and ledger write restrictions.

## Step 5 — Stock Reads and Live Updates

**Status** — Verified.

1. Expose warehouse-scoped balances, movement history, and receipt-lot age. Filter by customer mark, supplier, brand, and product. Validate filters, preserve wide stock counts, and page movement history by timestamp and ID.
2. Share REST and Socket.IO session validation. Canonicalize warehouse room IDs and recheck the session and membership before delivery.
3. Persist worker-safe changes in the transaction and publish after commit. Support receipt confirmation, order confirmation and cancellation, and finding resolution. Recover missed changes with sync pull.

**Acceptance checks** — Typecheck and build. Verify balance and lot totals above the 32-bit range, cursor coverage at microsecond precision, invalid filters, live receipt-to-stock updates, access revocation on connected sockets, rollback/replay behavior, and reconnect catch-up.

**Client contract** — Movement history accepts `limit` from 1 to 200 and a `cursor` from the previous response's `nextCursor`. Stock counts are JSON numbers within JavaScript's safe integer range and decimal strings above it. Re-fetch the affected view on a live event and pull the durable cursor on reconnect.

## Step 6 — Files and Evidence

**Review follow-up** — Nested tenant service calls reuse the same PostgreSQL client, so authorized file reads work with a pool size of one.

**Status** — Verified on disposable PostgreSQL. S3/OSS round-trip checks remain staging-dependent.

1. Extend `server-config.ts` and `.env.example` with validated storage settings: `STORAGE_DRIVER` (`local` default, `s3`, `oss`), `STORAGE_LOCAL_DIR` (relative to `apps/server`, outside the web root), `STORAGE_MAX_UPLOAD_MB`, and per-provider credentials (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE`; `OSS_BUCKET`, `OSS_REGION`, `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, optional `OSS_ENDPOINT`). Reject an unknown driver or missing credentials for the selected driver at startup.
2. Add a platform `StorageService` with one interface and three providers: private local disk (default), S3-compatible (`@aws-sdk/client-s3`), and Alibaba OSS (`ali-oss`). Providers are constructed from configuration per driver, so a file is always read through the provider stored on its row, not the current write default.
3. Add migration `0007_files_evidence`: `files` with tenant and warehouse scope, a client `upload_id` unique per tenant for independent retries, purpose, optional entity link (`receipt`, `receipt_line`, `order`, `expense`, `adjustment`, `import`), stored `provider` and `object_key`, original name, content type, size, SHA-256, uploader, and audit columns. RLS: warehouse members may select and insert; evidence metadata is append-only (no update/delete policies). Object keys are tenant-prefixed (`tenant/year/month/fileId`).
4. Add `FilesModule`: `POST /api/v1/files` (multipart, warehouse membership required, idempotent by `upload_id`, bytes written through the selected provider inside the same transaction that records metadata and audit), `GET /api/v1/files` (warehouse-scoped list with entity/purpose filters), `GET /api/v1/files/:id` and `GET /api/v1/files/:id/content` (membership re-checked against the file's warehouse; content streamed privately, never a public path). Validate known entity links against the matching receipt/line/order in the same warehouse.
5. Keep receipt confirmation and photo uploads independent: no photo is required to confirm or sync a receipt, and a photo may be uploaded or retried after the receipt commits. A retry with the same `upload_id` and bytes returns the original record; changed bytes return `409`. A failed storage write rolls back the metadata claim so the retry can proceed.

**Acceptance checks** — Typecheck and build. On disposable PostgreSQL: local upload persists across an API restart; cross-tenant and non-member reads/uploads are denied; identical upload retries create exactly one file and changed bytes conflict; a receipt syncs without photos and a photo links afterwards; after switching `STORAGE_DRIVER` to S3, earlier local files remain readable through their stored provider. Record S3/OSS round-trip checks as staging-dependent until credentials are available. Follow the [Step 6 roadmap](ROADMAP.md#6-files-and-evidence).

**Client contract** — Upload is `POST /api/v1/files?warehouseId=...` as multipart: file part `file`, fields `uploadId` (client UUID, the retry key), `purpose`, optional `entityType`/`entityId` pair, optional `takenAt`. Accepted content types: JPEG, PNG, WebP, HEIC/HEIF, PDF, XLSX, XLS, CSV; anything else returns `400`. Identical retries return the original record; changed bytes return `409`; a failed storage write leaves no record so the same `uploadId` can retry. Downloads are `GET /api/v1/files/:id/content` with the bearer token — there are no public or presigned URLs. Images serve inline; other types serve as attachments, always with `X-Content-Type-Options: nosniff`. The local storage directory is created and write-checked at startup.

## Step 7 — Dispatch and Stock Adjustments

**Review follow-up** — Dispatch now checks both the group ledger balance and available FIFO lots, preventing unlinked negative adjustments from being ignored.

**Status** — Verified on disposable PostgreSQL (54 checks).

**Goal** — Confirm dispatch online with FIFO receipt-lot allocation in one transaction, expose packing-list data, record evidenced stock adjustments, keep stock age correct after partial dispatches, and publish dispatch and adjustment events (Step 5 follow-up).

1. **Migration 0008.** Add append-only warehouse-scoped `dispatches`, `dispatch_lines`, `dispatch_allocations` (line → receipt lot → stock movement), and `stock_adjustments` (reason, note, required photo file, actor, signed cartons, optional lot link). Extend the `stock_movements` insert policy: dispatch rows must be negative and lot-linked, adjust rows non-zero and reference-linked; receipt rule unchanged. Add `UNIQUE (id, tenant_id)` to `stock_movements` for the allocation FK. RLS: members read/write dispatch tables; only owner/trader insert adjustments. Revoke UPDATE/DELETE/TRUNCATE on the new tables. Dispatch and adjustment numbers come from `document_counters`.
2. **Dispatch module.** `POST /api/v1/dispatches` creates a confirmed dispatch in one transaction (same pattern as receipt confirmation; the worker draft lives on the device, so there is no server draft state). Idempotent by `clientOperationId` through `client_operations` (`dispatch.confirm`). Lines name a stock group (supplier, brand, product — all optional, matching the balance dimensions) plus cartons; duplicate groups are rejected. `GET /dispatches?warehouseId=...&customerId=...` lists recent dispatches; `GET /dispatches/:id` returns the packing list (lines with product names, cartons, qty, CBM, weight, and per-lot allocations with receipt numbers and dates). No prices anywhere.
3. **Transactional allocation.** Take a per-tenant+warehouse advisory lock (`jahez.stock:...`) shared with negative adjustments. Validate available cartons per group and return `409` with the shortage when stock is insufficient. Allocate FIFO by receipt date; post one negative movement per allocated lot through `InventoryService` with `receipt_line_id` set, and record the allocation row. Qty, CBM, and weight are prorated per carton from the lot; a total is null when any contributing lot lacks the value.
4. **Adjustments.** `POST /api/v1/stock/adjustments` (owner/trader only) records a signed non-zero carton movement with a required reason and a required `photoFileId` (an `adjustment_photo` file already uploaded to the same warehouse — uploads stay independent, retries keyed by `clientOperationId`). Optional `receiptLineId` ties the adjustment to a lot and derives its stock dimensions; explicit dimensions are then rejected. Negative adjustments validate group stock and, when lot-linked, lot remainder under the same advisory lock. Audit and number as `ADJ-...`.
5. **Age, events, and links.** Rework `GET /stock/age` to sum all lot-linked movements (receipt +, dispatch −, adjust ±) per receipt lot and hide fully consumed lots; days still count from the receipt date. An adjustment without a lot link affects the group balance only, not lot age. Add a `customerId` stock filter. Extend `WarehouseChange` with `dispatch.confirmed` and `adjustment.recorded`, record them in `sync_changes`, and publish only after commit. Validate `adjustment` file entity links in `FilesService` against `stock_adjustments` in the same warehouse. Movement history exposes dispatch/adjustment numbers and the adjustment reason.

**Dependencies** — Steps 4–6 (movements ledger, client operations, files, realtime). Dispatch is online-only per roadmap; it is not a sync push operation. Adjustment listing is covered by movement history, audit, and `GET /files?entityType=adjustment`.

**Acceptance checks** — Typecheck and build. On disposable PostgreSQL: two concurrent dispatches exceeding combined stock leave the ledger non-negative (one succeeds, one 409); partial-lot balances and age remain correct; packing-list totals and allocations match; over-stock dispatch reports the shortage; replays return the original response and changed requests 409; adjustments require role, reason, and photo, and negative adjustments cannot overdraw; cross-tenant and non-member access is denied; events and sync changes appear only for committed work; runtime cannot update or delete the new tables.

**Client contract** — Dispatch: `POST /dispatches` with `clientOperationId`, `warehouseId`, `customerId`, optional `destination`/`dispatchedAt`, and `lines: [{supplierId?, brand?, productId?, cartons}]`. Insufficient stock returns `409` with per-line `available`/`requested`/`shortage`. Adjustment: `POST /stock/adjustments` with `clientOperationId`, `warehouseId`, `reason`, `photoFileId`, signed `cartons`, optional `qty`/`cbm` (same sign), optional `note`, and either stock dimensions (`customerId?`, `supplierId?`, `brand?`, `productId?`) or `receiptLineId`. Upload the photo first via `POST /files` with purpose `adjustment_photo`; it can be linked later with `entityType=adjustment`.

## Step 8 — Expenses

**Status** — Verified on disposable PostgreSQL (59 checks).

**Goal** — Record expenses with amount, currency, date, category, and optional customer/order links; require invoice evidence or a documented no-invoice exception; let the owner manage categories; keep every expense and cost field away from workers.

1. **Migration 0009.** Add tenant-scoped `expense_categories` (unique name per tenant, optional Chinese name, active flag; seed transport/labor/handling/rent for existing companies and via a trigger for new tenants) and warehouse-scoped append-only `expenses` (expense number, amount `numeric(14,2) > 0`, 3-letter currency, expense date, category FK, optional customer/order FKs, optional invoice file FK, no-invoice note, and a CHECK requiring exactly one evidence path). RLS: office-only SELECT on both tables; owner-only INSERT/UPDATE on categories; office INSERT on expenses. Revoke UPDATE/DELETE on expenses. Expense numbers come from `document_counters`.
2. **Categories API.** `GET /expense-categories` (owner/trader), `POST /expense-categories` (owner), `PATCH /expense-categories/:id` (owner: rename, activate/deactivate). No delete — referenced categories stay for history; new expenses require an active category.
3. **Expenses API.** `POST /api/v1/expenses` (owner/trader, idempotent by `clientOperationId` through `client_operations`, kind `expense.create`): `warehouseId`, `amount` (positive, ≤2 decimals), `currency` (ISO 4217-style 3 letters), `expenseDate`, `categoryId`, optional `customerId` (customer party) and `orderId` (validated in the same warehouse), and exactly one of `invoiceFileId` (an `expense_invoice` file in the same warehouse) or `noInvoiceNote` (the documented exception). `GET /expenses?warehouseId=...` with category/customer/order filters; `GET /expenses/:id` includes the evidence reference. Audit `expense.recorded`.
4. **Worker cost isolation.** Expenses and categories are office-only at the service and RLS layers. `FilesService` restricts `expense_invoice` and `invoice_source` purposes to office roles on upload, list, metadata, and download, so workers cannot read invoice images that expose costs. Expense changes are published live as `expense.recorded` to office sockets only (worker sockets in the same room are skipped) and are deliberately not written to `sync_changes`, which workers pull.
5. **Events and links.** Extend `WarehouseChange` with `expense.recorded`; validate `expense` file entity links in `FilesService` against `expenses` in the same warehouse.

**Dependencies** — Steps 2 (roles/RLS), 6 (files), 7 (events pattern). `POST /expenses/extract` (invoice reading) belongs to Step 10. Expenses are online-only for the pilot; offline expense capture can reuse the same service through sync push later.

**Acceptance checks** — Typecheck and build. On disposable PostgreSQL: both evidence paths succeed (invoice file, documented exception); missing/both evidence returns 400; a file from another warehouse or an unknown order link is denied; workers get 403 on expense/category reads and writes, cannot list or download expense-invoice files, receive no expense live event, and see no expense data in sync pull; owner-only category management; amount/currency/date validation; replay idempotency; cross-tenant denial; audit and migration rerun.

**Client contract** — Upload the invoice first via `POST /files` with purpose `expense_invoice`; it can be linked later with `entityType=expense`. Create with `POST /expenses` (`clientOperationId`, `warehouseId`, `amount`, `currency`, `expenseDate`, `categoryId`, optional `customerId`/`orderId`, and `invoiceFileId` XOR `noInvoiceNote`). Identical retries return the original record; changed requests return 409. Workers never receive expense rows, category rows, or expense-invoice files.

## Step 9 — Background Jobs and Excel Exports

**Review follow-up** — Order comparison excludes substituted products and includes CBM and open findings. Inventory age uses the oldest remaining receipt lot.

**Status** — Verified on disposable PostgreSQL (78 checks).

**Goal** — Generate the seven pilot Excel reports on the server through pg-boss background jobs consumed by the existing worker entry point. Return a job id from `POST /exports`, restrict status and file download to authorized office users, and make retried jobs safe to repeat. Keep report logic DRY: one shared filter parser, one shared workbook writer, one registry of small per-report query builders.

1. **Migration 0010.** Add warehouse-scoped `export_jobs` (kind CHECK over the seven report types, filters jsonb, status CHECK `queued|processing|completed|failed`, requested_by, storage_provider, object_key, file_name, size_bytes, error, completed_at) with office-only RLS select/insert and a narrow update policy for status transitions; revoke DELETE/TRUNCATE and grant column-level UPDATE only on the job-progress columns. Create the `pgboss` schema and grant USAGE/CREATE to the runtime role so pg-boss can own its internal tables.
2. **Jobs module.** `JobsService` wraps pg-boss against the existing `DATABASE_URL`: both API and worker start the connection; only the worker calls `startConsuming()`, which begins working every handler registered by feature modules (registration happens in module init, so Step 10's invoice extraction reuses the same service). pg-boss runs with `createSchema:false` (the `pgboss` schema is created and owned via migration 0010), creates each queue with the shared retry policy before the first send/work, and listens for instance errors so a queue fault never crashes the process. Retries: `retryLimit` with exponential backoff; handlers must be idempotent.
3. **Exports API (office-only).** `POST /exports` validates kind + applicable filters (date range, customerId, supplierId, orderId for purchase_order), inserts the `export_jobs` row, sends the pg-boss job keyed by the export id, audits `export.created`, and returns `{id, status}`. `GET /exports?warehouseId=` lists recent jobs, `GET /exports/:id` returns status/error/file name, `GET /exports/:id/file` streams the generated workbook with `Content-Disposition: attachment`. Workers get 403 on every route; non-members and other tenants get 404 via RLS.
4. **Report builders (DRY).** `reports/filters.ts` parses and validates the shared filter set into SQL fragments; `reports/excel.ts` builds the workbook (styled header, frozen pane, column widths, number formats, bold totals row) from a common `{columns, rows, totals}` shape; `reports/registry.ts` maps each kind to a builder returning that shape from RLS-scoped SELECTs: goods_received (receipt no, date, customer mark, supplier, product, cartons, CBM, weight, worker, authenticated photo links), goods_dispatched (dispatch no, date, customer mark, product lines, cartons, CBM, weight — doubles as packing list), inventory (per customer mark and product: cartons, CBM, weight, days in storage from lot age), stock_movements (every receipt/dispatch/adjustment with kind, reference no, date, user), order_vs_received (per ordered line: ordered vs received cartons/qty/CBM, difference, status, open findings), expenses (date, category, amount, currency, linked customer/order, invoice link or no-invoice note), purchase_order (trilingual EN/AR/CN order sheet with product names in all three languages, model, cartons, qty, unit price, amount, CBM, weight, photo links, totals). Photo references are API download links that require the caller's own authorization — never embedded credentials.
5. **Job runner and worker wiring.** The registered handler loads the job row, runs the builder inside `withTenant(job.tenant_id, job.requested_by)` so RLS and office policies apply exactly as for the requesting user, writes the buffer to the configured storage provider under `exports/{tenantId}/{warehouseId}/{jobId}.xlsx` (stable key — reruns overwrite the same object), and records completion or failure on the row. Terminal-state guard: an already completed job is not reprocessed. `worker.ts` calls `startConsuming()` after the readiness check.

**Dependencies** — Step 2 (roles/RLS), Step 6 (storage providers), Steps 3–8 (reported data). pg-boss and ExcelJS are new dependencies. Invoice-reading jobs are Step 10 and only consume this step's shared job service.

**Acceptance checks** — Typecheck and build. On disposable PostgreSQL: each of the seven kinds runs enqueue → processing → completed → download and produces a workbook whose sheets, columns, and totals match seeded records; filters (date range, customer, supplier, order) narrow rows; workers get 403 on create/list/status/download; cross-tenant and non-member access is denied; a retried/duplicated job is safe (stable object key, single terminal state, no duplicate rows); failure paths record `failed` with a sanitized error; audit records; migration rerun is clean.

**Client contract** — `POST /exports` with `{warehouseId, kind, filters: {from?, to?, customerId?, supplierId?, orderId?}}` → `{id, kind, status}`. Poll `GET /exports/:id` until `completed`, then `GET /exports/:id/file` for the xlsx. Office roles only; identical filters produce identical files because generation is deterministic server-side.

## Step 10 — Invoice Ingestion and Trader Review

**International DeepSeek activation — Verified on one synthetic invoice (2026-11-28).** Use the canonical `INVOICE_AI_API_KEY` setting in Hostinger's private environment file. Verify the deployed provider's structured extraction against known synthetic fields, then recreate the API and worker and check readiness. Representative invoice accuracy, queued production workflow and mainland provider checks remain pending.

**Review follow-up** — Review and commit lock the import row and share one tenant transaction with order or expense creation, preventing duplicate orders and partial commits.

**Status** — Verified on disposable PostgreSQL (37 checks).

**Goal** — Ingest supplier purchase invoices and expense invoices from Excel or a photo/scan, return a draft with source values and per-field confidence, require trader review of uncertain fields, and commit the reviewed draft into a real order or expense through the existing services. Route extraction to the regional provider and reuse the shared job and file services. Never send real supplier invoices to an external service during verification.

1. **Migration 0011.** Add warehouse-scoped, office-only `invoice_imports`: `kind` (`purchase|expense`), `source_file_id` FK to `files(id, tenant_id)`, `status` (`queued|processing|draft|committed|failed`), `provider`, `draft` jsonb (header + lines, each field carrying `value`/`confidence`/`source`, plus a `review` object), `requested_by`, `committed_entity_id`, `error`, and timestamps. RLS: office-only SELECT/INSERT and an office UPDATE for progress/review columns; REVOKE DELETE/TRUNCATE. Add the `import` branch to `FilesService.assertEntityLink` validating against `invoice_imports` in the same warehouse (the note left in Step 6).
2. **Config.** Parse `INVOICE_AI_*` into a typed `invoiceAi` config: `provider` (`deepseek|qwen|sample|none`), `baseUrl`, `model`, `apiKey`, `timeoutMs`. Regional default when `INVOICE_AI_PROVIDER` is unset: `cn-mainland` → `qwen`, otherwise → `deepseek`. Require `apiKey`/`baseUrl` for `deepseek`/`qwen`; `sample`/`none` need no key. Document all variables in `.env.example`.
3. **Extraction pipeline (reuse JobsService, queue `invoice.extract`).** The runner loads the import + source-file rows inside `withTenant(tenant, requestedBy)`, reads the bytes through the file's stored provider, and dispatches by content type: a spreadsheet (`xlsx`) is parsed directly by matching columns on Chinese/English/Arabic header keywords; an image/PDF/other goes to the configured vision provider. Providers sit behind one interface — `sample` (deterministic synthetic draft for dev/CI/verification, no network), `deepseek` (international HTTP), `qwen` (mainland HTTP) — and every field is emitted as `{value, confidence, source}`. The draft is persisted with `status='draft'`; the runner is retry-safe (stable draft, terminal guard, failure recorded in a separate transaction), mirroring Step 9.
4. **Ingestion API (office-only).** `POST /orders/extract` and `POST /expenses/extract` `{warehouseId, fileId}` create the import (purchase requires an `invoice_source` file, expense an `expense_invoice` file), enqueue, and return `{id, status}`. `GET /imports?warehouseId=` lists, `GET /imports/:id` returns the draft with confidence and status. `PATCH /imports/:id` lets the trader correct values, resolve `supplierId`/`customerId` and per-line `productId` (purchase) or `categoryId` (expense), and record reviewed low-confidence field paths. `POST /imports/:id/commit` enforces that every below-threshold field is reviewed and required ids resolved, then delegates to `OrdersService.createDraft` (purchase, `source='excel'|'photo'`) or `ExpensesService.recordExpense` (expense) so all existing validation stays authoritative; it records `status='committed'` and `committed_entity_id`. Workers get 403 on every route.
5. **Regional routing and provenance.** Provider is chosen from config/profile and recorded on the import; committed orders carry the ingestion `source` and the source-file reference. Manual order and expense entry is unchanged (preserved fallback).

**Dependencies** — Steps 2 (roles/RLS), 3 (orders), 6 (files), 8 (expenses), 9 (jobs). `OrdersService.createDraft` gains an optional `source`/`sourceFileUrl` (defaults keep current behavior). **Recorded pending:** live DeepSeek/Qwen extraction accuracy and direct searchable-PDF text parsing need real API keys and user-authorized synthetic samples — private supplier invoices must not be sent to an external service, so until then PDFs route to the vision provider and the pipeline is verified with the deterministic `sample` provider plus synthetic spreadsheets. Handwritten invoices remain out of automatic scope (manual fallback).

**Acceptance checks** — Typecheck and build. On disposable PostgreSQL with `INVOICE_AI_PROVIDER=sample`: a purchase XLSX ingest runs enqueue → draft with lines and confidence; review resolves supplier/customer/products and clears low-confidence fields; commit creates a draft order with correct lines and total. An expense ingest commits to an expense via the `expense_invoice` file. A below-threshold field blocks commit until reviewed; an unresolved required id blocks commit. Workers get 403 on extract/list/status/patch/commit; cross-tenant and non-member access is denied; provider routing selects `qwen` under `cn-mainland`, `deepseek` under `international`, and honors a `sample` override; retries are safe; migration rerun is clean. Live provider accuracy and direct PDF parsing are recorded as pending (keys + authorized samples).

**Client contract** — Upload the invoice with `POST /files` (purchase → purpose `invoice_source`; expense → purpose `expense_invoice`). Call `POST /orders/extract` or `POST /expenses/extract` `{warehouseId, fileId}` → `{id, status:'queued'}`. Poll `GET /imports/:id` until `status:'draft'`. `PATCH /imports/:id` to correct values, set `supplierId`/`customerId` and per-line `productId` (purchase) or `categoryId` (expense), and list `reviewedFields` for anything below the confidence threshold. `POST /imports/:id/commit` → `{status:'committed', orderId|expenseId}`. Office roles only.

## Step 11 — Regional Staging and Pilot Readiness

**Yiwu Warehouse provisioning — Verified (2026-11-28).** Provisioned `Yiwu Warehouse` with code `YIWU` in the international Jahez tenant and assigned its active owner Jahez Admin. Verified warehouse visibility and membership under the restricted runtime role and supplied its UUID to Office Web Step 8.

**Hostinger international deployment — Deployed and infrastructure verified (2026-11-28).** Release `f640b2a` runs the warehouse API, job worker and database under the Jahez rootless Docker account. The existing Jahez and public Nginx services serve Office Web, API and WebSockets. The warehouse has its own Compose project, registered loopback listener, persistent volumes and user service.

1. Inspect the VPS routing, isolation policy, release revision and available build/backup tools. Confirm the private port and baseline the existing Jahez site and Shipping.
2. Add a Hostinger Compose override, company Nginx config, boot unit and runbook. Bound CPU, memory and logs. Build one Server image for API and worker, apply migrations through the database owner, and keep runtime grants and credentials scoped. Use private local storage for this release. Keep external extraction disabled until an authorized provider is configured.
3. Deploy the private stack. Verify backend readiness, migrations, role grants and job consumption. Exercise synthetic operations and a restore away from live data. Keep production identity provisioning and off-server recovery as explicit pilot onboarding checks.
4. Register the warehouse route with the existing ingress, provision TLS for the two international domains and verify Office Web, API/WebSocket routing and existing-site health. Record the deployed revision, recovery steps, verification evidence and open dependencies.

**Container build correction.** The first VPS build resolved the default pnpm release at the repository root because Corepack could not see the Server `package.json` before resolving `pnpm --dir`. Run install, build and pruning from the Server package directory so Corepack honors the existing pin. Build Office Web from its package directory for the same reason. Rebuild and verify from the reviewed revision before cutover.

**Bootstrap follow-up.** Close the migration container's standard input so it cannot consume commands sent to the parent SSH shell. Verify the initialized roles, start the dedicated unit and confirm private readiness before enabling the edge routes.

**Client integration documentation** — Inspect the implemented controllers and services, write one shared guide for Office Web and Worker Mobile, and link it from agent guidance and client roadmaps. Document actual contracts, permissions, retry rules, designs, and known gaps. Verify links and request examples before publishing.

**Production domain update** — Document `api.jahez.online` for the international API and `office.jahez.online` for Office Web. Align the international Nginx example, TLS instructions, health checks, and client connection guidance. Validate rendered hostnames and Compose settings before committing.

**Developer guide update** — Add a server README with development setup, database roles, API and worker commands, a smoke-test checklist, production entry points, and the remaining staging checks. Validate commands against package scripts and links against repository files before committing.

**Review follow-up** — Added Docker secret exclusions and writable storage ownership, API readiness gating, distinct runtime-role templates and required provisioning instructions. Restore failures exit nonzero and roll back the database restore. Cloud object recovery remains a regional staging check.

**Status** — International infrastructure and on-VPS encrypted recovery passed. The first owner and warehouse are configured, and DeepSeek passed a synthetic provider check. Off-server backup and recovery and full live authenticated acceptance are pending. Mainland staging is outside the Hostinger release. See the [Hostinger runbook](../../../deploy/hostinger/RUNBOOK.md) and verification record.

**Goal** — Produce the deployment configuration and operational scripts so the same build and migrations can run in both regions (Hostinger international, Alibaba Cloud ECS mainland), and practice locally the parts that can be rehearsed without staging — above all encrypted, region-local, off-server backup and restore. Regional deployment, TLS issuance, Nginx routing under real domains, Yiwu network access, and mobile-upgrade compatibility cannot be exercised from the development machine, so they are recorded as pending staging checks rather than claimed as verified.

1. **Container build.** Add `apps/server/Dockerfile` (multi-stage: pnpm install + build → slim non-root runtime carrying `dist` and `db/migrations`). One image, two entrypoints: the API runs `migrate` then `main`; the worker runs `worker`, matching the shared modular monolith.
2. **Shared compose.** `deploy/compose.yml` defines `postgres`, `api`, `worker`, and `nginx` with healthchecks, restart policy, a named volume for PostgreSQL data, a volume for private file storage, and an off-server backup target; region-specific values come from a `deploy/env/*.env` file so both regions run the identical compose and code revision.
3. **Regional env templates.** `deploy/env/local.env.example`, `international.env.example`, and `cn-mainland.env.example` cover independent per-region `DATABASE_URL`/`MIGRATION_DATABASE_URL`, least-privilege runtime grants, `JWT_SECRET`, `STORAGE_DRIVER` (international → s3, mainland → oss), `INVOICE_AI_*` (deepseek vs qwen/Model Studio), ports, domain, TLS paths, and `BACKUP_*`. Names only — no secrets committed.
4. **Nginx.** `deploy/nginx/jahez.conf.template` serves the built office-web static assets, proxies `/api/` to the API, and proxies `/socket.io/` with HTTP/1.1 `Upgrade`/`Connection` headers for WebSockets, redirecting HTTP to HTTPS; rendered per region with `envsubst` (domain, upstreams, certificate paths). TLS issuance is an operator step recorded as pending.
5. **Backups.** `deploy/backup/backup.sh` produces a PostgreSQL custom-format dump and a tar of the file-storage directory, encrypts both with OpenSSL AES-256 (PBKDF2, passphrase/keyfile from env), and writes timestamped, region-labeled archives to the off-server target; `restore.sh` decrypts and restores into a target database and storage directory. Neither sends data off the machine.
6. **Runbook and checklist.** `deploy/RUNBOOK.md` records the per-region staging deployment, the network check from Yiwu without a VPN, mobile-upgrade compatibility, and the restore drill, with an explicit open-checks list before pilot release.

**Dependencies** — All prior steps (same build and migrations). Requires staging hosts, domains, TLS certificates, cloud storage credentials (S3/OSS), AI provider keys, and physical Yiwu network access that are not present in the repository; these gate the regional verification and are recorded as open.

**Acceptance checks** — Locally: `backup.sh` produces encrypted archives that contain no plaintext seeded rows; `restore.sh` round-trips a seeded disposable database and storage directory back to matching contents; a wrong passphrase fails safely; compose/nginx/env templates are committed with no secrets; server typecheck/build stay green. **Pending (staging-only):** Docker image build; regional deploy on Hostinger + Alibaba ECS; independent per-region DB/storage/AI; Nginx HTTPS + WebSocket routing under real domains; core API and live-update access from Yiwu without a VPN; mobile-upgrade compatibility; and the restore drill to a region-local off-server target.

**Client contract** — None (operational step). The `/api/v1` REST contract and the Socket.IO path stay compatible with the previous mobile release while workers update.
