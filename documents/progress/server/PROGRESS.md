# Server Progress

Steps 1–7 are verified on the recorded local and disposable PostgreSQL checks. Step 8 is next. Plan scope and acceptance criteria are in the [Server Plan](../../plan/server/PLAN.md).

## Step 1 — Configuration and PostgreSQL Readiness

**Verified** — 2026-11-25. Commits `1c7d552` and `c06ecbc`.

- Shipped shared API and worker configuration, the PostgreSQL pool, independent liveness and database readiness, and migration 0001 with a versioned ledger.
- Verified liveness stayed at 200 when PostgreSQL was unreachable, readiness returned 200/503 as appropriate, invalid configuration failed startup, and the worker started with the restricted runtime role when the database was available.
- Applied and reran the baseline migration using separate migration credentials. A missing or renamed applied file failed the migration check. Runtime CREATE, ALTER, and DROP attempts were denied.
- Typecheck and build passed. The outage check used an unreachable endpoint while the local PostgreSQL instance kept running.

## Step 2 — Identity, Tenancy, and Audit

**Verified** — 2026-11-25 to 2026-11-26. Commits `679bc50`, `f447834`, and `4787ed4`.

- Shipped companies, warehouses, users, memberships, password sign-in by phone, JWT sessions with refresh rotation and revocation, tenant and warehouse row-level security, and append-only audit events in migrations 0002–0004.
- Verified member access returned 200. Cross-tenant and non-member routes returned 403, missing or invalid bearer tokens returned 401, and malformed warehouse IDs returned 400. PostgreSQL denied cross-tenant and same-tenant non-member reads and writes under the runtime role.
- Verified worker reads, worker write denial, and owner/trader warehouse updates. Blank and placeholder JWT secrets failed startup. Expired and revoked tokens failed access. Eight concurrent refresh calls produced one success and seven 401s.
- Confirmed all four privileged function search paths, grants to the effective PostgreSQL user, and denial for an unrelated role. Runtime audit inserts worked and edits/deletes were denied. Migration reruns, typecheck, and build passed.

**Pilot notes** — Set a real JWT secret locally. Sign-in uses a password credential and SMS/OTP is deferred. Account provisioning and shared-tablet idle sign-out still need pilot verification. To rotate runtime roles, explicitly transfer table and function permissions, verify the new role, then revoke the old grants. The migration runner skips an already-applied migration.

## Step 3 — Catalog and Manual Purchase Orders

**Verified** — 2026-11-26. Commit `2d1b07a`.

- Shipped migration 0005, party and product management, order draft/edit/confirm/cancel, warehouse-scoped order reads, and a worker-safe receiving queue.
- Verified the lifecycle, denial of cross-tenant reads and writes, office access loss on an existing token after a role downgrade, and exclusion of prices and costs from worker payloads.
- Verified invalid dates, excess price precision, and inconsistent supplied amounts or totals returned 400. Line amounts and order totals rounded correctly. Referenced party type changes returned 409, and an unreferenced party could still change type.
- Audit checks, migration rerun, typecheck, and build passed on the recorded disposable PostgreSQL verification.

## Step 4 — Receiving, Offline Sync, and First Stock Movement

**Verified** — 2026-11-26. Commit `58e92d0`.

- Shipped migration 0006 and shared receipt confirmation for REST and sync push. Confirmation locks the order and atomically records the receipt, findings, append-only stock movements, order status, and sync change.
- Verified both receipt/cancellation race outcomes. Two partial deliveries completed an order, outstanding cartons remained visible in the worker queue, and the final correct delivery produced no new shortages. Compared measurements using a tenant tolerance override and verified substituted and omitted lines.
- Six concurrent retries returned the same acknowledgment, with one receipt and one posting per received line. Changing the actor, warehouse, or request returned 409. A mixed batch reported each operation, and cursor pull recovered the committed changes.
- Verified warehouse isolation, worker-safe responses, denied runtime stock edits and deletes, scoped database helper grants, and audited finding resolution by a trader. Typecheck, build, and migration rerun passed.

**Deployment notes** — Confirming a receipt requires an existing order. Runtime grants include SELECT/INSERT on audit events and stock movements and USAGE on the sync sequence. When rotating the runtime role, also transfer execution grants for the two privileged receiving helpers.

## Step 5 — Stock Reads and Live Updates

**Verified** — 2026-11-26. Commit `58e92d0`.

- Shipped balances, paginated movement history, receipt-lot age, and guarded Socket.IO updates. Recorded order confirmations, cancellations, receipts, and finding resolutions for reconnect recovery.
- Verified customer mark, supplier, brand, and product filters. Malformed or repeated filters and invalid cursors returned 400. One-row pages covered the full tested movement history without gaps or repeats, including timestamps within the same millisecond. Balance and receipt-lot totals preserved 2.4 billion units.
- Verified canonical room IDs, rejection of cross-tenant and non-member subscriptions, and loss of delivery on existing sockets after membership removal, session revocation, or JWT expiry. Malformed acknowledgments and an authorization lookup failure left the server responsive.
- A temporary stock-insert trigger forced a rollback on disposable PostgreSQL. It persisted no receipt or ledger movement and emitted no event. The retry succeeded once. Replay emitted nothing and reconnect recovered the missed change through sync pull. Typecheck and build passed.

**Step 7 follow-up** — Account for dispatched cartons in receipt-lot age and publish dispatch and adjustment events.

## Step 6 — Files and Evidence

**Verified** — 2026-11-26. S3/OSS round-trip checks remain staging-dependent.

