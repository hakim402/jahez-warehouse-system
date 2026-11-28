# Office Web Progress

## 2026-11-25 — Project baseline

- Available: React and Vite starter with an environment example.
- Checked: the repository contains the app entry point. The API still needs to be connected.
- Next: wire the API base URL and authenticated client. Manual order entry depends on the server contract.

## Step 1 — App shell, API connection, and sign-in

**Current verification:** Implemented and synthetically verified for the cleanup below. Live-account sign-in and assigned-warehouse switching remain pending.

### 2026-11-28 — Steps 1–4 shared structure cleanup

- Moved warehouse scope, identity-aware query keys, and warehouse loading/error state into application/shared ownership. Order keys retain their previous identity order; other feature APIs no longer depend on the Orders scope. Live refresh now targets the active account/warehouse and includes the separate receiving queue.
- Added a reusable resource query boundary with local loading/error/retry states and last-loaded-data handling. Shared product name fallback, photo URL validation, product identity thumbnails, numeric formatting, metadata styling, and clear-filter controls. Removed unused stock and duplicate catalog CSS. Catalog product reads share one cache with Inventory photo enrichment.
- `pnpm --dir apps/office-web build` passed (TypeScript and Vite). Synthetic browser sign-in/reload and account-scoped live receipt-event invalidation passed. Approved glass surfaces, icon-only profile, and transparent language trigger remain in place. No server/mobile/API/dependency changes.


### 2026-11-28 — Structured API errors and session restoration

- Preserved validation message arrays, shortage and review-field details, HTTP status, and the safe error body in the shared Office Web request layer. The order and catalog editors now show all server validation messages while retaining their translated headlines, inline field errors, draft values, focus behavior, and approved layouts.
- Restored a still-valid tab session without an unnecessary refresh. Refresh serialization and idle sign-out remain in place. A transient refresh failure retains the session only while the access token is valid; confirmed HTTP 400/401/403 rejection or local expiry clears it.
- `pnpm --dir apps/office-web typecheck` and `pnpm --dir apps/office-web build` passed. Focused assertions passed for a structured HTTP 409 body, valid reload without refresh, transient-failure retention, HTTP 401 clearing, and expired-token clearing.
- Isolated synthetic Chrome checks passed: valid reload made zero refresh calls; a controlled near-expiry transient failure made one refresh call and retained the session; rejected refresh made one call and returned to sign-in; an expired token made one refresh attempt and cleared after the transient failure because its access token was no longer valid. Order HTTP 400/409 and catalog HTTP 400 details rendered at desktop and narrow widths, including Arabic RTL, without page or dialog overflow. Reviewed `01-sign-in.png`, `03-purchase-order-editor.png`, `reference-dialog.png`, and `reference-table-states.png`.
- This reliability fix is verified. Live Jahez account sign-in and assigned-warehouse switching remain open.

### 2026-11-28 — Minimal language selector

- Removed the shared language trigger background and border on the header and sign-in page. Retained the globe, selected language, chevron, 44 px target, keyboard focus outline, and glass dropdown. Hover/open states use brand-colored text.
- Office Web build passed. Synthetic Chrome checks confirmed transparent borderless triggers, keyboard menu opening, switching to Chinese and Arabic, and mobile RTL without page overflow. Inspected the desktop screenshot. No API changes. Existing Step 1 integration gaps remain.

### 2026-11-28 — Icon-only profile control

- Replaced the header initials tile and chevron with one profile icon. Removed the trigger background and border, retaining its accessible label, focus outline, 44 px target, and existing account dropdown.
- Office Web build passed. Synthetic Chrome checks passed real pointer click and keyboard opening, Escape/focus return, transparent trigger with one icon and no text, desktop/mobile layouts, and Arabic RTL. Inspected the desktop screenshot. No API or session behavior changes. Existing live account verification remains pending.

### 2026-11-28 — Shared glass surfaces and controls

- Reviewed the overview, dropdown, and dialog reference images. Added shared glass surface, input, floating-panel, blur, and highlight tokens in `src/global.css`. Applied them to cards, header, sidebar, mobile drawer, menus, dialogs, and input fields. Sign-in fields now reuse the global input styling.
- Added a shared Radix filter select with custom trigger, chevron, selected check, focus states, constrained scrolling, and RTL direction. Existing language labels and filter values are preserved.
- `pnpm --dir apps/office-web build` passed, including TypeScript. An isolated Chrome fixture with synthetic API data passed all four filter page checks, photo filtering and reset, search, keyboard opening/Escape and focus return, dialog glass fields and focus restoration, desktop (1440 × 1000), narrow layout (390 × 844), and Arabic RTL dropdown direction. Inspected the captured dashboard, dropdown, dialog, and RTL screenshots. No live records were changed.
- This visual refinement is verified. Existing live-account and warehouse-switching verification gaps remain. Next: continue the planned Office Web features.

