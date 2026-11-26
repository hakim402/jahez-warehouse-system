# Worker Mobile Implementation Roadmap

Start with a worker opening an assigned order, confirming a receipt offline, and syncing it once the device reconnects. Pilot on Android tablets and verify the same workflows on small Android phones, iPhones, and tablets. Use the [Server Roadmap](../server/ROADMAP.md) for API dependencies and the [Office Web Roadmap](../office-web/ROADMAP.md) for the order and stock handoff.

Follow the [agent guide](../../../AGENTS.md), [warehouse requirements](../../Requirments%20/REQUIREMENTS.md), [Worker Mobile layout](../../tech-stack/PROJECT-STRUCTURE.md#worker-mobile), and [Jahez brand kit](../../context/PROJECT-CONTEXT.md#brand-kit).

## How the agent should work

Follow the [repository workflow](../../../AGENTS.md#workflow-for-every-step). Keep the requested step number in [Worker Mobile Plan](PLAN.md) and [Worker Mobile Progress](../../progress/worker-mobile/PROGRESS.md). Record affected screens, local database and queue changes, server dependencies, and device checks in the plan before editing application code.

Keep screen state and widgets beside their screens. Use the shared Dart API client and keep connection, storage, and retry logic in the repository and offline layers. Run the relevant device checks alongside Flutter analysis.

## First workflow

### 1. App shell, regional API, and worker session

- Set up navigation and the regional API client using `API_BASE_URL`. Add worker sign-in, refresh, secure session storage, shared-device sign-out after idle time, and server revocation handling. Use the agreed PIN or worker-code flow on shared devices and keep warehouse context tied to the signed-in worker.
- Apply the brand kit, large controls, and Arabic RTL, English, and Simplified Chinese. Keep one job per screen on small phones and use the extra space on tablets for the queue and order details.
- **Depends on.** Server steps 1–2 for connectivity, authentication, and warehouse membership.
- **Verify.** Sign in, handle an expired or revoked session, switch workers on a shared device, and check navigation on a small phone and a tablet.

### 2. Offline order queue and receipt drafts

- Use Drift and SQLite for assigned orders and receipt drafts. Scope local data to the authenticated worker and warehouse, with no price or cost fields. Save stable draft IDs and draft edits across app restarts.
- Implement the local data purge on sign-out. Plan how to surface pending work before a purge and isolate each worker's data on a shared device.
- **Depends on.** Server steps 2–3 for worker-safe order data and the receiving queue.
- **Verify.** Cache a test order, go offline, edit a draft, and restart the app. Confirm that the draft survives the restart and that signing out clears private data before another worker signs in.

### 3. Three-step receiving

- Let the worker pick a prefilled order, check cartons and measurements, then review discrepancies and confirm. Use numeric corrections, calculate a CBM preview from dimensions and cartons, and let workers go back before confirmation.
- Support partial deliveries and damage flags. Make the confirmation summary show expected and received quantities and save the confirmed receipt locally when offline.
- **Depends on.** Server steps 3–4 for the order, receipt, and comparison contracts.
- **Verify.** Complete a partial receipt offline, go back to correct a quantity, and check that the saved summary and measurements survive an app restart.

### 4. Receipt sync and reconnect

- Persist confirmed receipts in an outbox with stable client operation IDs. Push and pull on reconnect, use the server cursor, and keep temporary receipt numbers until the server returns final numbers.
- Show pending, synced, and failed states with an actionable retry. Preserve the original worker and apply server conflict results so local measurements and office edits are reconciled consistently.
- **Depends on.** Server steps 4–5 for receipt sync, stock posting, and catch-up. Use an order created in Office Web step 2 for the end-to-end check.
- **Verify.** Sync a receipt after reconnecting, simulate a lost response, then retry the same operation. Check that one receipt number and one stock movement appear in Office Web and that pending work survives a restart.

## Complete the pilot

### 5. Photo evidence and upload retries

- Capture and compress receipt, line, piece, and damage photos. Save them locally with their receipt references and track required evidence where the workflow calls for it.
- Use a separate persistent queue for uploads and attachment linking. Show photo progress and retry independently of receipt status. Use the authorized file API across storage providers.
- **Depends on.** Server step 6 for private upload and attachment routes.
- **Verify.** Capture photos offline, restart, and sync the receipt. Interrupt a photo upload, then retry and confirm the photo appears once on the correct receipt and line in Office Web.

### 6. Dispatch

- Let the worker pick a customer mark and select cartons from available stock. Allow offline preparation and require a fresh server confirmation online. Show shortages and refresh the selection after stock changes.
- **Depends on.** Server steps 5 and 7 for stock and dispatch confirmation.
- **Verify.** Prepare a dispatch offline, reconnect, and confirm it. Repeat with stock changed by another worker and check that the shortage is shown without an invalid movement.

### 7. Receiving without an existing order

- Capture a delivery-note photo when no matching order exists. Save it offline when needed and send it for server extraction when connected. Show the review status and resume receiving when the trader confirms the resulting order.
- **Depends on.** Server steps 6, 9, and 10 for files, jobs, and extraction, and Office Web step 7 for trader review.
- **Verify.** Capture a note offline, send it after reconnecting, and complete receiving against the trader-confirmed order. Check the retry path if extraction fails.

### 8. Device and regional pilot verification

- Test release builds on Android and iOS, including a small phone and a shared tablet. Cover language switching, camera permissions, sign-out cleanup, database upgrades with queued work, and reconnect after app restart. Check distribution readiness for Google Play, the App Store, and the direct Android install fallback.
- **Depends on.** Server step 11 for regional staging and previous-version API compatibility.
- **Verify.** Run sign-in, offline receiving, photo retry, and dispatch on warehouse Wi-Fi and mainland mobile data in Yiwu without a VPN. Record device and build results before pilot distribution.
