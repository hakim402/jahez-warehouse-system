# Office Web Progress

## 2026-11-25 — Project baseline

- Available: React and Vite starter with an environment example.
- Checked: the repository contains the app entry point. The API still needs to be connected.
- Next: wire the API base URL and authenticated client. Manual order entry depends on the server contract.

## Step 1 — App shell, API connection, and sign-in

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

## Step 2 — Catalog and manual purchase orders

- 2026-11-27: Installed `@tanstack/react-query` 5.108.4. A synthetic smoke check confirmed separate cache keys for two warehouses. Catalog and order integration remain pending.
- 2026-11-27: Installed `@tanstack/react-table` 9.3.1 and verified it rendered synthetic stock data in the browser fixture. Office Web table integration remains pending.

## Step 3 — Live receiving and stock dashboard

- 2026-11-27: Installed `socket.io-client` 4.8.4. A synthetic smoke check confirmed client initialization with the connection disabled. Live events and reconnect still need end-to-end verification.
- 2026-11-27: Installed `recharts` 3.11.1 and its `react-is` 19.3.1 peer, matching React 19.3.1. Verified a chart bar rendered in the browser fixture. Dashboard chart design and data integration remain pending.

[Office web plan](../../plan/office-web/PLAN.md)
