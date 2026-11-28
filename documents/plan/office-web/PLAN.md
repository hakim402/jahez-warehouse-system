# Office Web Plan

The first milestone is a Jahez trader creating a purchase order and seeing stock update after a worker's receipt syncs. The full sequence follows the [Office Web roadmap](ROADMAP.md).

Before coding a step, expand its heading here with the goal, numbered tasks, affected screens or modules, design references, API and other dependencies, and acceptance checks. Mark the step `In progress` when implementation starts.

After verification, record the date, completed work, actual check results, gaps, and next action under the matching step in [Office Web PROGRESS.md](../../progress/office-web/PROGRESS.md). Mark the plan step `Verified` once its required checks pass. Follow the [repository workflow](../../../AGENTS.md#workflow-for-every-step).

The filenames below refer to `documents/designs/office-web/`. Use `reference-dropdown.png` for menu styling, `reference-dialog.png` for dialog styling, and `reference-table-states.png` for loading, empty, no-results, and error states. Bind the mockups to the [Backend Integration Guide](../../api/BACKEND-INTEGRATION.md).

## Step 1 — App shell, API connection, and sign-in

### Language trigger refinement — Verified (2026-11-28)

1. Match the minimal header language control in `06-dashboard-overview.png` and `reference-dropdown.png`: remove its background and border, retain the globe, language label, chevron, 44 px target, and visible keyboard focus. Share this appearance with the sign-in language control.
2. Verify Office Web build and synthetic language switching, transparent trigger, dropdown opening, and Arabic RTL. No API changes.

### Header profile control — Verified (2026-11-28)

1. Refine the header from `06-dashboard-overview.png` and `reference-dropdown.png` per the user's direction: replace the initials tile and chevron with one profile icon, with no trigger background or border. Preserve the accessible 44 px target and account dropdown.
2. Verify build, synthetic click/keyboard menu opening, Escape/focus return, and narrow/RTL layout. No API changes.

### Glass surfaces refinement — Verified (2026-11-28)

1. Use `06-dashboard-overview.png`, `reference-dropdown.png`, and `reference-dialog.png` for shell and control proportions, with the requested translucent glass finish. Define reusable glass surface, input, and floating-panel tokens in `src/global.css` and apply them to all cards, header, sidebar, mobile drawer, menus, and dialogs.
2. Share one accessible Radix filter select across catalog, orders, receiving, and inventory. Style its trigger, options, selected state, scrolling, and focus without native dropdown chrome. Retain existing filter values, clearing, translations, and API requests. Give dialog inputs the shared glass styling.
3. Verify the Office Web build and synthetic browser filtering, keyboard selection, dialog focus, glass rendering, desktop/narrow layout, and Arabic RTL. Record results under Steps 1–3. No API, server, or mobile changes are required.

### API error and session reliability fix — Verified (2026-11-28)

1. Preserve validation message arrays, conflict shortages, review fields, and the safe error body in the shared Office Web request layer. Keep existing status-based handling and show server validation detail in the order and catalog editors without changing their layouts.
2. Restore a still-valid tab session without an unnecessary refresh. Retain it after transient refresh failures only while its access token remains valid; clear it after confirmed authentication rejection or local expiry. Keep refresh serialization and idle sign-out unchanged.
3. Use `01-sign-in.png`, `03-purchase-order-editor.png`, `reference-dialog.png`, and `reference-table-states.png` for the affected loading, validation, and error states. Depend on the existing authentication, order, and catalog contracts in sections 2–4 of the Backend Integration Guide; no Server or Worker Mobile contract changes.
4. Verify structured 400/409 payloads, transient and rejected refresh behavior, valid-token reload, expired-token rejection, order/catalog validation display, desktop/narrow layouts, and Arabic RTL with synthetic data. Run Office Web typecheck and production build.

**Local warehouse configuration fix** — Set the existing `VITE_DEFAULT_WAREHOUSE_ID` to Yiwu Warehouse in the private Office Web environment. Verify Majed's warehouse membership in PostgreSQL and the hook's configured lookup. Reload Vite so the configured warehouse replaces the unassigned state.

**Status** Partially verified; the API error and session reliability fix is verified. The Office Web implementation passed the build, live proxy checks, and synthetic browser checks. Live account sign-in and switching among assigned warehouses remain open verification items.

**Goal** Give Jahez owners and traders a working, accessible sign-in and authenticated Office Web shell in English, Arabic RTL, and Simplified Chinese.

1. Build the sign-in page from `01-sign-in.png` and `background.png`. Use the supplied Jahez wordmark, the language selector from `reference-dropdown.png`, labeled phone and password fields, password visibility, and translated loading and error states.
2. Put global styles and Jahez theme values in `src/global.css`. Keep feature styles in adjacent CSS Modules. Self-host Roboto, Cairo, and Noto Sans SC. Persist the language choice and set HTML language and direction. Share accessible controls when the sign-in and shell both use them.
3. Add one typed REST request layer and local Vite proxies for `/api/v1` and `/socket.io/`. Wire the existing login, refresh, and logout endpoints. Restore the session within the browser tab, serialize rotating token refreshes, clear queries on account changes, and sign out after 30 minutes of inactivity on a shared device.
4. Build protected navigation using the sidebar and top bar from `06-dashboard-overview.png`, with responsive navigation and account sign-out. Limit working routes to Step 1. Keep the backend's tenant and role in the session and support an optional configured Jahez tenant when a phone is ambiguous.
5. Resolve an optional `VITE_DEFAULT_WAREHOUSE_ID` with the existing access-checked `GET /warehouses/:id`. Display the verified warehouse or the applicable unassigned or unavailable state. Configure `VITE_TENANT_ID` only when the deployment needs an explicit tenant for sign-in. Warehouse discovery and switching across assigned warehouses need a server contract and remain pending.
6. Build Office Web and check the running local API proxy. Exercise sign-in, role gating, reload, refresh, account sign-out, and known-warehouse states with synthetic data. Check the supplied layouts, keyboard behavior, and language switching at desktop and narrow widths.
7. Refine the sign-in card in `SignInPage.module.css` with a translucent tint and backdrop blur over `background.png`. Verified labels and controls at desktop and mobile widths.
8. Give the phone and password fields a translucent finish and reduce the sign-in card's width and spacing. Verified desktop and mobile sizing, readability, keyboard focus, and validation styles.

This step changes Office Web only. The server and Worker Mobile contracts stay as they are.

## Step 2 — Catalog and manual purchase orders

### Order date filter refinement — Verified (2026-11-28)

1. Refine the existing date-range popover using `02-purchase-orders.png` and `reference-dropdown.png`, retaining the requested glass finish. Extract a reusable date-range control with a matching filter trigger, clear heading, aligned From/To fields, clear action, and close action. Show the selected range on the trigger.
2. Preserve the current inclusive date filtering, range bounds, translations, keyboard focus, and existing orders API. Keep control styles beside shared UI and shared glass tokens in `global.css`.
3. Verify build, synthetic date selection/clearing, range constraints, popover keyboard close/focus return, desktop and narrow layouts, and Arabic RTL. No server/mobile changes.

**2026-11-28 refinement — Verified.** Apply the Step 1 shared glass controls to catalog and order filters and catalog dialogs. Preserve existing filtering and form behavior.

**Status** Partially verified. The Office Web build and synthetic browser workflow passed. A live Jahez account and Worker Mobile receiving handoff still need end-to-end verification.

**Goal** Let Jahez office users maintain the catalog and create, review, and confirm a manual purchase order for receiving.

1. Add typed `/parties`, `/products`, and `/orders` requests using the Step 1 authenticated client and account-scoped query keys. Order reads use the active verified warehouse when configured and the server's membership-scoped list when no warehouse is configured. New orders require a verified active warehouse.
2. Build the purchase order list from `02-purchase-orders.png` with search, supplier and date filters, status counts, and pagination. Reuse the table states and dropdown references. Add protected Purchase orders and Catalog navigation.
3. Build the editor and detail from `03-purchase-order-editor.png` and `04-purchase-order-details.png`. Preserve existing line details and draft edits after a failed save. Use integer arithmetic for quantity and monetary previews and use saved values from the server. Respect the draft edit contract and available confirm or cancel actions. Reconcile an ambiguous create through the order list before retrying.
4. Build the product, supplier, and customer tabs from `05-catalog.png` using the shared table layout and `reference-dialog.png` for add and edit forms. The tabs share the same layout. The product imagery reference is sample artwork. Render actual catalog photos only when available from the record.
5. Verify the build, desktop and narrow layouts, English, Arabic RTL, and Simplified Chinese, filters and table states, catalog create and edit, order create and edit, validation, confirm and cancel, and the receiving handoff. Use synthetic data for browser checks and track live-server and Worker Mobile verification separately.

Dependencies are Server Step 3 for order and catalog contracts, Step 1 for account and verified warehouse context, and the assigned worker for end-to-end receiving verification. This step works in Office Web.

## Step 3 — Live receiving and stock dashboard

### Receiving filter alignment — Verified (2026-11-28)

1. Follow the single filter row in `07-receiving.png` and `reference-dropdown.png`. Correct the shared toolbar date input width so status and date remain side by side, with responsive wrapping only when necessary.
2. Preserve existing date/status filtering and API dependencies. Verify the Office Web build and synthetic desktop/narrow filter alignment and functionality. Office Web CSS only.

### Decimal stock rendering fix — Verified (2026-11-28)

1. Add one exact decimal-safe stock-count formatter, sign check, and summation helper in the stock feature. Use it for dashboard totals, movement signs, receipt chart aggregation, and inventory carton/unit values.
2. Preserve the current `06-dashboard-overview.png`, `07-receiving.png`, and `09-inventory.png` layouts, localized number formatting, table columns, and chart unavailable state. Depend on the existing stock and movement contracts; section 3 of the Backend Integration Guide permits decimal strings above JavaScript's safe integer range.
3. Verify integer, fractional, negative, zero, malformed, and above-safe-integer stock values without render crashes or precision loss. Check dashboard, receiving, inventory, chart summaries, desktop/narrow layouts, and Arabic localization with synthetic data. Run Office Web typecheck and production build. No Server or Worker Mobile changes.

**2026-11-28 refinement — Verified.** Apply Step 1 glass surfaces to dashboard cards and panels, and share its custom filters in receiving and inventory. Preserve existing warehouse requests.

**Status** Partially verified; the decimal stock rendering fix is verified. The build and synthetic browser checks passed, including receipt events and reconnect recovery. Receipt history, historical summary-card comparisons, and live Worker Mobile receiving verification remain open.

1. Use `06-dashboard-overview.png`, `07-receiving.png`, and `09-inventory.png` for the dashboard, receiving queue and findings, and inventory tabs. Reuse shared table, filter, loading, and error controls with all three languages.
2. Add account and warehouse scoped queries for `/orders/awaiting`, `/findings`, `/stock`, `/stock/movements`, and `/stock/age`. Preserve exact integer stock strings. Load movement pages through the server cursor.
3. Subscribe to warehouse Socket.IO events with the current access token. Refresh REST views on events, subscription and reconnect. Recreate the connection when credentials or warehouse change, recover unauthorized connections through the session manager, and poll while disconnected.
4. Show current queue counts, open findings, exact cartons in stock, expected deliveries, and recent stock activity on the dashboard. Derive receipt charts from ledger posting dates. Receipt history and historical summary-card comparisons require server contracts. Receipt evidence and finding resolution belong to Step 4.
5. Verify the production build and exercise synthetic receiving, inventory, and reconnect flows. Check desktop and narrow layouts, Arabic RTL, missing warehouse access, and error recovery. Record live Worker Mobile checks separately.
6. Correct the overview to match `06-dashboard-overview.png`, including icon cards, two chart panels, compact deliveries and attention panels, and the four-column recent activity table. Read complete movement pages for the four-week charts and retain a clear unavailable state on failure. Verified the rendered design at desktop and narrow widths.

## Step 4 — Findings, evidence, and dispatch views

**Status** Verified (2026-11-28).

**Goal** Show ordered and received values together, let traders review private evidence and resolve findings, and display dispatch packing details and authorized stock adjustments with traceable movement history.

**Confirmed forms**

- Finding resolution uses a review dialog: read-only discrepancy and receipt details, available photo evidence, a required resolution note, Cancel, and Resolve finding actions.
- Stock adjustment uses an advanced lot-aware form: existing stock group selection, Increase or Decrease, cartons, optional units and CBM with matching signs, optional receipt-lot selection, required reason, one required photo, and an optional note.

**Implementation tasks**

1. Extend the shared Office Web request/session layer for authenticated multipart uploads and private binary downloads while preserving the existing serialized refresh, one-401 retry, abort behavior, and safe structured errors. Add typed adjustment shortage details for HTTP 409 responses.
2. Add focused receiving, files, dispatch, and stock feature APIs and account/warehouse-scoped query keys. Extend stock, movement, and finding types with the identifiers and receipt evidence needed by Step 4. Reuse `useOrderScope`, `authenticatedJson`, `DataTable`, `OfficeDialog`, `LabeledField`, `RecordState`, and the stock-count helpers.
3. Build the finding review workflow in `features/receiving`: show open and resolved findings, receipt navigation, discrepancy context, private receipt/line evidence, and a required-note resolution mutation. Preserve filters, all three languages, dialog focus, busy-state protection, validation feedback, and post-resolution live refresh.
4. Add `/receipts/:receiptId` from `08-receipt-details.png`. Compose `GET /receipts/:id` with `GET /orders/:id`, match receipt lines to ordered lines, show ordered versus received cartons and measurements, findings, condition, receipt details, and separately reported photo availability. Fetch evidence through `/files` and authenticated `/files/:id/content`, using temporary object URLs and cleanup.
5. Enable the Dispatch navigation item and add `/dispatch` and `/dispatch/:dispatchId` from `10-dispatch-history.png` and `11-dispatch-details.png`. Implement customer/date/search filtering and shared table pagination for the server's capped dispatch list. Show packing lines, source-receipt allocations, shipment totals, and a print-specific packing-list layout with browser printing.
6. Add the confirmed advanced adjustment dialog to inventory. Select an existing balance group and optional receipt lot, derive remaining lots from movement history where stock age lacks `receiptLineId`, validate signed integer cartons/units and signed finite CBM, upload one `adjustment_photo`, then submit a stable `clientOperationId`. Show available/requested/shortage conflicts and retain recoverable edits. Refresh balances, movements, age, and focused lot data after success.
7. Surface adjustment history in stock movements with stable row IDs, adjustment numbers/reasons, and receipt/dispatch links where available. Reuse exact decimal rendering and comparison helpers rather than converting large stock strings to JavaScript numbers.
8. Extend warehouse live-event invalidation to focused finding, receipt, evidence, dispatch, adjustment, and lot query keys. Add English, Arabic RTL, and Simplified Chinese copy plus feature-adjacent CSS Modules using the shared Jahez glass and brand tokens.
9. Verify the affected workflows with synthetic data, update Office Web progress with actual results and remaining integration gaps, and commit/push the focused Office Web update without deploying.

**Final review remediation (2026-11-28)**

1. Retain each receipt lot's original received cartons, units, and CBM, derive the signed lot-adjustment units/CBM with exact proportional arithmetic, display the automatic values read-only, and validate the derived values before submission.
2. Enforce exact customer, supplier, brand, and product equality, including null dimensions, while deriving receipt lots from movement history; show the brand in lot choices so same-product groups remain distinguishable.
3. Match receipt lines to ordered lines only when the product identity agrees. Keep wrong-product lines as unmatched receipt rows rendered with their actual product and brand.
4. Add ordered-versus-received carton size, volume, and weight to the receipt comparison shown in `08-receipt-details.png`, preserving exact values and narrow internal table scrolling.
5. Treat adjustment timeout, abort, and network failures after submission as an unknown result. Keep the uploaded photo, payload, and client-operation ID stable for a same-operation retry, prevent dismissal while the result is unknown, and allow cancellation only for known upload failures or confirmed server responses. Infer `POST` for JSON and multipart bodies in the shared request layer so evidence uploads use the server contract.
6. Scope resolved-findings query errors to resolved/all views so a failed optional resolved request never hides the open findings table.
7. Normalize Arabic-Indic and Persian digits plus the Arabic decimal separator before adjustment numeric validation, reusing the existing order-editor normalization behavior.

**Affected Office Web modules and screens**

- `src/api/client.ts` and `src/app/session.ts` for multipart, binary, and conflict handling.
- `src/app/app.tsx`, `OfficeNavigation.tsx`, and `use-warehouse-live.ts` for routes and live invalidation.
- `src/features/receiving/` for finding review, receipt detail, and evidence.
- `src/features/stock/` for typed warehouse data, movement history, lot derivation, and the adjustment dialog.
- `src/features/dispatch/` for dispatch history, detail, and print layout.
- Shared UI, formatting, records copy, translations, and global/feature styles only where reused by these screens.

**Design references**

- `documents/designs/office-web/07-receiving.png`
- `documents/designs/office-web/08-receipt-details.png`
- `documents/designs/office-web/09-inventory.png`
- `documents/designs/office-web/10-dispatch-history.png`
- `documents/designs/office-web/11-dispatch-details.png`
- `reference-dialog.png`, `reference-dropdown.png`, and `reference-table-states.png`
- The Jahez brand kit and existing shared glass controls take precedence over generic style recommendations.

**API dependencies**

- `GET /findings?status=open|resolved` and `PATCH /findings/:id`.
- `GET /receipts/:id` and `GET /orders/:id`.
- `GET /files?warehouseId=...&entityType=...&entityId=...`, `GET /files/:id/content`, and multipart `POST /files?warehouseId=...`.
- `GET /dispatches?warehouseId=...&customerId=...` and `GET /dispatches/:id`.
- `GET /stock`, `/stock/movements`, `/stock/age`, and `POST /stock/adjustments` in the active warehouse.
- Existing Socket.IO events `finding.resolved`, `receipt.confirmed`, `dispatch.confirmed`, and `adjustment.recorded`.

**Known contract constraints**

- There is no receipt-list/history endpoint, so receipt detail is reachable from findings and receipt-linked movements; a complete receipt-history index remains a future Server dependency.
- There is no adjustment-list/detail endpoint, so adjustment history comes from `kind = "adjust"` stock movements and does not include the adjustment note or photo metadata.
- Stock-age rows omit `receiptLineId`; optional lot selection and remaining-lot checks must use movement history.
- Dispatch listing is capped at 200 records with no server date filter or pagination, so filtering and pagination remain client-side.
- Dispatch Excel export belongs to Step 6.
- No Server or Worker Mobile changes, migrations, new endpoints, or deployment actions are part of this step.

**Acceptance checks**

1. Resolve a synthetic finding only with a nonblank note, show receipt evidence and discrepancy details first, retain dialog edits after a failed request, and refresh the finding after success.
2. Open receipt detail from a finding and verify ordered/received comparison, partial and unmatched lines, finding context, evidence availability, private image viewing, loading/empty/error states, and object-URL cleanup.
3. Open a synthetic partial dispatch, verify search/customer/date filtering, pagination, packing lines, source receipts, allocation quantities, client-calculated units, totals, narrow layout, and print output.
4. Submit positive and negative group and lot adjustments with a required synthetic photo and stable operation ID. Verify optional units/CBM sign rules, required reason/photo, overdraw conflict details, replay-safe retry behavior, and updated balances/movements/age.
5. Confirm adjustment history remains visible with exact decimal values and live-event refresh updates focused receipt, finding, dispatch, and stock queries.
6. Run `pnpm --dir apps/office-web typecheck` and `pnpm --dir apps/office-web build`, then exercise desktop, narrow, English, Arabic RTL, keyboard/focus, reduced-motion, loading, empty, no-results, and error states with synthetic or redacted data. Record live-account and live Worker Mobile checks separately.

## Step 5 — Expenses and owner settings

Add expense entry and history with invoice evidence or a documented exception. Add owner controls for users, warehouse access, tolerances, and expense categories.

Use `12-expenses.png` and the Record expense form in `reference-dialog.png`. Use `13-settings.png` for the account and sessions view. Confirm layouts and server contracts for the remaining settings tabs before wiring them.

## Step 6 — Reports and Excel downloads

Add report filters, export progress, and authorized Excel downloads. Include the trilingual purchase order export with product photos.

Use `14-reports-exports.png` with the export history, job status, and download endpoints.

## Step 7 — Invoice import and review

Upload invoice files, show the source beside the extracted draft, and let traders correct flagged values and confirm. Keep manual entry available when extraction fails.

Use `15-invoice-imports.png` for import history and `16-invoice-review.png` for the side-by-side review. Use the private files, extraction, and import review APIs.

## Step 8 — Regional pilot verification

Verify the full pilot in international and mainland China staging, including permissions, all three languages, responsive layouts, downloads, and live reconnect.

Use the screen and shared component references from Steps 1–7 to check the implemented layouts, including Arabic RTL and narrower viewports.
