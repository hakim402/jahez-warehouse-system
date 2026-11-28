# Server Progress

Steps 1–10 are verified on the recorded local and disposable PostgreSQL checks. Step 11 deployment deliverables are shipped with backup/restore verified locally; its regional staging checks are pending real infrastructure. Plan scope and acceptance criteria are in the [Server Plan](../../plan/server/PLAN.md).

## Step 1 — Configuration and PostgreSQL Readiness

**macOS connection recovery — 2026-11-27** — Diagnosed Homebrew PostgreSQL 14 occupying port 5432 while the configured `postgres` role belonged to the intended PostgreSQL 17 setup. After switching services and restarting the API, the user confirmed readiness returned `status=ok`, `database=up`, and `latencyMs=1`. Added service inspection, recovery commands, and runtime-credential checks to the server README.

**Verified** — 2026-11-25. Commits `1c7d552` and `c06ecbc`.

- Shipped shared API and worker configuration, the PostgreSQL pool, independent liveness and database readiness, and migration 0001 with a versioned ledger.
- Verified liveness stayed at 200 when PostgreSQL was unreachable, readiness returned 200/503 as appropriate, invalid configuration failed startup, and the worker started with the restricted runtime role when the database was available.
- Applied and reran the baseline migration using separate migration credentials. A missing or renamed applied file failed the migration check. Runtime CREATE, ALTER, and DROP attempts were denied.
- Typecheck and build passed. The outage check used an unreachable endpoint while the local PostgreSQL instance kept running.

**Completion-review fixes** — Queue startup no longer gates API liveness. Queue sends and worker consumption wait for initialization and retry a failed start.


**Follow-up verification** — Cold API startup returned liveness 200 and readiness 503 with PostgreSQL unavailable. Typecheck and build passed.

## Step 2 — Identity, Tenancy, and Audit

### 2026-11-28 — Core Office Web settings implemented and synthetically verified

- After user mockup approval, updated the Step 2/Office Web Step 5 plans before implementation. Added SettingsModule with owner-only `/users`, `/users/:id`, password-reset and warehouse/tolerance settings routes. AuthGuard and OwnerGuard run before HTTP body validation; the service rechecks the acting active owner in the tenant transaction. User detail supports explicit conflict reload without scanning the directory.
- Added forward migration **0012_user_access_settings**: active flag defaults existing users to active, directory/active-owner indexes, owner warehouse-option SELECT policy, and active-user-aware auth/warehouse helper functions. Function signatures and earlier migrations remain unchanged; discovering warehouse options does not grant business access.
- User creation/identity/role/status/membership changes are atomic and versioned, with company-scoped warehouse validation, safe response fields, duplicate-phone conflicts, self-disable denial and concurrent last-active-owner protection. Company **NO KEY UPDATE** locking serializes administrative changes while allowing session/audit foreign-key checks; login/refresh use user-before-session locking. Added concurrent sign-in/edit checks.
- Password hashing reuses scrypt and enforces 12–128 characters. Password/role/access/status changes revoke all affected sessions in the same transaction. Disabled users are rejected by login, refresh, REST authentication and the shared realtime revalidation service. Reactivation requires fresh sign-in. Audit events contain no passwords/hashes; historical records remain intact.
- Added versioned tolerance reads/atomic updates, strict 0–100/two-decimal validation, original 3%/5% defaults, safe audit before/after, and no historical recalculation. The existing receiving service reads saved settings for subsequent processing. Updated the Backend Integration Guide with full bodies/responses/errors, access and migration/test instructions.
- Passed `pnpm --dir apps/server typecheck`, `pnpm --dir apps/server build`, `pnpm --dir apps/office-web build`, and `apps/server/test/settings-regression.cjs` against unique disposable local databases and non-superuser/NOBYPASSRLS roles, removed after each run. Covered migration/rerun, actual Nest HTTP/auth/owner guards and wire responses, all service trader/worker denials, two-company isolation, invalid warehouses, duplicate phones, stale versions, 50-user cursor/search/role/status filtering, password bounds/reset, disable/reactivate, old access/refresh/realtime revalidation rejection, concurrent owner self-demotions (one succeeds, one LAST_OWNER), concurrent sign-in/edits, audit redaction/append-only restrictions and no-context RLS. Real receipt processing produced two findings at 3%/5%, produced no extra findings after saving 20%/20%, and preserved the historical finding IDs/values.
- **Status: implemented and synthetically verified; live integration pending.** No application database migration, live account mutation, deployment or Worker Mobile code change occurred. The previous identity baseline remains verified. Apply migration 0012 before using this server build with an existing database; real owner/trader permission changes, actual Socket.IO delivery and previous-mobile compatibility workflows remain pending. Office Web synthetic browser checks are recorded under Step 5.