- Shipped validated storage configuration (`STORAGE_DRIVER` local/s3/oss, local directory, upload limit, per-provider credentials), a platform `StorageService` with local-disk, S3-compatible, and Alibaba OSS providers, and migration 0007 for warehouse-scoped append-only `files` storing provider, object key, checksum, and a per-tenant unique client upload id.
- Shipped `POST /api/v1/files` (multipart, idempotent by upload id), warehouse-scoped listing with entity/purpose filters, metadata reads, and private streaming downloads. Known entity links are validated against the matching receipt, receipt line, or order in the same warehouse; downloads re-check membership and never expose storage paths.
- Verified startup rejection of `STORAGE_DRIVER=s3` without credentials. A receipt synced without photos and a photo linked afterwards, keeping confirmation and upload retries independent.
- On disposable PostgreSQL with a temporary storage directory: downloaded bytes matched the upload SHA-256 before and after an API restart; cross-tenant and non-member reads/uploads and an unknown receipt link were denied; identical retries returned the original file with no duplicate row and changed bytes returned 409.
- After switching the write driver to S3 with a dummy unreachable endpoint, the earlier local file stayed readable through its stored provider, the failed S3 write left no metadata, and switching back to local restored uploads. The runtime role could not update or delete file rows; uploads were audited. Typecheck and build passed.

**Staging-dependent checks** — With real credentials: S3-compatible and OSS put/get round-trips, reading earlier cloud objects after a provider switch, and endpoint/TLS behavior from Yiwu. The disposable run used a dummy endpoint only to prove the stored-provider read path and clean failure handling.

**Review fixes** — Re-audited against the Step 6 roadmap: the local provider now creates and write-checks its directory at startup (an unwritable path fails startup), and missing S3/OSS objects map to 404 like local reads. Added the upload/retry client contract to the plan. Re-verified on a fresh disposable database: unwritable dir fails startup, fresh dir is created at startup, upload/download round-trip, and a deleted stored object returns 404. Typecheck and build passed.

**Security hardening** — Uploads now accept only evidence content types (JPEG, PNG, WebP, HEIC/HEIF, PDF, XLSX, XLS, CSV); HTML/SVG and other types return 400 and store nothing, closing a stored-XSS path where an inline HTML upload would execute on the API origin. Downloads send `X-Content-Type-Options: nosniff`; images serve inline and all other types as attachments. Verified on a disposable database: HTML/SVG rejected, JPEG inline with nosniff, PDF as attachment, rejected uploads persisted no rows. Typecheck and build passed.

**Design notes** — Downloads stream through the authorized API instead of the requirements' "private expiring links"; no public or presigned URLs exist, which keeps access tenant- and warehouse-scoped. File uploads are not yet published in `sync_changes` or live events; clients fetch evidence on demand through `GET /files?entityType=...`. Add file events when the mobile photo queue needs cross-device notification.

**Deployment notes** — Expense and import links are accepted but validated by those modules in later steps; adjustment links are validated from Step 7. Grant the runtime role SELECT/INSERT on `files` and keep the local storage directory outside the web root. `.env.example` lists the storage variables.

## Step 7 — Dispatch and Stock Adjustments

**Verified** — 2026-11-26. 54 checks on disposable PostgreSQL.

- Shipped migration 0008: append-only warehouse-scoped `dispatches`, `dispatch_lines`, `dispatch_allocations`, and `stock_adjustments`; the `stock_movements` insert policy now also accepts negative lot-linked dispatch rows and reference-linked adjust rows; adjustment inserts are office-only under RLS.
- Shipped `POST /dispatches` (confirmed in one transaction, idempotent by client operation id), `GET /dispatches` with a customer filter, and `GET /dispatches/:id` as the packing list with per-lot allocations. Dispatch allocates FIFO by receipt date under a per-warehouse advisory lock shared with adjustments, posts one negative movement per lot through the inventory service, and reports per-line shortages with 409.
- Shipped `POST /stock/adjustments` (owner/trader only): required reason and an `adjustment_photo` file in the same warehouse, signed cartons, optional lot link that derives the stock dimensions, and overdraw protection for negative adjustments. `GET /stock/age` now counts lot remainders (receipt +, dispatch −, lot-linked adjust ±) and hides consumed lots; movement history shows dispatch/adjustment numbers and the adjustment reason; `customerId` stock filter added. Adjustment file entity links are validated. Dispatch and adjustment changes are recorded in `sync_changes` and published live only after commit (Step 5 follow-up closed).
- Verified on a fresh disposable database: a 12-carton dispatch allocated 10 + 2 across two receipt lots with correct qty/CBM/weight packing totals and no price fields; two concurrent dispatches exceeding combined stock produced one success and one 409 with the ledger never negative; over-stock dispatch reported the shortage; replays returned the original response with no new movements and changed requests returned 409.
- Verified adjustment role denial for workers, missing/unknown photo and blank reason rejection, negative overdraw 409, lot-linked dimension derivation, replay idempotency, cross-tenant and non-member denial for reads and writes, live `dispatch.confirmed`/`adjustment.recorded` events plus sync pull recovery, runtime UPDATE/DELETE denial and movement insert-policy denial, audit counts, and a clean migration rerun. Typecheck and build passed. Migration 0008 also applied to the local development database.

**Design notes** — Dispatch is online-only per roadmap; the worker draft stays on the device and there is no server draft state. An adjustment without a lot link corrects the group balance only; lot age cannot attribute it, so a fully adjusted group can still show physical lot remainders. Use `receiptLineId` when the affected lot is known.

**Deployment notes** — Grant the runtime role SELECT/INSERT on `dispatches`, `dispatch_lines`, `dispatch_allocations`, and `stock_adjustments` (`.env.example` updated). No new privileged functions; the advisory stock lock needs no grants.