### 2026-11-27 — Local active warehouse configured

- Diagnosed the unassigned dashboard state as a missing `VITE_DEFAULT_WAREHOUSE_ID`. Set the private local Office Web environment to the existing Yiwu Warehouse ID. Confirmed Majed's owner membership in PostgreSQL.
- Office Web typecheck and production build passed. Reload the running Vite app after its environment restart to verify the dashboard label with the existing signed-in account. The local environment stays ignored by Git; deployment configuration must supply its own authorized warehouse ID.

### 2026-11-27 — Dependency setup verified

- Installed `react-router` 7.18.7, `i18next` 27.2.9, and `react-i18next` 18.0.3. React Router 7 supports the current Node.js 22.16 runtime.
- Verified a clean offline frozen install with strict peer and Node engine checks. The Office Web typecheck and Vite production build passed.
- A synthetic smoke check verified route matching, translations in all three languages, and Arabic text direction. Visual RTL, sign-in, and warehouse switching await implementation and testing.
- Next: review the sign-in reference, obtain the app shell reference, connect the shared auth client, and resolve assigned-warehouse discovery with the server.

### 2026-11-27 — Dashboard UI dependencies verified

- Installed `lucide-react` 1.82.0 and `radix-ui` 1.8.1 for future Jahez-styled controls. The strict frozen install and Office Web typecheck and production build passed.
- A temporary Vite fixture rendered the icon, Radix controls in an RTL container, a table row, and a chart bar in headless Chrome. The fixture bundled all four libraries into a single chunk and emitted Vite's size warning. The Office Web build did not emit that warning.
- Next: integrate icons and controls into the approved screen designs and verify keyboard interaction and RTL behavior in Office Web.

### 2026-11-27 — Sign-in and app shell implemented

- Built the sign-in screen and protected shell from `01-sign-in.png`, `background.png`, and `06-dashboard-overview.png`. Shared the language menu across screens, kept global styles and brand tokens in `src/global.css`, and placed layout-specific styles in CSS Modules. Self-hosted Roboto, Cairo, and Noto Sans SC.
- Connected login, refresh, and logout through a shared API client. Added tab session recovery, one refresh for concurrent unauthorized requests, account cache clearing, and a 30-minute idle sign-out. The shell verifies an optional configured warehouse with the existing warehouse detail API.
- `pnpm --dir apps/office-web build` passed. The running API readiness endpoint, Vite sign-in route, proxied readiness endpoint, and Socket.IO polling handshake all returned HTTP 200.
- In an isolated Chrome fixture, verified protected routes, all three languages and persisted Arabic RTL, keyboard focus, password visibility, desktop and mobile layouts, bad credentials, worker denial, token refresh on 401 and reload, configured and inaccessible warehouses, missing configuration, manual sign-out, and idle sign-out. Sign-in submission and warehouse responses used synthetic data.
- Still open: verify with a live Jahez account and agree the assigned-warehouse discovery API before implementing warehouse switching. Later feature pages and dashboard data remain in their roadmap steps.

### 2026-11-27 — Frosted sign-in card

- Added a translucent lavender tint, backdrop blur, and an inset highlight to the sign-in card. The Office Web build passed. Verified the effect and label readability in the running Chrome preview at 1440 × 900 and 390 × 844.

### 2026-11-27 — Glass inputs and compact sign-in card

- Added a translucent gradient and blur to both sign-in fields. Reduced the card to 420 px on desktop and tightened the spacing while keeping the inputs 50 px tall.
- The Office Web build passed. Checked both fields and the card at 1440 × 900 and 390 × 844 in the running Chrome preview, including keyboard focus and the invalid-field border.

## Step 2 — Catalog and manual purchase orders

**Current verification:** Implemented and synthetically verified for the cleanup below. Live Jahez order creation and Worker Mobile handoff remain pending.

### 2026-11-28 — Validated date ranges and shared product controls

- Date-range inputs now keep editable drafts separate from the applied filters. A reversed range shows a translated inline error and preserves the last valid applied range; correction applies immediately, and reopening discards an invalid draft. Orders and Dispatch reuse the same control, reset action, and keyboard focus behavior.
- Catalog and Inventory share product thumbnails, safe URL checks, language fallbacks, and unavailable-image placeholders. Catalog product/party requests use separate reusable caches with the existing catalog invalidation prefix.
- Synthetic Chrome checks passed valid inclusive ranges, rejected reversed ranges, correction, clearing, Escape/focus return, catalog create/edit and cache refresh, and shared product rendering. Production build passed. No live records or private invoices were used.


### 2026-11-28 — Order date dropdown refinement

