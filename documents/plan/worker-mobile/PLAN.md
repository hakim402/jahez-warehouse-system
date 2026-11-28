# Worker Mobile Plan

## First milestone

Let a worker record a receipt offline and sync it when the device reconnects.

1. Wire the API base URL and authenticated API client.
2. Store assigned orders and receipt drafts locally with Drift. Queue photos separately from receipt submission.
3. Sync receipts with stable operation IDs and display pending, synced, and failed states.

## Step 1 — App shell, regional API, and worker session

**Verified for iOS.** iPhone launch and iPad live sign-in, navigation, and session restoration passed. Android verification moves to the final device pilot in Step 8.

Build the iOS and Android shell so an assigned worker can sign in, resume a valid session, and sign out on a shared device.

1. Configure `API_BASE_URL` for the live Jahez API. Support deployment-provided `WAREHOUSE_ID` and optional `TENANT_ID`. Use `/auth/login`, `/auth/refresh`, `/auth/logout`, and `/warehouses/:id` through a shared client. Check the worker role and resolve the assigned warehouse through the server before opening the shell.
2. Use platform secure storage for a stable installation ID and one session record. Serialize rotating token refresh, retry protected requests once, and handle revoked sessions. End shared-device sessions after 15 minutes of inactivity, including time away from the app. Clear local session state on sign-out and revoke the server session when reachable.
3. Build the sign-in, home, settings, and session recovery screens in `apps/worker-mobile/lib/app` and feature folders. Use `01-sign-in.png`, `02-home.png`, `08-settings-and-session.png`, and `13-session-recovery-and-sign-out.png`. Reuse Jahez artwork and tokens. Support English, Arabic RTL, and Simplified Chinese with a remembered language choice and responsive layouts. Later workflows will use the shell navigation as their steps are built.
4. Run Flutter analysis and focused checks for sign-in, warehouse access, session recovery, revocation, idle sign-out, and worker switching. Exercise the shell on iPhone and iPad. Verify live API readiness and authenticate with a dedicated test worker assigned to Yiwu Warehouse.

**Dependencies**

Server Steps 1–2 provide phone/password sign-in and reads of known assigned warehouses. A PIN or worker-code flow and automatic warehouse selection need server support. Receiving, stock, dispatch, activity, and pending-work data belong to later steps.

**Build configuration**

`flutter run -d <device-id>` from `apps/worker-mobile` uses the live international API and the Yiwu warehouse published by Office Web. For another HTTPS deployment, pass public settings with `--dart-define-from-file=.env` using the app’s environment example. A live worker account must already have membership in the configured warehouse.

## Step 2 — Offline order queue and receipt drafts

**Verified for iOS.** The authenticated Yiwu queue, carton editing during a simulated outage, and offline draft recovery passed on iPhone and iPad simulators. Automated checks confirmed sign-out cleanup. Android device verification stays in Step 8.

1. Fetch the worker-safe `GET /orders/awaiting?warehouseId=…` response through the existing authenticated API client. Deserialize only the queue and receipt fields the worker needs. Use the signed-in tenant, worker, and server-verified warehouse to scope storage and requests.
2. In `apps/worker-mobile/lib/offline`, add Drift tables and the initial SQLite schema for cached orders and local receipt drafts. Replace the cached queue only after a successful, valid response. Give each draft a stable UUID, preserve local edits and the order snapshot across offline restarts, and retain drafts when their orders leave the refreshed queue.
3. Build the receiving queue and the carton draft editor in `apps/worker-mobile/lib/features/receiving`. Use the queue and Check goods panels of `03-receiving-flow.png`, the Receiving entry from `02-home.png`, and sign-out guidance from `08-settings-and-session.png` and `13-session-recovery-and-sign-out.png`. Use one focus at a time on iPhone and show the queue alongside a selected draft where iPad width allows. Receipt confirmation and submission belong to later steps.
4. Let a worker resume a previously verified warehouse session offline within the existing 15-minute idle policy. First sign-in requires server verification. Reject a known revoked session. Surface the local draft count before explicit sign-out, and purge private queue and draft data before a different worker can use the device. Define the policy for confirmed outbox work when that feature is added.
5. Verify price and cost fields are excluded, order cache and draft IDs survive offline relaunch, failed refresh leaves existing drafts intact, and sign-out purges private data before a different account signs in. Run Flutter analysis and exercise the workflow on iPhone and iPad with synthetic data. Use the live queue only with an assigned test worker. Android verification stays in Step 8.

Server Steps 2–3 provide warehouse authorization and the receiving queue. Step 2 requires no server changes or new server migrations.

## Step 3 — Three-step receiving

**Verified for iOS.** Both simulators loaded the live Yiwu test order, corrected the receipt after review, and retained an offline-confirmed partial receipt through an app restart. Android device verification stays in Step 8.

Let a Yiwu worker select an assigned order, check each line, review the delivery, and confirm it locally during an outage.

1. Update the receiving queue and receipt screens in `apps/worker-mobile/lib/features/receiving`. Use the three stages from `03-receiving-flow.png`, the size, weight, and damage panels in `10-receiving-item-details.png`, and the locally saved state in `11-receipt-confirmation-states.png`. Keep a separate receipt screen on phones and the side-by-side layout on tablets. Localize the controls in English, Arabic, and Simplified Chinese.
2. Keep outstanding cartons prefilled and editable, including zero for a line that did not arrive. Save each line’s carton dimensions in cm, total weight in kg, and damage flag. Calculate CBM from measured dimensions and received cartons. Accept supported decimal inputs, show missing and extra cartons per line, and let workers return to the lines to correct them before confirming. The worker queue exposes expected aggregate CBM and weight, with no carton dimensions to prefill. The server owns tolerance findings and replacement-product validation.
3. Migrate the private Drift database from version 1 to 2 in `apps/worker-mobile/lib/offline`. Preserve existing carton drafts, UUIDs, and order snapshots. Confirm by atomically moving the draft into a durable receipt for the original API, tenant, worker and warehouse scope. Store its stable operation ID, confirmation time, summary snapshot, and receipt lines in the published shape. Keep a locally confirmed receipt readable from Receiving, make repeat confirmation idempotent, and require its eventual sync before starting another receipt for that order on the device. Keep confirmed receipts scoped to their original worker through sign-out and idle expiry. Continue purging cached orders and unconfirmed drafts.
4. Use `GET /orders/awaiting` against the live API for assigned orders. Validate the local record against the Server Steps 3–4 `POST /receipts/confirm` contract. Transport, reconciliation, and stock updates belong to Worker Mobile Step 4. Photo capture belongs to Step 5, and delivery-note intake belongs to Step 7. No server or Office Web changes are required.
5. Run Flutter analysis, focused UI and SQLite checks, and an iOS debug simulator build. With the live Yiwu test order on iPhone and iPad, correct cartons after review, enter measurements, flag damage, and locally confirm a partial receipt during a simulated outage. Reopen it after restarting and compare its persisted summary and measurements. Check that the version 1 draft and worker isolation are preserved. Android device verification stays in Step 8.

## Dependencies and verification

Use the order and sync contracts in the [server plan](../server/PLAN.md). Verify that a draft survives an offline app restart, a receipt syncs once after reconnecting, and a failed photo upload can retry separately.

[Worker mobile progress](../../progress/worker-mobile/PROGRESS.md)
