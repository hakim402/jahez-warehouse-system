# Server Plan

Steps 1–7 are verified. Step 8 is next. Use the [Server Roadmap](ROADMAP.md) for scope, the [agent workflow](../../../AGENTS.md#workflow-for-every-step) for the order of work, and [Server Progress](../../progress/server/PROGRESS.md) for results. Update the matching step here before editing server code.

## Step 1 — Configuration and PostgreSQL Readiness

**Status** — Verified.

1. Share typed configuration between the NestJS API and worker. Validate the deployment profile, connection settings, port, pool size, and timeouts.
2. Connect the API and worker with the restricted `DATABASE_URL` role. Use `MIGRATION_DATABASE_URL` for versioned SQL. Keep the migration ledger, advisory lock, transactions, checksum checks, and detection of deleted or renamed applied migrations.
3. Keep liveness at `GET /api/v1/health` and use `GET /api/v1/health/ready` for a bounded PostgreSQL check. Make the worker fail fast if the database is unreachable.

**Acceptance checks** — Typecheck and build. Verify healthy and unavailable database behavior, valid and invalid configuration, successful worker startup, migration rerun, missing migration detection, and runtime DDL denial.

## Step 2 — Identity, Tenancy, and Audit

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

**Status** — Verified on disposable PostgreSQL. S3/OSS round-trip checks remain staging-dependent.

1. Extend `server-config.ts` and `.env.example` with validated storage settings: `STORAGE_DRIVER` (`local` default, `s3`, `oss`), `STORAGE_LOCAL_DIR` (relative to `apps/server`, outside the web root), `STORAGE_MAX_UPLOAD_MB`, and per-provider credentials (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE`; `OSS_BUCKET`, `OSS_REGION`, `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, optional `OSS_ENDPOINT`). Reject an unknown driver or missing credentials for the selected driver at startup.
2. Add a platform `StorageService` with one interface and three providers: private local disk (default), S3-compatible (`@aws-sdk/client-s3`), and Alibaba OSS (`ali-oss`). Providers are constructed from configuration per driver, so a file is always read through the provider stored on its row, not the current write default.
3. Add migration `0007_files_evidence`: `files` with tenant and warehouse scope, a client `upload_id` unique per tenant for independent retries, purpose, optional entity link (`receipt`, `receipt_line`, `order`, `expense`, `adjustment`, `import`), stored `provider` and `object_key`, original name, content type, size, SHA-256, uploader, and audit columns. RLS: warehouse members may select and insert; evidence metadata is append-only (no update/delete policies). Object keys are tenant-prefixed (`tenant/year/month/fileId`).
4. Add `FilesModule`: `POST /api/v1/files` (multipart, warehouse membership required, idempotent by `upload_id`, bytes written through the selected provider inside the same transaction that records metadata and audit), `GET /api/v1/files` (warehouse-scoped list with entity/purpose filters), `GET /api/v1/files/:id` and `GET /api/v1/files/:id/content` (membership re-checked against the file's warehouse; content streamed privately, never a public path). Validate known entity links against the matching receipt/line/order in the same warehouse.
5. Keep receipt confirmation and photo uploads independent: no photo is required to confirm or sync a receipt, and a photo may be uploaded or retried after the receipt commits. A retry with the same `upload_id` and bytes returns the original record; changed bytes return `409`. A failed storage write rolls back the metadata claim so the retry can proceed.

**Acceptance checks** — Typecheck and build. On disposable PostgreSQL: local upload persists across an API restart; cross-tenant and non-member reads/uploads are denied; identical upload retries create exactly one file and changed bytes conflict; a receipt syncs without photos and a photo links afterwards; after switching `STORAGE_DRIVER` to S3, earlier local files remain readable through their stored provider. Record S3/OSS round-trip checks as staging-dependent until credentials are available. Follow the [Step 6 roadmap](ROADMAP.md#6-files-and-evidence).

**Client contract** — Upload is `POST /api/v1/files?warehouseId=...` as multipart: file part `file`, fields `uploadId` (client UUID, the retry key), `purpose`, optional `entityType`/`entityId` pair, optional `takenAt`. Accepted content types: JPEG, PNG, WebP, HEIC/HEIF, PDF, XLSX, XLS, CSV; anything else returns `400`. Identical retries return the original record; changed bytes return `409`; a failed storage write leaves no record so the same `uploadId` can retry. Downloads are `GET /api/v1/files/:id/content` with the bearer token — there are no public or presigned URLs. Images serve inline; other types serve as attachments, always with `X-Content-Type-Options: nosniff`. The local storage directory is created and write-checked at startup.

## Step 7 — Dispatch and Stock Adjustments

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

**Status** — Pending. Plan expense records, invoice evidence, and documented exceptions using the [Step 8 roadmap](ROADMAP.md#8-expenses).

## Step 9 — Background Jobs and Excel Exports

**Status** — Pending. Plan background processing and server-generated Excel exports using the [Step 9 roadmap](ROADMAP.md#9-background-jobs-and-excel-exports).

## Step 10 — Invoice Ingestion and Trader Review

**Status** — Pending. Plan import, regional extraction, and review using the [Step 10 roadmap](ROADMAP.md#10-invoice-ingestion-and-trader-review).

## Step 11 — Regional Staging and Pilot Readiness

**Status** — Pending. Plan regional verification, mobile compatibility, and backup restoration using the [Step 11 roadmap](ROADMAP.md#11-regional-staging-and-pilot-readiness).