- Extracted a reusable `DateRangeFilter` with a glass panel, calendar heading, aligned labeled From/To fields, clear and close actions, and selected-range text on the trigger. Reused shared glass tokens, translations, date formatting, and inclusive order filtering.
- Office Web build passed. Synthetic Chrome checks passed inclusive range filtering, input min/max bounds, clearing, selected trigger, Escape and focus restoration, desktop and 390 px layouts, and Arabic RTL. Inspected desktop, mobile, and Arabic screenshots. No server/mobile changes or live data mutations.
- This refinement is verified. Existing live account and Worker Mobile handoff checks remain pending.

### 2026-11-28 — Glass filters and dialog inputs

- Catalog language/photo and order supplier filters now use the shared styled dropdown. Catalog dialog inputs use the global glass finish.
- Build and synthetic browser filtering, clearing, search, dialog close/focus, narrow layout, and RTL checks passed as recorded under Step 1. Existing live-account and mobile handoff checks remain pending.

- 2026-11-27: Installed `@tanstack/react-query` 5.108.4. A synthetic smoke check confirmed separate cache keys for two warehouses. Catalog and order integration remain pending.
- 2026-11-27: Installed `@tanstack/react-table` 9.3.1 and verified it rendered synthetic stock data in the browser fixture. Office Web table integration remains pending.

### 2026-11-27 — Catalog and manual purchase orders implemented

- Built protected Purchase orders and Catalog routes using `02-purchase-orders.png`, `03-purchase-order-editor.png`, `04-purchase-order-details.png`, and `05-catalog.png`. Used the shared dialog and table-state references for catalog editing, loading, empty, filtered, and error views.
- Added product, supplier, and customer creation and editing. Added order search, status and date filters, pagination, details, draft editing, confirmation, and cancellation. New orders require a verified warehouse. The editor keeps the draft after an error and lets the user check recent orders before retrying an ambiguous create.
- `pnpm --dir apps/office-web build` passed. The running Vite order route and proxied readiness endpoint returned HTTP 200. The protected live order endpoint returned HTTP 401 without a session.
- In headless Chrome with synthetic data, verified pagination, filters, create and edit for all three catalog types, local and server-side field errors, recovery after an ambiguous create, order reload and editing, confirm and cancel, and the mock receiving queue. Verified Arabic RTL and Simplified Chinese, and checked the desktop mockup layouts and narrow editor and catalog views. Focused checks confirmed half-up decimal rounding, Arabic numeral input, quantity limits, and preservation of existing line metadata.
- Still open: verify with an authorized Jahez account against the running API and confirm the same order is visible to an assigned worker on Worker Mobile. Complete those checks before marking Step 2 verified.

## Step 3 — Live receiving and stock dashboard

**Current verification:** Implemented and synthetically verified for the cleanup below. Receipt-list/history and historical dashboard comparisons require server contracts; live Worker Mobile receiving verification remains pending.

### 2026-11-28 — Independent resources, filters, and Inventory alignment

- Split queue, findings, balances, stock age, and movements into independently keyed queries. Dashboard cards/panels and the selected Inventory/Receiving view show their own loading/error states. Receiving does not request stock/age/movements, and an age or findings failure no longer hides unrelated records.
- Moved queue/finding tables to Receiving, and split Inventory page and StockTable into stock-owned files. Receiving queue and discrepancy searches are independent; discrepancy search includes translated types and available IDs/notes. Receiving, findings, and Inventory show no-results states with reset actions when filtered out.
- Movement counts come from deduplicated loaded pages, remain stable across tabs, omit unloaded counts, and show a plus/load-more explanation while more pages exist. Dashboard history and stock lots share cursor collection with duplicate-ID protection and repeated-cursor rejection.
- Inventory now shows exact stock totals, model numbers, actual catalog photos or placeholders, and aligned numeric headers/values. Shared stock arithmetic remains unchanged.
- Build passed. Focused assertions passed cursor deduplication, repeated-cursor rejection, early stopping, exact large decimal summation and lot proportions. Synthetic Chrome checks passed queue failure isolation from dashboard balances/charts, findings failure isolation from Receiving, stock-age failure isolation from Inventory balances/movements, movement loading/deduplication/counts, independent searches/reset, live queue refresh, and no-results recovery. Desktop and 390 px EN/AR/ZH layouts passed document-overflow checks; captures were visually inspected.


### 2026-11-28 — Exact decimal stock rendering

- Added one exact decimal parser, formatter, summation, sign, and comparison helper in the stock feature. Dashboard totals and movement signs, receipt aggregation and chart summaries, and inventory carton/unit values now handle decimal strings without `BigInt` conversion crashes or `Number` precision loss. Malformed values render an em dash, and invalid or above-safe-range chart data retains the existing unavailable state.
- `pnpm --dir apps/office-web typecheck` and `pnpm --dir apps/office-web build` passed. Focused assertions passed for `1.5000 + 2.25 + 9007199254740993.125 = 9007199254740996.875`, exact large-value formatting, positive/negative/zero signs, exact comparison, and invalid-input handling.
- Synthetic Chrome checks passed for dashboard total `3.75`, receipt total `3.75`, prior total `4.5`, movement signs `+2.5`, `-1.25`, and `+1.25`, inventory cartons `1.5` and `2.25`, and units `9,007,199,254,740,996.875` and `-0.125`. Desktop 1440 px, narrow 390 px, and Arabic RTL views had no page overflow. Screenshots were inspected against `06-dashboard-overview.png`, `07-receiving.png`, and `09-inventory.png`.
- This decimal rendering fix is verified. Receipt history, historical summary-card comparisons, and live Worker Mobile receiving verification remain open.

