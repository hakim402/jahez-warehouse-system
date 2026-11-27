# Office Web Plan

The first milestone is a Jahez trader creating a purchase order and seeing stock update after a worker's receipt syncs. The full sequence follows the [Office Web roadmap](ROADMAP.md).

Before coding a step, expand its heading here with the goal, numbered tasks, affected screens or modules, design references, API and other dependencies, and acceptance checks. Mark the step `In progress` when implementation starts.

After verification, record the date, completed work, actual check results, gaps, and next action under the matching step in [Office Web PROGRESS.md](../../progress/office-web/PROGRESS.md). Mark the plan step `Verified` once its required checks pass. Follow the [repository workflow](../../../AGENTS.md#workflow-for-every-step).

The filenames below refer to `documents/designs/office-web/`. Use `reference-dropdown.png` for menu styling, `reference-dialog.png` for dialog styling, and `reference-table-states.png` for loading, empty, no-results, and error states. Bind the mockups to the [Backend Integration Guide](../../api/BACKEND-INTEGRATION.md).

## Step 1 — App shell, API connection, and sign-in

Build Jahez sign-in, session handling, protected navigation, a shared API client, and assigned warehouse selection. Set up Jahez styling and English, Arabic RTL, and Simplified Chinese.

Use `01-sign-in.png` and `background.png` for sign-in. Use the sidebar and top bar in `06-dashboard-overview.png` for the signed-in shell. The auth endpoints are available. Assigned warehouse selection still needs an API that lists the signed-in user's warehouses.

## Step 2 — Catalog and manual purchase orders

Build supplier, customer mark, and product management. Let traders list, view, create, edit, confirm, and cancel purchase orders as their status permits.

Use `02-purchase-orders.png`, `03-purchase-order-editor.png`, `04-purchase-order-details.png`, and `05-catalog.png`. Use `catalog-products.png` as sample product imagery. Bind the screens to the orders, parties, and products APIs.

## Step 3 — Live receiving and stock dashboard

Show order progress, receipts, discrepancies, stock balances, movements, and stock age. Verify that a synced receipt updates the dashboard and that the view catches up after reconnecting.

Use `06-dashboard-overview.png`, `07-receiving.png`, `08-receipt-details.png`, and `09-inventory.png`. Confirm the source of dashboard trend metrics and the API for receipt history. The server currently exposes receipt details, stock reads, and warehouse events.

## Step 4 — Findings, evidence, and dispatch views

Show ordered and received values together, let traders resolve findings, and display private evidence. Add dispatch history, packing details, and authorized stock adjustments.

Use `08-receipt-details.png` and `09-inventory.png` for the finding and adjustment entry points, and `10-dispatch-history.png` and `11-dispatch-details.png` for dispatch. Confirm the missing form details for finding resolution and stock adjustment before building them. Use the findings, private files, dispatch, and stock adjustment APIs.

## Step 5 — Expenses and owner settings

Add expense entry and history with invoice evidence or a documented exception. Add owner controls for users, warehouse access, tolerances, and expense categories.

Use `12-expenses.png` and the Record expense form in `reference-dialog.png`. Use `13-settings.png` for the account and sessions view. Confirm layouts and server contracts for the remaining settings tabs before wiring them.

## Step 6 — Reports and Excel downloads

Add report filters, export progress, and authorized Excel downloads. Include the trilingual purchase order export with product photos.

Use `14-reports-exports.png` with the export history, job status, and download endpoints.

## Step 7 — Invoice import and review

Upload invoice files, show the source beside the extracted draft, and let traders correct flagged values and confirm. Keep manual entry available when extraction fails.

Use `15-invoice-imports.png` for import history and `16-invoice-review.png` for the side-by-side review. Use the private files, extraction, and import review APIs.

## Step 8 — Regional pilot verification

Verify the full pilot in international and mainland China staging, including permissions, all three languages, responsive layouts, downloads, and live reconnect.

Use the screen and shared component references from Steps 1–7 to check the implemented layouts, including Arabic RTL and narrower viewports.
