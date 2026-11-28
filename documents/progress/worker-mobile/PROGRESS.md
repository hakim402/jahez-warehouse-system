# Worker Mobile Progress

## 2026-11-25 — Project baseline

- Available: Flutter starter with an environment example.
- Checked: the repository contains the Flutter entry point. Offline receiving and sync still need implementation and verification.
- Next: wire the API configuration and begin local receipt storage.

## Step 1 — App shell, regional API, and worker session

### 2026-11-28

- Implemented the iOS and Android Flutter shell, sign-in, home, settings, and session recovery using the mobile references. English and Arabic use bundled Roboto and Cairo. Simplified Chinese uses the platform font. The language choice survives an app restart, and Arabic layouts use RTL.
- Configured the live Jahez API and Yiwu Warehouse. The client checks the worker role and warehouse membership using the current API. Secure storage keeps the installation ID and rotating token pair. Shared-device sessions end after 15 minutes of inactivity, including time away from the app. Explicit sign-out clears the local session and attempts server revocation.
- Flutter analysis passed. All nine synthetic Flutter checks passed using the Chrome test runner. The checks cover token rotation and concurrent verification, outages, revocation, membership denial, restart, idle sign-out, worker switching, sign-out during refresh, stalled secure storage, and localization at 320 and 820 logical pixels.
- The live readiness endpoint returned HTTP 200 with PostgreSQL up. Empty sign-in returned 400, and the configured warehouse endpoint returned 401 without a session. Authenticated live sign-in, refresh, and sign-out need a dedicated worker assigned to Yiwu Warehouse.
- Built the final iOS debug simulator app and reached sign-in on iPhone 17 running iOS 26.4. The iPad mini on iOS 26.5 did not reach sign-in, and another iPad runtime failed to boot. The app now surfaces a retry if secure storage does not respond within 12 seconds.
- The Android APK build stopped at an incomplete NDK 28.2.13676358 installation. SDK Manager and direct download attempts timed out. The original Small_Phone stayed offline in ADB. A temporary Android 35 emulator came online for the eventual APK check.
- Complete native verification and the assigned-worker live check before Step 2 for the offline order queue and receipt drafts.

### 2026-11-28 — iOS verification follow-up

- Android device and APK verification move to Step 8 at the owner’s direction. The iOS 26.4 and 26.5 runtimes are already installed.
- Confirmed that the deployed Office Web includes **Settings → Users & access → Add user**. A Jahez owner can create a Worker, assign Yiwu Warehouse (YIWU), and then enter that account directly in the mobile app. The live readiness check returned HTTP 200 and the protected user-management, warehouse-assignment, and receiving-queue routes returned HTTP 401 without a session.
- Restarted the iPad mini on iOS 26.5 and verified the final Step 1 build. It reached sign-in, then showed the authenticated Yiwu Warehouse home. Settings and the shared-device sign-out prompt worked. A fresh app process restored the live session and returned to Yiwu Warehouse. Expiry, revocation, and completed sign-out remain covered by the synthetic tests.

## Step 2 — Offline order queue and receipt drafts

### 2026-11-28

