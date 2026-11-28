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

## Dependencies and verification

Use the order and sync contracts in the [server plan](../server/PLAN.md). Verify that a draft survives an offline app restart, a receipt syncs once after reconnecting, and a failed photo upload can retry separately.

[Worker mobile progress](../../progress/worker-mobile/PROGRESS.md)