### 2026-11-28 — Office Web core-settings follow-up planned

- Saved the authorized owner user/access/password/status and receiving-tolerance API/migration/testing plan under Server Step 2, linked to Office Web Step 5. Preserve the existing verified identity/tenancy baseline and mobile contracts.
- Prepared and rendered the Office Web design drafts first, as explicitly requested by the user. Owner controls, transactional membership edits, session revocation/disabled-user checks, concurrency protection for the last active owner, tolerance validation/history behavior, audit redaction, and disposable-database checks are planned; none are implemented in this follow-up yet.
- This update changes plans, design references, and progress records only. No server code, migrations, live accounts, databases, or deployment changed. Server typecheck/build were not required for these documentation changes. Next: obtain user design approval, then implement and verify the saved follow-up plan.


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

**Deployment notes** — Import links are accepted but validated by that module in a later step; adjustment links are validated from Step 7 and expense links from Step 8. Grant the runtime role SELECT/INSERT on `files` and keep the local storage directory outside the web root. `.env.example` lists the storage variables.

**Completion-review fixes** — Nested tenant service calls reuse the same PostgreSQL client, so authorized file reads work with a pool size of one.


**Follow-up verification** — Authorized file metadata succeeded with a pool size of one; local downloads and worker invoice denial passed. Typecheck and build passed.

## Step 7 — Dispatch and Stock Adjustments

**Verified** — 2026-11-26. 54 checks on disposable PostgreSQL.

- Shipped migration 0008: append-only warehouse-scoped `dispatches`, `dispatch_lines`, `dispatch_allocations`, and `stock_adjustments`; the `stock_movements` insert policy now also accepts negative lot-linked dispatch rows and reference-linked adjust rows; adjustment inserts are office-only under RLS.
- Shipped `POST /dispatches` (confirmed in one transaction, idempotent by client operation id), `GET /dispatches` with a customer filter, and `GET /dispatches/:id` as the packing list with per-lot allocations. Dispatch allocates FIFO by receipt date under a per-warehouse advisory lock shared with adjustments, posts one negative movement per lot through the inventory service, and reports per-line shortages with 409.
- Shipped `POST /stock/adjustments` (owner/trader only): required reason and an `adjustment_photo` file in the same warehouse, signed cartons, optional lot link that derives the stock dimensions, and overdraw protection for negative adjustments. `GET /stock/age` now counts lot remainders (receipt +, dispatch −, lot-linked adjust ±) and hides consumed lots; movement history shows dispatch/adjustment numbers and the adjustment reason; `customerId` stock filter added. Adjustment file entity links are validated. Dispatch and adjustment changes are recorded in `sync_changes` and published live only after commit (Step 5 follow-up closed).
- Verified on a fresh disposable database: a 12-carton dispatch allocated 10 + 2 across two receipt lots with correct qty/CBM/weight packing totals and no price fields; two concurrent dispatches exceeding combined stock produced one success and one 409 with the ledger never negative; over-stock dispatch reported the shortage; replays returned the original response with no new movements and changed requests returned 409.
- Verified adjustment role denial for workers, missing/unknown photo and blank reason rejection, negative overdraw 409, lot-linked dimension derivation, replay idempotency, cross-tenant and non-member denial for reads and writes, live `dispatch.confirmed`/`adjustment.recorded` events plus sync pull recovery, runtime UPDATE/DELETE denial and movement insert-policy denial, audit counts, and a clean migration rerun. Typecheck and build passed. Migration 0008 also applied to the local development database.

**Design notes** — Dispatch is online-only per roadmap; the worker draft stays on the device and there is no server draft state. An adjustment without a lot link corrects the group balance only; lot age cannot attribute it, so a fully adjusted group can still show physical lot remainders. Use `receiptLineId` when the affected lot is known.

