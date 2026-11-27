# Office Web Progress

## 2026-11-25 — Project baseline

- Available: React and Vite starter with an environment example.
- Checked: the repository contains the app entry point. The API still needs to be connected.
- Next: wire the API base URL and authenticated client. Manual order entry depends on the server contract.

## Step 1 — App shell, API connection, and sign-in

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

[Office web plan](../../plan/office-web/PLAN.md)
