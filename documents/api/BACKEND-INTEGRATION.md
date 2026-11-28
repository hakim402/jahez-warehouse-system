# Backend Integration Guide

Use this guide for Office Web and Worker Mobile. It describes the implemented NestJS API. Confirm changes against the linked [server modules](../../apps/server/src/modules/) and update this guide when a contract changes. The planned generated OpenAPI specification and TypeScript/Dart clients still need implementation.

## 1. Connect to the server

| Client | REST base URL |
| --- | --- |
| Production mobile and external clients | `https://api.jahez.online/api/v1` |
| Production Office Web | `/api/v1` on `https://office.jahez.online`, proxied by Nginx |
| Local tools and iOS Simulator | `http://localhost:3000/api/v1` |
| Android emulator | `http://10.0.2.2:3000/api/v1` |
| Physical test device | Your development machine's reachable LAN address plus `/api/v1` |

Set `VITE_API_BASE_URL` for Office Web and `API_BASE_URL` for Flutter. Flutter's example uses `--dart-define-from-file=.env`. These are public settings. Database, storage, and AI credentials stay on the server.

The Vite starter currently has no API or Socket.IO proxy. Add both to the client integration plan before browser testing locally. The API currently has no explicit browser CORS configuration. Production uses the office origin's Nginx proxy; using the absolute API domain from the browser requires server CORS work first.

Start the API and worker following the [server README](../../apps/server/README.md). Check `GET /health` for liveness and `GET /health/ready` for database readiness. Both health routes are public. All routes below are relative to the REST base URL.

## 2. Sign in and choose warehouse context

Send `POST /auth/login` with this shape, replacing the example account fields with provisioned synthetic data.

```json
{
  "phone": "TEST_PHONE",
  "password": "TEST_PASSWORD",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "deviceId": "warehouse-tablet-01"
}
```