**Deployment notes** — Grant the runtime role SELECT/INSERT on `dispatches`, `dispatch_lines`, `dispatch_allocations`, and `stock_adjustments` (`.env.example` updated). No new privileged functions; the advisory stock lock needs no grants.

**Completion-review fixes** — Dispatch now checks both the group ledger balance and available FIFO lots, preventing unlinked negative adjustments from being ignored.


**Follow-up verification** — Receipt 10, adjustment −8, dispatch 5 now returned 409 and left balance 2. Typecheck and build passed.

## Step 8 — Expenses

**Verified** — 2026-11-26. 59 checks on disposable PostgreSQL.

- Shipped migration 0009: tenant-scoped `expense_categories` (defaults transport/labor/handling/rent backfilled for existing companies and seeded by trigger for new tenants) and warehouse-scoped append-only `expenses` with a CHECK requiring exactly one evidence path (invoice file or documented no-invoice note). Office-only RLS reads on both tables; owner-only category writes; office expense inserts.
- Shipped `GET/POST /expense-categories` and `PATCH /expense-categories/:id` (owner-managed rename/activate/deactivate, no delete), `POST /expenses` (idempotent by client operation id, amount/currency/date validation, active-category requirement, customer and same-warehouse order links, `EXP-...` numbering), `GET /expenses` with category/customer/order filters, and `GET /expenses/:id`. Expense file entity links are validated.
- Closed the worker cost-leak surface: `expense_invoice` and `invoice_source` files are office-only on upload, list, metadata, and download; `expense.recorded` live events skip worker sockets in the same warehouse room; expenses are deliberately absent from `sync_changes`, which workers pull.
- Verified on a fresh disposable database: both evidence paths succeed; missing, blank, or double evidence returns 400; excess precision, negative amount, lowercase currency, and invalid calendar dates return 400; unknown category 404, inactive category 409, unknown order link and supplier-as-customer 404; attachments from another warehouse or another tenant are denied; replays return the original record and changed requests 409.
- Verified workers get 403 on every expense/category read and write, cannot upload, list, filter, read, or download invoice evidence while receipt photos still work, receive no expense live event while the office socket does, and see no expense entries in sync pull. Owner-only category management, cross-tenant and non-member denial, runtime UPDATE/DELETE denial, worker RLS insert/select denial, audit counts, and a clean migration rerun all passed. Typecheck and build passed. Migration 0009 also applied to the local development database.

**Design notes** — Expenses are online-only for the pilot; offline capture can reuse the same service through sync push later. `POST /expenses/extract` (invoice reading) belongs to Step 10. Office reconnect recovery re-fetches expenses over REST because the worker-safe sync feed intentionally excludes them.

**Deployment notes** — Grant the runtime role SELECT/INSERT on `expenses` and SELECT/INSERT/UPDATE on `expense_categories` (`.env.example` updated). The category seed trigger runs as the provisioning role that inserts companies.

## Step 9 — Background Jobs and Excel Exports

**Verified** — 2026-11-26. 78 checks on disposable PostgreSQL.

