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

## Step 2 — Catalog and manual purchase orders

- 2026-11-27: Installed `@tanstack/react-query` 5.108.4. A synthetic smoke check confirmed separate cache keys for two warehouses. Catalog and order integration remain pending.

## Step 3 — Live receiving and stock dashboard

- 2026-11-27: Installed `socket.io-client` 4.8.4. A synthetic smoke check confirmed client initialization with the connection disabled. Live events and reconnect still need end-to-end verification.

[Office web plan](../../plan/office-web/PLAN.md)