The response contains `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, `sessionId`, and `user` with `id`, `tenantId`, `role`, and `name`. Access tokens currently last 15 minutes. Tenant selection is required if a phone belongs to multiple companies. Account creation is currently administrator-managed.

Send `Authorization: Bearer <accessToken>` on protected requests. Refresh with `POST /auth/refresh` and `{ "refreshToken": "..." }`. Atomically replace both stored tokens with the response. Serialize refresh in the client because each refresh token can succeed once. A lost refresh response can require sign-in again.

| Action | Route |
| --- | --- |
| Sign out current session | `POST /auth/logout` |
| List your sessions | `GET /auth/sessions` |
| Revoke your session, or another user's session as owner | `DELETE /auth/sessions/:id` |
| Read a known assigned warehouse | `GET /warehouses/:id` |
| Rename a warehouse as an assigned owner/trader | `PATCH /warehouses/:id` with `name` |

The API resolves current roles and warehouse membership and applies PostgreSQL RLS. Client-supplied tenant or warehouse identifiers never grant access. There is currently no endpoint that lists all assigned warehouses or creates accounts; plan that server dependency before implementing a warehouse picker.

Mobile should store tokens in platform secure storage. Office Web needs one shared session manager. Clear account-specific caches on account changes and implement the planned shared-device idle sign-out. SMS/OTP is still pending.

## 3. Permissions and response conventions

| Area | Owner/trader | Worker |
| --- | --- | --- |
| Catalog and full commercial orders | Allowed in scope | Denied |
| Receiving queue, receipts, stock, dispatch | Assigned warehouses | Assigned warehouses |
| Resolve findings and adjust stock | Assigned warehouses | Denied |
| Expenses, invoice imports, Excel exports | Assigned warehouses | Denied |
| Expense category management | Owner only | Denied |
| Receipt evidence | Assigned warehouses | Assigned warehouses |
| Invoice source and expense invoice files | Assigned office roles | Denied |

GET/PATCH routes generally return `200`. POST routes generally return `201`; receipt confirmation, order confirm/cancel, and logout explicitly return `200`. Responses vary by feature: catalogs and orders can return arrays, while stock, sync, files, expenses, exports, and imports use their documented objects. There is no universal `data` envelope.

| HTTP code | Client handling |
| --- | --- |
| `400` | Display validation feedback and retain edits |
| `401` | Attempt one serialized refresh, then ask for sign-in if it fails |
| `403` | Remove the unavailable action or warehouse from the current workflow |
| `404` | Record unavailable or hidden by access controls |
| `409` | Present conflict details, shortages, or outstanding review fields |
| `413` | Reduce upload size |
| `500` / `503` | Keep retryable work and show a recoverable service error |

NestJS errors usually include `message` and `statusCode`, but custom errors can also contain `shortages` or `fields`. Handle those structures and a safe fallback message. Store dates as `YYYY-MM-DD` and timestamps as ISO strings. Stock counts can be decimal strings above JavaScript's safe integer range; monetary responses currently use JSON numbers. Avoid floating-point calculations when preparing commercial values.

## 4. Office Web workflow

### Catalog and orders

Create, list, read, or patch `/parties` and `/products`. Parties use `name`, `type` (`supplier` or `customer`), and optional `nameCn`, `shippingMark`, `phone`, and `address`. Products require at least one of `nameEn`, `nameAr`, or `nameCn`, and accept `modelNo` and `photoUrl`.

Create a draft with `POST /orders`.

```json
{
  "warehouseId": "11111111-1111-4111-8111-111111111111",
  "supplierId": "22222222-2222-4222-8222-222222222222",
  "customerId": "33333333-3333-4333-8333-333333333333",
  "orderDate": "2026-11-27",
  "currency": "USD",
  "lines": [{
    "productId": "44444444-4444-4444-8444-444444444444",
    "cartons": 10,
    "qtyPerCarton": 12,
    "unitPrice": "2.5000",
    "amount": "300.00"
  }],
  "totalAmount": "300.00"
}
```

The server validates amounts and derives quantity from cartons times quantity per carton. Unit prices support four decimal places and amounts two. Optional order fields include `orderNo`, `expectedDate`, and `deposit`. Read with `GET /orders/:id` and list with `GET /orders?warehouseId=...`. Patch draft dates, deposit, currency, and lines through `PATCH /orders/:id`. The current patch service does not change supplier, customer, or warehouse.

Confirm with `POST /orders/:id/confirm`. Cancel a draft or ready order with `POST /orders/:id/cancel`. Editing after confirmation fails. Manual creation has no client-operation deduplication; after an ambiguous response, reconcile through the order list before submitting again.

### Findings, expenses, and reports

- `GET /findings?status=open` lists visible findings. Resolve with `PATCH /findings/:id` and `{ "status": "resolved", "note": "Checked with supplier" }`.
- `GET /expense-categories` returns `{ categories }`. Owners create categories with `name` and optionally `nameCn`, and patch their name or `active` flag.
- `POST /expenses` accepts `clientOperationId`, `warehouseId`, `amount`, uppercase `currency`, `expenseDate`, `categoryId`, optional `customerId`/`orderId`, and exactly one of `invoiceFileId` or `noInvoiceNote`. List through `/expenses?warehouseId=...` and read `/expenses/:id`.
- `POST /exports` accepts `{ warehouseId, kind, filters }`. Kinds are `goods_received`, `goods_dispatched`, `inventory`, `stock_movements`, `order_vs_received`, `expenses`, and `purchase_order`. Filters support `from`, `to`, `customerId`, `supplierId`, and `orderId` as applicable. Purchase orders require `orderId`.
- `GET /exports?warehouseId=…` returns `{warehouseId, exports}` for the latest 100 requests, newest first. The Office Web history polls this list while a job is active.
- Poll `GET /exports/:id` for `queued`, `processing`, `completed`, or `failed`. Fetch `/exports/:id/file` as an authenticated binary download when complete. The worker process must be running.

### Invoice extraction and review

Upload a purchase source with purpose `invoice_source` or an expense source with `expense_invoice`. Then call `POST /orders/extract` or `/expenses/extract` with `{ warehouseId, fileId }`.

Poll `GET /imports/:id` until `draft` or `failed`. Draft fields contain `value`, `confidence`, and `source`; `unreviewedFields` identifies values that still need review. Patch `/imports/:id` with edited `header`, `lines`, and `review`. Resolve purchase `review.supplierId`, `review.customerId`, and every line's `productId`, or the expense `review.categoryId`. Record reviewed paths in `review.reviewedFields`.

Commit with `POST /imports/:id/commit`. It returns `status` and `orderId` or `expenseId`. A purchase becomes a draft order that still needs normal confirmation. XLSX parsing is direct; live vision accuracy, searchable-PDF parsing, and handwriting automation remain release follow-ups. The sample provider returns synthetic fields for development.

## 5. Worker Mobile workflow

### Receive goods

Fetch `GET /orders/awaiting?warehouseId=...`. Each entry contains supplier/customer information, product names, line IDs, expected cartons, received cartons, and outstanding cartons. Cache this worker response only. The full commercial order endpoint is office-only.

Persist the draft and generate one UUID operation ID before confirmation. Submit `POST /receipts/confirm` with this shape.

```json
{
  "clientOperationId": "55555555-5555-4555-8555-555555555555",
  "warehouseId": "11111111-1111-4111-8111-111111111111",
  "orderId": "66666666-6666-4666-8666-666666666666",
  "receivedAt": "2026-11-27T09:00:00Z",
  "lines": [{
    "orderLineId": "77777777-7777-4777-8777-777777777777",
    "cartons": 6,
    "lengthCm": 60,
    "widthCm": 45,
    "heightCm": 9,
    "weightKg": 12,
    "condition": "ok"
  }]
}
```

The server calculates CBM, saves findings without blocking receipt confirmation, posts stock, and advances the order. The response includes `id`, `receiptNo`, `orderStatus`, `lines`, `findings`, and `stockMovements`. Read current receipt details from `GET /receipts/:id`.

For an actual product different from the ordered product, include its known `productId`. Unmatched lines need a known product ID. Unknown-product creation and receipt without an existing order remain server dependencies for the delivery-note flow. Workers must never create commercial order data locally.

### Sync and retry

1. Persist confirmed receipt actions in Drift with their original worker, tenant, warehouse, operation ID, and payload. Keep photo uploads in a separate queue.
2. Send `POST /sync/push` with `{ "operations": [receiptPayload] }`. The current push service handles receipt confirmations only. It returns `{ results }` with each item's `index`, `operationId`, `status` (`accepted` or `rejected`), and either `receipt` or `error` containing `statusCode`, `message`, and `retryable`.
3. Remove accepted items individually. Retry transport failures with the same operation ID and exact payload. Changed actor, warehouse, or payload returns `409`; an identical retry returns the original acknowledgment.
4. Pull `GET /sync/pull?warehouseId=...&cursor=...`. The response is `{ cursor, changes }`; each change has `seq`, `entity`, `entityId`, `action`, `payload`, and `createdAt`. Process at most 100 returned changes per page and pull again until empty. Persist the cursor only after applying the page successfully.
5. Keep cursors per tenant and warehouse. Sync is a change feed, so also load the initial queue and stock through REST. It currently excludes expenses and file upload events.

On a shared device, finish sync under the original identity. If credentials are revoked, retain or clear drafts according to the planned sign-out policy before another worker uses the device.

### Dispatch and stock

`GET /stock`, `/stock/movements`, and `/stock/age` require `warehouseId`. Filters include `customerId`, `customerMark`, `supplierId`, `brand`, and `productId`. Movements accept `limit` from 1 to 200 and the returned `nextCursor` for the next page. Balances return `{ warehouseId, balances }`, history `{ warehouseId, movements, nextCursor }`, and age `{ warehouseId, age }`.

Office roles can post `/stock/adjustments` with `clientOperationId`, `warehouseId`, `reason`, `photoFileId` of purpose `adjustment_photo`, signed `cartons`, and optional signed `qty`/`cbm` and `note`. Supply a `receiptLineId` to identify a lot; otherwise supply the customer, supplier, brand, and product group. Lot-linked adjustments derive their group identifiers from the lot. Workers cannot submit adjustments.

Prepare dispatch locally, then confirm online with `POST /dispatches` using `clientOperationId`, `warehouseId`, `customerId`, optional `destination`/`dispatchedAt`, and lines with `supplierId`, `brand`, `productId`, and `cartons`. Stock dimensions must match the selected group. A shortage returns `409` and `shortages`; refresh stock before correcting the draft. Reuse the exact request for retries. `GET /dispatches?warehouseId=...` lists shipments and `/dispatches/:id` returns packing details and lot allocations.

## 6. Files for both clients

Use multipart `POST /files?warehouseId=...` with `uploadId` (UUID), `purpose`, `file`, optional `takenAt`, and optional paired `entityType` and `entityId`. Let the HTTP library generate the multipart boundary.

Purposes are `receipt_photo`, `piece_photo`, `damage_photo`, `adjustment_photo`, `expense_invoice`, `invoice_source`, `delivery_note`, and `other`. Entity types are `receipt`, `receipt_line`, `order`, `expense`, `adjustment`, and `import`. Supported evidence types include JPEG, PNG, WebP, HEIC/HEIF, PDF, XLSX, XLS, and CSV. The configured upload size defaults to 15 MB; file-format acceptance does not guarantee automatic extraction support.

Identical byte retries with the same upload ID return the existing file; another warehouse or changed bytes returns `409`. Store the returned file ID. Link photo uploads to the server receipt or line ID after receipt sync. Existing file rows are immutable; there is currently no endpoint to relink a previously unlinked file.

List with `GET /files?warehouseId=...&entityType=receipt&entityId=...`; metadata is `/files/:id` and private content `/files/:id/content`. All require bearer authentication. Browsers should fetch bytes and use a temporary object URL for images/downloads because a plain image link does not attach the bearer header. Keep provider credentials and object paths on the server.

## 7. Live updates and reconnect

Use a Socket.IO client with the host origin, without `/api/v1`, and the default `/socket.io/` transport path. Office production uses its own origin through Nginx. Local browser testing needs the Vite proxy described above.

```ts
const socket = io(socketOrigin, { auth: { token: accessToken } });
socket.on('connect', () => {
  socket.emit('subscribe', { warehouseId }, (result) => {
    if (!result.ok) showSubscriptionError(result.error);
  });
});
socket.on('receipt.confirmed', () => refreshReceivingAndStock());
```

The example is integration pseudocode; supply the functions from the owning client feature. Subscription success is `{ ok: true, warehouseId }`, while denial is `{ ok: false, error }`. The server revalidates session and membership before delivery.

Events are `order.confirmed`, `order.cancelled`, `receipt.confirmed`, `finding.resolved`, `dispatch.confirmed`, `adjustment.recorded`, and office-only `expense.recorded`. Refresh the relevant REST view and deduplicate by entity ID. After refresh, reconnect with the new access token and re-subscribe. After a network reconnect, subscribe and catch up through sync pull. Office expenses recover over REST. Create a fresh scoped connection when switching warehouses to avoid retaining previous subscriptions.

## 8. Designs and implementation structure

Read the [design index](../designs/README.md), the [brand kit](../context/PROJECT-CONTEXT.md#brand-kit), and the [approved app layouts](../tech-stack/PROJECT-STRUCTURE.md#app-structure) before UI implementation.

- Office Web uses `src/app` for sessions and navigation, `src/api` for request setup, `src/features/<feature>/pages` for pages and local components, and `src/shared/ui` for UI with multiple consumers.
- Worker Mobile uses `lib/app` for sessions and navigation, `lib/api` for requests, feature screens with their local state and widgets, `lib/offline` for Drift and queues, and `lib/shared/widgets` for genuinely reused controls.
- Reuse one request/session layer per app. Keep feature behavior near its page or screen and move code to a shared scope when it has multiple consumers. Explain permission, transaction, and retry decisions in comments.

Before coding, record the chosen reference design and API dependencies in the app's numbered plan. For missing endpoints, provisioning, proxy setup, or designs, record the dependency and resolve the affected scope with the user. Update the plan and progress with verified results and commit them with the implementation. [Agent workflow](../../AGENTS.md#workflow-for-every-step)

## 9. First integration checks

Use synthetic users in two tenants and two warehouses. Verify login and refresh, commercial data denial for workers, order confirmation, an offline partial receipt and replay, remaining stock, independent photo retry, live refresh, and reconnect recovery. Verify dispatch shortages and office-only expenses, imports, and exports as those screens are built. Run the owning app's checks and record evidence in its progress log.

For backend setup use the [server README](../../apps/server/README.md). Release gaps and regional checks remain tracked in the [Server Plan](../plan/server/PLAN.md#follow-ups-during-client-development) and [Server Progress](../progress/server/PROGRESS.md).

## 10. Owner settings and user access (Office Web Step 5)

Implemented by [SettingsModule](../../apps/server/src/modules/settings/settings.module.ts), with migration `0012_user_access_settings`. Apply migrations with the configured migration role before running the updated server. Existing users default to active. These APIs require an authenticated **active owner in the current company**; traders and workers receive 403. Never send a tenant ID to choose the authorization scope. Company roles are independent of warehouse memberships.

| Request | Body / query | Response |
| --- | --- | --- |
| `GET /users` | `search` (name/phone literal substring, max 200), `role=owner\|trader\|worker`, `active=true\|false`, UUID `cursor`, `limit` (default 50, 1–200) | `{users: ManagedUser[], nextCursor: string\|null}` |
| `GET /users/:id` | Company user ID; explicit reload after conflict | `ManagedUser` |
| `POST /users` | `{name, phone, role, initialPassword, warehouseIds: string[]}` | `{user: ManagedUser, sessionsRevoked: false}` (201) |
| `PATCH /users/:id` | `{expectedVersion, name?, phone?, role?, active?, warehouseIds?}` | `{user: ManagedUser, sessionsRevoked: boolean}` |
| `POST /users/:id/password-reset` | `{expectedVersion, newPassword}` | `{user: ManagedUser, sessionsRevoked: true}` (201) |
| `GET /settings/warehouses` | None | `{warehouses: [{id, name, code}]}` |
| `GET /settings/receiving-tolerances` | None | `ReceivingTolerances` |
| `PATCH /settings/receiving-tolerances` | `{expectedVersion, cbmTolerancePercent, weightTolerancePercent}` | `ReceivingTolerances` |

`ManagedUser` is `{id, name, phone, role, active, warehouseIds: string[], version: number}`. Passwords and password hashes are never returned. Names are trimmed, required, max 200; phones are trimmed, required, max 64 and unique within a company (no automatic phone-format conversion). Passwords are 12–128 characters, entered and shared directly by the owner. No forced-change, email, SMS or mobile UI flow is added. User pages sort by UUID ascending, with an exclusive last-ID cursor. Reset pagination when filters change, deduplicate loaded IDs and stop repeated cursors.

`ReceivingTolerances` is `{cbmTolerancePercent: string, weightTolerancePercent: string, version: number}`; decimal strings use two places, e.g. `"3.00"` and `"5.00"`. PATCH accepts a numeric value or plain decimal string from 0–100 with at most two decimals. Send both fields and the company version; values are saved atomically. The existing receipt comparison reads them when a receipt is processed, including an offline receipt synced later. Historical findings are never regenerated.

Warehouse assignment replaces the user's memberships atomically. Every ID must belong to the authenticated company. The settings warehouse list includes existing company warehouses for assignment; it grants no additional access to orders, stock, receipts or dispatch. There is no warehouse-creation API in this change. Empty assignments are allowed.

Identity-only edits retain sessions. Changes to role, warehouse assignments or active status, and password resets, revoke **all** affected sessions in the same transaction. Reactivation allows fresh sign-in and never revives old sessions. Disabled users are rejected during login, refresh, authenticated requests and realtime revalidation. If a successful response has `sessionsRevoked: true` for the signed-in user, clear the local session immediately. Workers keep their existing API shapes; no pending mobile operations are deleted.

Company-row locking serializes administrative writes. The server rechecks the acting owner's active role after acquiring the lock, rejects self-disable, and prevents disabling/demoting the last active owner under concurrency. `expectedVersion` is mandatory for edits, resets and tolerances; successful writes increment the entity's version. Audit records contain safe identity/access fields or the reset event, never credentials.

Errors retain the standard `{message, ...}` response shape and add a stable `code` for these settings conflicts:

| HTTP | `code` | Client behavior |
| --- | --- | --- |
| 409 | `PHONE_CONFLICT` | Keep draft; ask for a different company phone |
| 409 | `STALE_VERSION` | Keep draft; offer explicit Reload latest, which replaces it |
| 409 | `LAST_OWNER` | Explain that at least one active owner must remain |
| 400 | `SELF_DISABLE` | Explain that users cannot disable their own account |
| 400 | `INVALID_WAREHOUSE` | Refresh warehouse options and review selection |
| 400 | Standard validation message | Correct missing/invalid fields, password bounds or percentages |
| 401 / 403 / 404 | Standard auth / permission / not-found message | Clear rejected sessions through the shared auth layer; show permission state; cross-company user IDs are not found |

The Office Web screens use 50-user API pages, shared eight-row loaded-record pagination, owner-only settings tabs, glass dialogs and EN/AR/Chinese copy. Desktop user cards are 650px high; tolerance cards are 460px high. Internal scrolling preserves access to content; narrow layouts use automatic card heights.

For reproducible server checks, build first, then run `TEST_ADMIN_DATABASE_URL=<local-admin-url> node apps/server/test/settings-regression.cjs` from the repository root. Supply the URL privately through the environment. This script creates and removes a unique disposable database and restricted role, applies migrations only there, and checks HTTP contracts/guards, RLS, concurrency, sessions, validation, and real receipt comparisons. It does not migrate or seed the configured application database. Real-account/permission-change and previous-mobile integration checks remain pending until explicitly exercised.