- Shipped migration 0010: warehouse-scoped `export_jobs` (kind over the seven report types, filters jsonb, status `queued|processing|completed|failed`, requested_by, storage provider/object key/file name/size/error) with office-only RLS select/insert/update, DELETE/TRUNCATE and full-row UPDATE revoked, and column-level UPDATE granted only on the job-progress columns. Created the `pgboss` schema and granted the runtime role USAGE/CREATE so pg-boss owns its internal tables without database-level CREATE.
- Added the shared `JobsModule` (`JobsService`): pg-boss against the existing `DATABASE_URL`, `createSchema:false`, per-queue creation with a shared retry policy (`retryLimit` 3, exponential backoff) before the first send/work, and an instance error listener so a queue fault never crashes the process. Both API and worker start the connection; only `worker.ts` calls `startConsuming()`. Step 10's invoice extraction reuses this service.
- Added the office-only Exports API: `POST /exports` validates kind + applicable filters (`from`/`to`/`customerId`/`supplierId`/`orderId`), inserts the job row, audits `export.created`, then enqueues after commit keyed by the export id; `GET /exports?warehouseId=`, `GET /exports/:id`, and `GET /exports/:id/file` (attachment stream, 409 until completed). Workers are denied on every route.
- Built the seven reports DRY on one shared filter→SQL builder (`FilterQuery`), one workbook writer (`buildWorkbook`: frozen styled header, per-column number formats, bold totals row), and one registry: goods_received (photo links), goods_dispatched (packing list), inventory (movement balance + days in storage), stock_movements (receipt/dispatch/adjust references), order_vs_received (ordered vs received, difference, line status), expenses (invoice link or no-invoice note), and the trilingual EN/AR/CN purchase_order. The runner builds inside `withTenant(job.tenant, job.requestedBy)` so RLS scopes every query, writes to a stable object key `exports/{tenant}/{warehouse}/{job}.xlsx`, and records completion or a sanitized failure in a separate transaction so it survives the rollback; a completed job is never reprocessed.
- Verified on a fresh disposable database: all seven kinds ran enqueue → processing → completed → download, producing valid xlsx with the expected column counts, first headers, data-row counts, and totals (goods_received total cartons 8; inventory net 6 across receipt/dispatch/adjust; order_vs_received difference −2). Filters narrow rows (customerId with no matches → 0 rows; supplierId → 1). Two exports of the same kind+filters both completed with identical row counts and distinct job ids/files, confirming deterministic generation and safe repetition. purchase_order without orderId → 400; unknown kind → 400. Purchase order carries EN/AR/CN headers and product names.
- Verified authorization: workers get 403 on create/list/status/download; a cross-tenant owner gets 404 on status and download (RLS hides the row) and 403 on create against another tenant's warehouse; the runtime role cannot DELETE `export_jobs` or UPDATE its `kind`; the completed job exposes the local provider + object key and the file exists on disk. Typecheck and build passed; migration rerun is clean.

**Design notes** — Reports are office-only, so worker cost isolation is preserved by construction (workers never reach the exports API). Photo and invoice references are relative `/api/v1/files/{id}/content` links that require the caller's own authorization — no embedded credentials or inline images. Inventory has no location column because the data model tracks no shelf/area locations, and weight is derived per lot from the receipt line where applicable. Expenses totals sum amounts as recorded; mixed-currency consolidation is out of scope for the pilot. The runner holds the DB transaction open across generation and upload, which is acceptable at pilot scale.

**Deployment notes** — Run the worker entry point (`start:worker`) alongside the API so queued exports are consumed; the API only enqueues. Grant the runtime role SELECT/INSERT on `export_jobs` plus the column-level UPDATE listed in `.env.example`, and USAGE/CREATE on the `pgboss` schema (migration 0010 grants the latter when `app.runtime_role` is set). The migration role must own the `public` schema so reruns can re-verify DDL. Generated workbooks land under the configured storage provider at `exports/{tenant}/{warehouse}/{job}.xlsx`.

**Completion-review fixes** — Order comparison excludes substituted products and includes CBM and open findings. Inventory age uses the oldest remaining receipt lot.


**Follow-up verification** — Substitution report remained pending with zero correct cartons. All seven workbooks generated and downloaded. Typecheck and build passed.

## Step 10 — Invoice Ingestion and Trader Review

**Verified** — 2026-11-26. 37 checks on disposable PostgreSQL.