### 2026-11-28 — Receiving filter alignment

- Corrected the shared toolbar date input width so the All orders status control and date field stay side by side instead of splitting into two rows. Retained the glass styling and existing filtering.
- Office Web build passed. Synthetic Chrome checks confirmed equal control top positions at 1440 px and 390 px, including Arabic RTL. Status selection, date filtering, and clearing passed. Inspected the desktop screenshot against `07-receiving.png`. No server or mobile changes. Next: continue the remaining Step 3 integration checks.

### 2026-11-28 — Glass dashboard and stock controls

- Dashboard cards and panels inherit the shared frosted surface. Receiving status and inventory shipping mark, supplier, and brand filters use the shared custom dropdown.
- Build and synthetic receiving status/inventory dropdown checks passed. Reviewed the dashboard glass finish and Arabic narrow-layout dropdown screenshot. Server and Worker Mobile were unchanged. Existing receipt history and live integration gaps remain.

### 2026-11-27 — Overview design correction

- Rebuilt the overview from `06-dashboard-overview.png` with four icon cards, two chart panels, compact expected deliveries and attention sections, and a four-column recent activity table. Overview links select the relevant receiving or inventory tab.
- Charts read movement pages through the complete comparison period and group receipts by ledger posting date. Weekday counts deduplicate receipt IDs. Historical summary-card comparisons remain unavailable in the current API and are labeled accordingly.
- The production build passed. Browser screenshots verified both chart panels and compact sections at 1440 × 1157, plus 390 px English and Arabic RTL layouts. Focused data checks passed for current/prior periods, receipt deduplication, date boundaries, and values above chart numeric precision.

### 2026-11-27 — Receiving, inventory, and live dashboard

- Implemented current dashboard counts, expected deliveries, open findings, receiving search and date/status filters, and inventory balances, movement pages, and stock age. Reviewed the dashboard, receiving, and inventory references. Reused shared tables and state controls with translated labels.
- Added warehouse-scoped Socket.IO subscriptions with refreshed credentials, REST refresh after events and subscription, reconnect recovery, and periodic refresh. Exact stock integer strings are formatted through BigInt.
- The Office Web production build passed. A headless Chrome fixture verified exact stock counts above JavaScript's safe integer range, dashboard and receiving views, inventory tabs, cursor loading, Arabic RTL, and a narrow viewport. A synthetic receipt event updated stock, and a transport interruption recovered changed stock after reconnect.
- Remaining gaps are the API for receipt history and historical dashboard comparisons, plus an end-to-end partial receipt from Worker Mobile against the live Jahez account. Receipt detail evidence and finding resolution remain in Step 4. Step 3 is partially verified.

- 2026-11-27: Installed `socket.io-client` 4.8.4. A synthetic smoke check confirmed client initialization with the connection disabled. Live events and reconnect still need end-to-end verification.
- 2026-11-27: Installed `recharts` 3.11.1 and its `react-is` 19.3.1 peer, matching React 19.3.1. Verified a chart bar rendered in the browser fixture. Dashboard chart design and data integration remain pending.

## Step 4 — Findings, evidence, and dispatch views

**Current verification:** Implemented and synthetically verified for Office Web. Live-account mutation checks, real Socket.IO/Worker Mobile handoff, and native print-preview remain pending. Headless print rendering is verified below.

### 2026-11-28 — Receipt design alignment and dialog regression

- Receipt details now follows the reference two-column layout with details/items/findings on the main side and receipt summary/photo evidence alongside, collapsing into one column on narrow screens. Preserved exact comparisons, partial/unmatched lines, and all measurements. Added the existing finding review dialog entry point and evidence captions.
- Preserved private file access, evidence object-URL cleanup, finding resolution, and group/lot adjustment retry behavior while migrating to shared scope keys. Exact quantities remain intact. Fixed narrow adjustment summary wrapping for very large values and added a stable stock-row focus target when background refresh replaces the opener button; nested evidence dialogs still return focus to their parent.
- Synthetic Chrome checks passed authenticated evidence loading, nested photo viewing/Escape/focus, required-note finding resolution, adjustment upload and same-payload retry with one upload and identical operation/payload IDs, and receipt-lot decrease arithmetic (`-2` cartons / `-48` units / `-0.001868` m³ without group dimensions). Catalog create/edit and Dispatch search/reset/reversed-date filtering passed after the refactor.
- Final build passed. EN/AR/ZH receipt desktop and receiving/inventory/receipt/dispatch 390 px captures were checked. Narrow adjustment dialogs in all three languages had no horizontal overflow and restored focus on Escape. Headless A4 landscape dispatch PDF rendering passed with header/navigation hidden; the rendered output was inspected. Native print-preview and physical printing were not exercised.
- Known server constraints remain: no complete receipt-list/history endpoint, no adjustment detail/evidence history endpoint, no receipt-line identifier on stock-age rows, and only the latest 200 dispatch records without server date pagination. Dispatch Excel remains Step 6. Next: continue Step 5 once its remaining settings references/contracts are confirmed; track live integration separately.


