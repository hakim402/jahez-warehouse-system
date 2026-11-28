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

[Worker mobile plan](../../plan/worker-mobile/PLAN.md)