- Shipped migration 0011: office-only, warehouse-scoped `invoice_imports` (kind purchase|expense, source_file_id FK files, status queued|processing|draft|committed|failed, provider, draft jsonb of header+lines each carrying value/confidence/source plus a review object, committed_entity_id, error). Office-only RLS select/insert/update; DELETE/TRUNCATE and full-row UPDATE revoked; column-level UPDATE (status, provider, draft, committed_entity_id, error, updated_at) granted to the runtime role. Added the `import` entity-link branch to FilesService validating against `invoice_imports`.
- Added typed invoice-AI config: provider `deepseek|qwen|sample|none` with a regional default (cn-mainland → qwen, else deepseek); keys are enforced at extraction time, not startup, so a missing key never blocks boot. Shared jobs queue `invoice.extract` is consumed by the worker.
- Built the extraction pipeline DRY: spreadsheets parse directly (ExcelJS, matching column headers and label:value pairs across Chinese/English/Arabic keywords, scanning header labels only above the detected table so column names are never misread); photos/scans/PDFs route to a pluggable regional vision provider behind one interface — a deterministic `sample` extractor (no network, no real invoice bytes) for dev/CI/verification, plus OpenAI-compatible `deepseek` (international) and `qwen` (mainland) calls. Every field is emitted as {value, confidence, source}. The runner builds under the requesting user's tenant context and is retry-safe (a drafted/committed import is never reprocessed; failures are recorded in a separate transaction).
- Added the office-only ingestion API: POST /orders/extract and /expenses/extract (purchase requires an invoice_source file, expense an expense_invoice file), GET /imports + /imports/:id (draft + confidence + unreviewed fields), PATCH /imports/:id (trader edits set confidence to 1, resolve supplier/customer/category/product ids, and record reviewed fields), and POST /imports/:id/commit which enforces the review gate then delegates to OrdersService.createDraft (purchase, source excel|photo + source-file reference) or ExpensesService.recordExpense (expense, idempotent by import id), keeping existing validation authoritative. Manual order/expense entry is unchanged.
- Verified on a fresh disposable database: a purchase XLSX ingest parsed 2 lines and header (supplier, total 2880) with provider `xlsx`; commit before id resolution returned 400; after review it created a draft order with total 2880, source `excel`, and 2 lines, and a re-commit returned the same order. An expense image ingest via the `sample` provider returned amount 100.5 with expenseDate/categoryName flagged low-confidence; commit before review returned 409; after review it created an expense with the amount and invoice-file link. Config routing resolved international→deepseek, cn-mainland→qwen, and an explicit sample override. Workers got 403 on extract/list/status/commit; cross-tenant read 404 and write 403; a purchase with an expense_invoice file returned 400. Runtime DELETE and kind UPDATE were denied; migration rerun was clean; typecheck and build passed.

**Design notes** — The review gate blocks only fields that were extracted with a value but below the 0.75 confidence threshold; required fields (product/supplier/customer/category ids, expense amount+date) are enforced at commit, so absent optional data never blocks review. Purchase commit delegates to createDraft (atomic and serialized with the import commit); expense commit is idempotent via clientOperationId = import id. **Recorded pending:** direct searchable-PDF text parsing and live DeepSeek/Qwen accuracy need real API keys and user-authorized synthetic samples — no real supplier invoice is sent externally — so PDFs currently route to the vision provider and the pipeline is verified with the deterministic `sample` extractor. Handwritten invoices stay out of automatic scope (manual fallback preserved).

**Deployment notes** — Grant the runtime role SELECT/INSERT on `invoice_imports` plus the column-level UPDATE listed in `.env.example`. Set INVOICE_AI_PROVIDER (or rely on the regional default) and provide INVOICE_AI_API_KEY/DEEPSEEK_API_KEY plus base URL and model for deepseek/qwen; the `sample` provider needs no key and never calls the network. The worker entry point must run to consume `invoice.extract`.

**Completion-review fixes** — Review and commit lock the import row and share one tenant transaction with order or expense creation, preventing duplicate orders and partial commits.


**Follow-up verification** — Two simultaneous purchase commits returned the same order ID. Typecheck and build passed.

## Step 11 — Regional Staging and Pilot Readiness

**Shared client integration guide — 2026-11-27** — Added a guide derived from the implemented server controllers and services with endpoint workflows, role restrictions, session rotation, receipt and upload retry behavior, sync cursors, and Socket.IO reconnect rules. Linked it from the server README, agent guides, and both client roadmaps. Added the design index pointing to the supplied mobile references and recording the empty Office Web design folder. Client dependencies include warehouse discovery, local browser proxy configuration, and the planned OpenAPI generation.

**Production domains recorded — 2026-11-27** — Updated international production examples and developer guidance for `api.jahez.online` and `office.jahez.online`. The shared Nginx host list includes both names. Office requests retain same-origin API proxying, and mobile/external clients use the API subdomain. DNS reachability and TLS issuance remain deployment checks.

**Client integration follow-ups** — Added a deferred checklist at the top of Server Plan covering provisioning, shared-device sessions, invoice parsing and accuracy, storage-provider verification, regional staging, recovery, Yiwu access, and mobile-version compatibility. Each item names its owning server step and when client development should revisit it. Implementation remains pending.

**Developer guide** — Added `apps/server/README.md` covering prerequisites, environment setup, database role provisioning, API and worker commands, synthetic accounts, smoke tests, production operations, and remaining release checks. Checked the documented scripts and routes against source and validated local document links. This documentation update changes no application behavior.