### 2026-11-28 — Dialog design conformance fix

- Fixed the user-reported visual deviations of the stock-adjustment dialog against `reference-dialog.png` and `reference-dropdown.png`. The dialog overlay is now a light blurred lavender veil (`rgb(244 241 255 / 60%)` with 6 px backdrop blur) behind a near-white `--glass-floating` panel for every `OfficeDialog` consumer, replacing the dark scrim that showed through the translucent body.
- Removed the stray native fieldset border around the adjustment form body (`.fields` border/margin reset), keeping the disabled-fieldset busy protection.
- Replaced the native select arrow with the reference thin muted chevron: `appearance: none` plus a token-colored SVG layered over the glass input gradient, RTL-aware placement (right 12 px LTR, left 12 px RTL), and 40 px reserved inline-end padding. Native option list, keyboard behavior, and values are unchanged.
- Rebuilt the adjustment photo field as the reference dashed glass dropzone with an upload icon, brand-colored "Choose a file", and muted "or drag it here" (trilingual copy added). The file input is visually hidden but focusable; drag-over highlights the zone; drops reuse the existing 15 MB and image-type validation; the selected-photo preview renders below. Removed the native "Choose File / No file chosen" chrome and the duplicated hint.
- Verification: `pnpm --dir apps/office-web build` (typecheck + Vite) passed before and after removing the temporary fixture. Synthetic Chrome checks on a stubbed-fetch fixture page passed: computed styles confirmed `appearance: none` with one chevron layer, zero fieldset border, light veil, and floating panel; file selection showed the preview; drag-over set the highlight; a dropped `.txt` file showed "Choose a JPG, PNG, WebP, HEIC, or HEIF photo." with `aria-invalid` and cleared the preview; a dropped PNG restored the preview and cleared the error; real Tab focus drew the 2 px brand outline (3 px offset) on the dropzone; a synthetic submission (lot RCPT-000101, 2 cartons) closed the dialog. Arabic RTL rendered `dir="rtl"` with the chevron at left 12 px and Arabic dropzone copy; the emulated 390 × 844 mobile viewport showed no document or dialog horizontal overflow. Console reported no errors or warnings. Temporary fixture files and the dev server were removed; no production records or private invoices were used.
- Remaining gaps are unchanged from the Step 4 entry below; live-account and Worker Mobile integration checks remain separate.

### 2026-11-28 — Finding resolution, receipt details, dispatch, and stock adjustments

