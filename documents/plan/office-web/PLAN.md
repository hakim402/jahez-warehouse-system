# Office Web Plan

The first milestone is a Jahez trader creating a purchase order and seeing stock update after a worker's receipt syncs. The full sequence follows the [Office Web roadmap](ROADMAP.md).

Before coding a step, expand its heading here with the goal, numbered tasks, affected screens or modules, design references, API and other dependencies, and acceptance checks. Mark the step `In progress` when implementation starts.

After verification, record the date, completed work, actual check results, gaps, and next action under the matching step in [Office Web PROGRESS.md](../../progress/office-web/PROGRESS.md). Mark the plan step `Verified` once its required checks pass. Follow the [repository workflow](../../../AGENTS.md#workflow-for-every-step).

## Step 1 — App shell, API connection, and sign-in

Build Jahez sign-in, session handling, protected navigation, a shared API client, and assigned warehouse selection. Set up Jahez styling and English, Arabic RTL, and Simplified Chinese.

## Step 2 — Catalog and manual purchase orders

Build supplier, customer mark, and product management. Let traders list, view, create, edit, confirm, and cancel purchase orders as their status permits.

## Step 3 — Live receiving and stock dashboard

Show order progress, receipts, discrepancies, stock balances, movements, and stock age. Verify that a synced receipt updates the dashboard and that the view catches up after reconnecting.

## Step 4 — Findings, evidence, and dispatch views

Show ordered and received values together, let traders resolve findings, and display private evidence. Add dispatch history, packing details, and authorized stock adjustments.

## Step 5 — Expenses and owner settings

Add expense entry and history with invoice evidence or a documented exception. Add owner controls for users, warehouse access, tolerances, and expense categories.

## Step 6 — Reports and Excel downloads

Add report filters, export progress, and authorized Excel downloads. Include the trilingual purchase order export with product photos.

## Step 7 — Invoice import and review

Upload invoice files, show the source beside the extracted draft, and let traders correct flagged values and confirm. Keep manual entry available when extraction fails.

## Step 8 — Regional pilot verification

Verify the full pilot in international and mainland China staging, including permissions, all three languages, responsive layouts, downloads, and live reconnect.