**Deliverables shipped** — 2026-11-26. Backup/restore verified locally (17 checks). Regional staging checks pending real infrastructure.

- Added `apps/server/Dockerfile` (multi-stage pnpm build → slim non-root runtime carrying `dist` + `db/migrations`; one image, two entrypoints — the API runs `migrate` then `main`, the worker runs `worker`).
- Added `deploy/compose.yml`: a single shared definition (postgres, api, worker, nginx) with healthchecks, restart policy, a named volume for PostgreSQL data, a private file-storage volume, and a shared `x-app-env` anchor so both regions run the identical file from the same code revision with only `--env-file` differing.
- Added `deploy/nginx/jahez.conf.template`: HTTPS server, HTTP→HTTPS redirect, ACME challenge path, office-web static assets, `/api/` proxy, and `/socket.io/` proxy with HTTP/1.1 `Upgrade`/`Connection` headers for WebSockets; rendered per region with `envsubst` limited to `${DOMAIN} ${TLS_CERT} ${TLS_KEY} ${MAX_UPLOAD_MB}` so nginx's own `$variables` survive.
- Added regional env templates `deploy/env/{local,international,cn-mainland}.env.example` (names only, no secrets): independent per-region database, storage driver (local/s3/oss), invoice-AI provider (sample/deepseek/qwen), Nginx/TLS, and off-server backup target.
- Added `deploy/backup/backup.sh` and `restore.sh`: OpenSSL AES-256-CBC + PBKDF2 encryption of a PostgreSQL custom-format dump and a file-storage tar, written timestamped and region-labeled to an off-server `BACKUP_DIR` with a sha256 manifest; restore decrypts and rebuilds into an existing target database and storage dir, and a wrong passphrase fails rather than restoring garbage.
- Added `deploy/RUNBOOK.md`: per-region deploy steps, least-privilege database hardening, backup scheduling and restore drill, a per-region verification checklist, and an explicit open-checks list.
- Verified locally (17 checks) against a real migrated schema: migrations applied to a source database, seeded a marker company and a storage file, ran `backup.sh` (db + files archives + manifest produced), confirmed the encrypted dump contains no plaintext marker and is not a readable pg_restore archive, restored into a fresh database (`restore.sh`) reproducing the marker row and the real schema tables (orders, expenses, invoice_imports, export_jobs) and the file contents, confirmed a wrong passphrase fails the restore, and confirmed no real secret is committed under `deploy/`.

**Design notes** — Both regions deploy the same revision through the same compose file; only the env file differs, satisfying "release both regions from the same code revision." The container is the only build artifact; Nginx serves the office-web static build and proxies API + Socket.IO. Backups never leave the machine — `BACKUP_DIR` is an operator-mounted off-server target, and encryption is OpenSSL-based because `age`/`gpg` are not assumed present.

**Pending (staging-only, recorded as open checks)** — Docker image build and Compose startup (Docker unavailable in the dev environment); Nginx config load and HTTPS/WebSocket routing under a real domain (nginx not installed locally); live S3/OSS reads/writes with real bucket credentials; live DeepSeek/Qwen extraction accuracy with authorized synthetic samples (carried from Step 10); regional reachability from Yiwu without a VPN; mobile-upgrade compatibility against the deployed `/api/v1`; and a full-schema regional restore drill to the off-server target. These require staging hosts, domains, TLS certificates, cloud credentials, AI keys, and physical Yiwu access. Server typecheck/build remain green.

**Deployment notes** — Follow `deploy/RUNBOOK.md`. Harden the database with separate least-privilege runtime and migration roles (grants in `apps/server/.env.example`) before pilot. Point `BACKUP_DIR` at a region-local off-server mount and schedule `backup.sh`; rehearse `restore.sh` per region before onboarding other companies.

**Completion-review fixes** — Added Docker secret exclusions and writable storage ownership, API readiness gating, distinct runtime-role templates and required provisioning instructions. Restore failures exit nonzero and roll back the database restore. Cloud object recovery remains a regional staging check.

**Follow-up verification** — All three Compose templates and shell syntax passed. A failing pg_restore fixture returned nonzero with no success message. Real Docker startup, TLS, S3/OSS recovery, Yiwu access, and regional restore remain open. Typecheck and build passed.
