# Office Web Plan

## First milestone

Enable office staff to create a manual supplier order and see stock change when a worker's receipt syncs.

1. Wire the API base URL and authenticated API client.
2. Build manual order entry and show the saved order on the office web.
3. Show receipt status and refresh stock when the server publishes a committed update.

## Step 1 — App shell, API connection, and sign-in

### Dependency setup

Dependency setup is verified.

1. Add `react-router` 7 for app routing on the current Node.js 22.16 runtime and `i18next` with `react-i18next` for English, Arabic, and Simplified Chinese.
2. Add the Step 2 and Step 3 dependencies below in the same Office Web package update. Update the manifest and pnpm lockfile together.
3. Verify a frozen install, confirm the installed versions, and build the Office Web starter.

Sign-in integration uses the existing auth API. Step 1 feature work still needs a sign-in design review, an app shell reference, and an API for discovering assigned warehouses.

## Step 2 — Catalog and manual purchase orders

Add `@tanstack/react-query` for catalog and order reads, mutations, and cache invalidation. Integration uses the documented catalog and order endpoints.

## Step 3 — Live receiving and stock dashboard

Add `socket.io-client` in the server's 4.8 range for authenticated warehouse events. The live dashboard depends on the server's Socket.IO endpoint and the receiving and stock REST contracts.

## Dependencies and verification

Use the order, stock, and live update contracts in the [server plan](../server/PLAN.md). Verify with a synthetic order that an authorized user can save it and see stock update after receipt sync.

[Office web progress](../../progress/office-web/PROGRESS.md)