- Reviewed the repository workflow, Office Web structure, Backend Integration Guide, and the receiving, receipt-detail, inventory, dispatch-history, and dispatch-detail mockups. Confirmed the finding review dialog and advanced lot-aware adjustment form before implementation. Server and Worker Mobile were not changed.
- Extended the shared authenticated request/session layer for multipart uploads and private blob downloads while retaining serialized refresh, one-401 retry, abort support, and structured HTTP 409 shortage details. Added focused receiving, file, dispatch, and adjustment APIs with account/warehouse-scoped query keys.
- Added open/resolved/all discrepancy filtering, receipt navigation, a required-note finding review dialog, and authenticated receipt/line photo evidence with image viewing, attachment download, loading/error/empty states, and object-URL cleanup.
- Added `/receipts/:receiptId` with receipt/order/catalog context, exact ordered-versus-received comparison, partial and unmatched lines, findings, and evidence. Synthetic totals were 12 ordered cartons, 11.25 received cartons, and one open discrepancy; comparison rows included 8 versus 7.5, 4 versus 3, and an unmatched 0.75-carton line.
- Added dispatch history with search, customer and inclusive local-date filters, eight-row pagination, the latest-200 limitation, and dispatch detail with packing lines, source-receipt allocations, exact totals, and an A4 landscape print layout. Synthetic checks covered pages 1–2 of nine records, search/no-results recovery, date and customer filters, 3 cartons / 270 units / 0.100 m³ / 9.75 kg totals, source allocations, print invocation, and internal table scrolling at narrow width.
- Added the confirmed stock-adjustment dialog with existing-group and optional receipt-lot selection, Increase/Decrease, required positive integer cartons, optional signed units/CBM, required reason and photo, optional note, exact lot-derived quantities, and recoverable edits. Same-payload retries retain the upload and client-operation IDs; changed payloads rotate the operation ID without re-uploading. Lot submissions omit explicit group dimensions and lock unit/CBM inputs.
- Synthetic adjustment checks passed required-field errors and first-field focus, upload-failure recovery, stable upload retry, successful `photoFileId` submission, decrease values (`-2` cartons / `-200` units / `-0.05` m³), structured available/requested/shortage conflicts, replay-safe operation retry, changed-payload ID rotation, lot selection, and updated movement history. Movement rows show exact decimal balances, adjustment number/reason, and receipt/dispatch links.
- Completed the final-review remediation: lot dimensions use original receipt totals and exact proportional arithmetic; null customer/supplier/brand/product dimensions remain isolated; wrong-product receipt lines remain unmatched under their actual product; receipt carton size, volume, and weight show ordered-versus-received values; Arabic-Indic/Persian digits and the Arabic decimal separator submit as normalized numbers. The shared request layer now infers `POST` for JSON and multipart bodies while preserving explicit methods.
- Final synthetic retry checks passed: an original 8-carton / 9,600-unit / 0.3 m³ lot adjusted by 2 cartons submitted `-2` / `-2400` / `-0.075`; a timeout kept the dialog open with Close, Cancel, and fields disabled, and retry reused the identical payload and operation ID with one upload before succeeding. Entering `٢`, `٣٠٠`, and `٠٫١٢٥` submitted `2`, `300`, and `0.125`. A failed resolved-findings request showed an isolated retry state without hiding open findings.
- `pnpm --dir apps/office-web typecheck` and `pnpm --dir apps/office-web build` passed after the final source fixes. Isolated synthetic Chrome checks passed English, Arabic RTL, and Simplified Chinese receipt views; Arabic inventory and adjustment-dialog checks passed at the available 500 × 647 viewport with no document or dialog horizontal overflow. The receipt table scrolled internally, and the adjustment dialog stayed within the viewport with internal scrolling to all fields and actions. Final console checks reported no errors or warnings. No production records or private invoices were used.
- Remaining contract gaps are documented in the plan: no receipt-list endpoint, no adjustment-list/detail endpoint or adjustment note/photo in movement history, no `receiptLineId` on stock-age rows, and a 200-record dispatch cap without server date filtering/pagination. Dispatch Excel export remains Step 6. Live-account, live Socket.IO event, real browser print-preview, and end-to-end Worker Mobile verification remain separate integration checks.
- Step 4 is verified for Office Web. Next: proceed to Office Web Step 5 after confirming its remaining settings layouts and contracts; keep live-account and Worker Mobile integration checks separate.

## Step 5 — Expenses and owner settings

### 2026-11-28 — Approved Users/access and Receiving tolerances implemented

- The user approved references 17–19 and their state/mobile variants. Marked both owning plans In progress before application changes, retained the approved glass surfaces, transparent language selector and icon-only profile. Updated the design index/review to record approval. No packages were added.
- Added owner-only Settings tabs backed by tenant/user-scoped queries: directory search/role/status filters, 50-user cursor pages, shared eight-row loaded-record pagination/Load more, and reusable glass create/edit/password/status dialogs. Warehouse options fail independently of readable user rows. All text and validation support English, Arabic RTL and Simplified Chinese.
- User edits preserve drafts after errors and require explicit Reload latest on stale versions. Added a scoped user-detail read for that action. Role/access/password/status changes revoke affected sessions; successful self-affecting revocation clears local auth. Identity-only self-edits refresh the account through the existing session manager. Disable/reactivate preserve history, and the UI explains session and password behavior. Dialogs return focus to the current matching action even when table refresh replaces its original node.
- Added receiving-tolerance form/current values/examples, localized decimal normalization, 0–100/two-decimal validation, atomic versioned save, discard, failure/retry and saved states. Saved settings affect subsequent receipt processing, including later offline sync; historical findings remain unchanged.
- Used fixed **650px user cards** and **460px tolerance cards** on desktop, with internal scrolling and automatic heights on narrow screens. Reviewed rendered 1440×1000 desktop and 390×844 EN/AR/Chinese panels/dialogs against the approved references; checked document/dialog containment and Tab/Escape/focus return.
- Verification passed: `pnpm --dir apps/office-web build`, server typecheck/build, the checked-in disposable server regression (actual Nest HTTP/guards, RLS, two tenants, owner concurrency, session/token/reset/status behavior and receipt comparisons), and isolated Chrome user create/edit/conflict/reload/reset/disable/reactivate, 50-user cursor/search, self-sign-out, trader direct-link denial, localized percentages, invalid values, save failure/retry/conflict, warehouse-option failure isolation, and fixed heights. Browser captures/check harness are under `/private/tmp/jahez-core-settings-check/`; all API data was synthetic. Existing Expenses/category/session/evidence/retry/live-fixture and three-language narrow regressions also passed.
- **Status: implemented and synthetically verified; live integration pending.** Migration 0012 was not applied to the application database, and no live account, mobile app or deployment was changed. Before live use, apply the forward migration and run the updated server. Real owner/trader workflows, real permission-change/Socket.IO delivery, private storage and previous-mobile verification remain open. Warehouse creation, audit browsing and expense enhancements remain deferred. Next: authorized live integration checks, then Office Web Step 6.