- Saved the Step 2 plan with the checked worker queue response, Drift and SQLite scope, phone and tablet mockups, draft persistence, and sign-out cleanup checks.
- The iPad check passed, and the verified Step 1 update was pushed as `d697a33`. Step 2 implementation began after that push.
- Added the localized receiving queue and carton draft editor. The phone uses a separate editor screen and iPad can show the queue and editor side by side. Orders and drafts are saved through Drift in the app’s private SQLite database. A draft keeps its original UUID and order snapshot when the order leaves the queue.
- Added offline access for a previously verified warehouse under the existing idle policy. The first sign-in still verifies membership online. Explicit sign-out reports the count of unconfirmed drafts before deleting them. Ending the session clears the order cache and drafts before another worker can use the device.
- Flutter analysis passed, and the iOS simulator build bundled SQLite successfully. A direct Dart run against a temporary SQLite file verified reopening, scope isolation, exclusion of synthetic price fields, draft UUID stability, failed queue replacement, and purge. The macOS Flutter test executable closed before loading the SQLite test.
- Nine synthetic Flutter tests passed. The 320 and 820 logical pixel layouts exercised an unavailable queue refresh, a carton edit using cached data, the draft-count sign-out prompt, and sign-out cleanup. The live iOS simulator check of the Step 2 receiving queue remains open.
- The first Step 2 iPad launch surfaced a storage startup error. Retry now rechecks startup storage without clearing a saved session, and the app reports draft database cleanup failures separately from secure session storage errors. Flutter analysis, the nine synthetic tests, and the iOS rebuild passed with this change.
- Both the iPhone 17 and iPad mini created the native SQLite database. Read-only schema checks confirmed version 1 and the cached-order and receipt-draft tables on each simulator. The live receiving workflow remains pending on both simulators.
- The iPhone 17 on iOS 26.4 signed in to Yiwu Warehouse. The live Receiving queue loaded and refreshed successfully, showing no orders waiting to be received. The iPad mini on iOS 26.5 reached the authenticated Yiwu home earlier in the session and later showed the session-ended screen. The iPad was returned to sign-in.
- After both workers signed in, each simulator loaded the confirmed Yiwu test order from the live queue. The iPhone opened a separate Check goods screen, and the iPad showed the queue and Check goods side by side. Both saved a carton draft locally. No receipt was submitted.
- A temporary simulator build failed only the app’s HTTP connections. Both simulators showed the cached-order notice, opened the order and accepted a carton edit offline. Read-only SQLite comparisons after offline relaunch confirmed that the draft UUID and carton edits survived on both devices.
- The first iPhone offline attempt showed a secure-storage retry and then an expired session. The empty order cache and draft table confirmed expiry cleanup. The offline workflow passed after a fresh sign-in. Explicit sign-out cleanup was verified with synthetic data.
- Restored the original live build on both simulators. A read-only scan found no price, cost, or other checked commercial fields in either simulator’s order or draft snapshots.
- Ready for Step 3, three-step receiving. Android device verification remains in Step 8.

## Step 3 — Three-step receiving

### 2026-11-28

- Added carton correction, line measurements, calculated CBM, damage flags, and review with per-line missing and extra counts. Applied the receiving flow, item details, and local confirmation mockups with English, Arabic, and Simplified Chinese labels.
- Added the Drift version 2 migration and a local receipt record. Confirmation preserves the draft UUID as the operation ID, records the reviewed receipt payload atomically, and keeps it readable by the original worker after session expiry. Step 4 will handle receipt submission and reconciliation.
- Flutter analysis, ten Chrome-run Flutter checks, and the iOS debug build passed. The native Flutter test executable was missing from the SDK. Both SQLite checks passed using the same tests and database code in a temporary Dart package, including version 1 migration, repeat confirmation, persistence, and worker isolation.
- Signed into the live Yiwu warehouse on iPhone 17 and iPad mini and opened the confirmed test order. The phone used a separate Check goods screen. The iPad showed it alongside the live queue and displayed the review stage.
- In the app-only outage build, both simulators showed the cached-order notice. On each, review returned to Check goods for a correction from six cartons to five. A carton measuring 60 × 45 × 9 cm produced a 0.1215 CBM preview for five cartons, and the form accepted 12.5 kg total weight and a damage flag. Review showed one missing carton before local confirmation.
- Both simulators showed the saved receipt, temporary reference, and waiting-for-sync state. After an offline process restart, SQLite checks found one confirmed receipt per simulator, no unconfirmed draft for that test, and the same operation ID, reviewed order snapshot, and measured receipt payload. Confirmation stayed local to the simulators.
- Restored the live API build and normal Xcode entry point. Reopened both receipts from Receiving and verified that the measured summaries and temporary references were still visible.
- Step 4 can now implement receipt sync and reconnect. Android device verification remains in Step 8.

[Worker mobile plan](../../plan/worker-mobile/PLAN.md)