### 2026-11-28 — Core settings mockup-review checkpoint

- Saved the confirmed core-settings implementation plan under Office Web Step 5 and Server Step 2: owner user creation/editing, role/warehouse assignment, initial/reset passwords (12–128 characters), disable/reactivate, last-owner/self-disable protection, and receiving-tolerance management. The user explicitly requested reviewable mockups before coding.
- Inspected the approved Settings, dialog, and dropdown references. Prepared draft references `17-settings-users-access.png`, `18-settings-user-dialogs.png`, and `19-settings-receiving-tolerances.png`, state examples, source HTML/CSS/JS, and narrow English/Arabic/Chinese variants. All records are synthetic. The prototype has no API connections and does not change accounts/settings.
- Rendered 12 PNGs in isolated Chrome, visually inspected the principal pages/dialog board and narrow Arabic/Chinese previews, and verified desktop/narrow document overflow, Arabic direction, narrow dialog containment, and prototype Escape/focus return. JavaScript syntax and staged-diff checks passed. Application/server builds were not applicable to this documentation/design-only update.
- User approval is pending. No application code, server code, database migration, live data, mobile app, or deployment was changed. Next: review the draft designs with the user, then begin the saved server/client implementation only after approval. Existing Step 5 implementation/live-verification status below remains unchanged.


**Current verification:** Expenses, Account/session settings, category management, Users/access and Receiving tolerances are implemented and synthetically verified. Step 5 remains partially verified until the remaining live owner/trader and permission-change checks pass. The earlier mockup checkpoint below is historical and has been approved.

### 2026-11-28 — Expenses, account sessions, and expense categories

- Read AGENTS.md, project context, the integration contracts and server implementations. Inspected `12-expenses.png`, `13-settings.png`, and `reference-dialog.png` before coding. Saved the numbered Step 5 plan first. The user explicitly approved reusing the catalog table/glass dialog pattern for category management.
- Added Expenses navigation and a warehouse-scoped history table with search, category/customer/inclusive-date filters, date sorting, eight-row pagination, invoice/exception viewing, and the actual latest-200-record limitation. Filtered data remains memoized for stable pagination. Export is deferred to Step 6.
- Built the glass Record expense dialog with amount/currency/date/category, optional customer/order, invoice upload or a required exception note, local validation/focus, translated server errors, and recoverable entries. Amount normalization accepts Arabic/Persian digits with up to two decimals. Upload retries retain the upload ID; save retries retain the operation ID and exact payload. An ambiguous POST locks edits/close until retry reconciles the same operation, avoiding duplicate expenses.
- Reused the authenticated files service and extracted a private attachment dialog shared by expense invoices and receipt evidence, with object-URL cleanup, image display, download fallback for documents/unrenderable images, and supported filename extensions. Nested receipt evidence retains focus restoration. No private invoice was used or transferred.
- Built Settings Account from the reference: current user/role/language, active own sessions, current-session marker, remote-session revocation, and local authentication clearing after current-session revocation. Added owner-only category creation/editing and reversible activation, including Chinese names and conflict recovery. Traders can read categories for expense entry but see no category-management tab or mutation controls.
- Extended scoped live refresh/reconnect invalidation with `expense.recorded`. Reused the shared warehouse scope, order/catalog reads, request/session layer, labeled controls, date filters, tables, states, glass tokens, fonts, and trilingual copy. No packages, Server, Worker Mobile, migrations, exports, extraction, or deployment were changed.
- `pnpm --dir apps/office-web build` passed (TypeScript + Vite). Focused assertions passed positive amount bounds, rejection of zero/negative/excess-precision/scientific notation, Arabic/Persian decimal normalization, and leap/calendar-date validation.
- Isolated synthetic Chrome checks passed expense pagination/search/reset, category/customer/date filtering, reversed-range protection, private invoice viewing, exception viewing, invalid-field focus, invoice upload failure/retry with one unchanged upload ID, and an ambiguous already-committed expense replay with identical payload/operation ID and only one saved expense. Arabic `٤٨٠٫٥٠` submitted `480.50`; exception entry submitted only `noInvoiceNote` without an upload. Invalid dropped text files were rejected before upload.
- Synthetic owner category create/edit/conflict recovery/deactivate/reactivate checks passed; reactivated categories appeared in the expense form after cache invalidation. Other-session and current-session revocation, trader direct-link gating, and scoped `expense.recorded` refresh passed. The shared attachment viewer passed nested receipt-photo opening/download/Escape/focus regression checks.
- Reviewed desktop expense/settings/category/dialog captures against the references and approved reuse pattern. English, Arabic RTL, and Simplified Chinese expense/settings pages and entry dialogs passed 390 × 844 overflow checks; currency chevron alignment was corrected for RTL. Read-only running `/expenses`, `/settings`, and proxied `/api/v1/health/ready` checks returned HTTP 200; those reachability checks do not constitute live-account workflow verification.
- Remaining: users/access, receiving-tolerance management, warehouse administration, and audit log need their missing settings designs and API support (warehouse rename alone is insufficient for full administration). Expense history has no server date pagination beyond 200 rows, and expenses have no edit/delete API. The sessions endpoint lists only the signed-in user's sessions. Verify real owner/trader accounts, private storage, real session revocation/permission changes, and live expense delivery separately. Next: confirm the remaining settings references/contracts before marking the whole step complete.

## Step 6 — Reports and Excel downloads

**2026-11-28 — Office Web implemented and synthetically verified.**

- Reviewed the reports, expenses, purchase-order detail, dropdown, dialog and table references. Saved the numbered plan before editing the app. Enabled the warehouse-scoped Reports & exports route with the glass report builder and bounded desktop history card. The layout stacks at narrow widths and keeps table scrolling inside the card.
- Connected all seven report kinds to the existing server contracts. The builder shows applicable filters and validates reversed dates and required purchase orders. Orders, receiving, inventory, dispatch and expenses have shortcuts to the builder with applicable selections. Receiving expected dates, inventory display-name filters, and list search, category, brand and status filters remain local.
- Added current-warehouse history, status filtering, polling while jobs are active, manual refresh, failed-job feedback and private XLSX downloads. The UI refreshes history after a failed submission so staff can check for an existing job before retrying.
- Office Web build passed. An isolated Chrome fixture passed all seven request payloads, reversed date and required order checks, queued → processing → ready polling, failed submissions and error dialog, history and download retries, authenticated download of a synthetic XLSX, the purchase-order shortcut, trader access and denied warehouse behavior. Reviewed 1440 px desktop and 390 px English, Arabic RTL and Simplified Chinese layouts. Fixed document overflow found on the first narrow run and reran successfully.
- Live account, background worker and storage checks remain pending. The current trilingual purchase-order workbook contains product photo URLs. Embedded photos and exact workbook template parity require a Server Step 9 follow-up. In this step, only Office Web and documentation changed.

## Step 7 — Invoice import and review

**2026-11-28 — Office Web implemented and synthetically verified.**

- Read AGENTS.md, the integration guide and the import service before implementation. Reviewed `15-invoice-imports.png` and `16-invoice-review.png`, and saved the full Step 7 plan. Added the protected import history and review routes, glass surfaces, a fixed desktop history card, a bounded source preview and stacked narrow layouts.
- Connected purchase and expense uploads to the existing private files and extraction APIs. Reused the invoice picker and private blob handling across Expenses and Imports. Retries preserve the file upload ID and check history by source-file ID before repeating an uncertain enqueue. History supports filename search, type/status filtering, active job polling and links to committed records.
- Added side-by-side original and review panels, image and read-only XLSX previews, and authenticated original downloads. ExcelJS is loaded only for XLSX preview and adds a 929 kB minified chunk (256 kB gzip). Other document formats use original download. The spreadsheet view shows up to 10 sheets, 50 rows and 16 columns per sheet.
- Implemented explicit review or correction of low-confidence fields, catalog matches, selective draft saves and server-authorized commits. Reused exact purchase-order arithmetic to derive amounts and totals, including when source totals differ. Purchase imports create draft orders. Expense imports open the committed row in Expenses. Both support manual fallback.
- Office Web build passed. Isolated Chrome exercised upload failure and the same upload ID on retry, an ambiguous enqueue that yielded one import, queued-to-draft polling, authenticated XLSX preview and byte-matched download, missing match and confidence gates, Arabic digit correction, review failure with retained edits, derived totals, both commit paths, filename search, failed extraction retry, manual expense fallback and denied warehouse access. Reviewed 1440 px desktop and 390 px EN/AR/ZH views. The existing synthetic Expenses/category/session regression passed after shared file-control changes.
- Live provider accuracy, worker and storage integration remain pending. Direct searchable-PDF extraction and concurrent-review version handling are server follow-ups. No server or mobile code changed. Next roadmap step is Step 8 regional pilot verification.

- Review header follow-up: replaced the boxed Invoice imports button with the shared back link above the title to match `16-invoice-review.png`. Office Web build and isolated Chrome checks passed for desktop placement, narrow Arabic RTL, and navigation back to history.

- Import history follow-up: changed queued and processing “View status” actions to secondary text links with directional chevrons. Office Web build and isolated Chrome checks passed for desktop and narrow Arabic RTL, with navigation to the import detail.

[Office web plan](../../plan/office-web/PLAN.md)
