# Office Web Implementation Roadmap

Start with a trader creating a manual purchase order. Complete the first workflow when a worker's synced receipt appears in the office dashboard and updates stock. Use the [Server Roadmap](../server/ROADMAP.md) for API dependencies and the [Worker Mobile Roadmap](../worker-mobile/ROADMAP.md) for the receiving handoff.

Follow the [agent guide](../../../AGENTS.md), [warehouse requirements](../../Requirments%20/REQUIREMENTS.md), [Office Web layout](../../tech-stack/PROJECT-STRUCTURE.md#office-web), and [Jahez brand kit](../../context/PROJECT-CONTEXT.md#brand-kit).

## How the agent should work

1. Read [Office Web Progress](../../progress/office-web/PROGRESS.md), inspect the current code, and choose the earliest unfinished step within scope.
2. Before coding, update [Office Web Plan](PLAN.md) with the screens, affected roles, API dependencies, and acceptance checks for that step. Reuse this file for each step.
3. Implement in the owning feature folder. Keep page components beside their pages and use the shared TypeScript API client. Check the OpenAPI contract before wiring a screen.
4. Run `pnpm --dir apps/office-web build` and verify the affected screens with synthetic data. Record the completed work, results, blockers, and next step in [Office Web Progress](../../progress/office-web/PROGRESS.md). Advance after the required checks pass.

## First workflow

### 1. App shell, API connection, and sign-in

- Use `VITE_API_BASE_URL` for the regional API. Set up protected routes, sign-in, session refresh, sign-out, and an active warehouse selector for authorized owners and traders. Clear session data and cached queries when the account changes.
- Apply the brand kit to navigation and shared controls. Establish Arabic RTL, English, and Simplified Chinese, with fonts and assets served by the app. Cover loading, empty, and error states.
- **Depends on.** Server steps 1–2 for API readiness, authentication, and warehouse memberships.
- **Verify.** Sign in, refresh a session, switch authorized warehouses, and sign out. Check blocked routes, regional configuration, Arabic layout, and keyboard navigation.

### 2. Catalog and manual purchase orders

- Add supplier, customer mark, and product selection and management. Build order list, detail, and draft forms with line items, quantities, cartons, prices, and optional delivery details. Use the server's validation and totals.
- Add confirm and cancel actions where the order state permits them. Show validation errors beside the affected fields and preserve edits when a save fails.
- **Depends on.** Server step 3 for catalog, order states, and the receiving queue.
- **Verify.** Create, edit, and confirm a synthetic order. Reload it and check that the authorized worker receives the correct order in the assigned warehouse.

### 3. Live receiving and stock dashboard

- Show order progress, receipts, discrepancies, stock balances, movement history, and stock age. Use warehouse and report filters where relevant.
- Subscribe to authorized Socket.IO events and refresh affected data from REST. Refresh again after reconnect and replace the subscription when the active warehouse changes.
- **Depends on.** Server steps 4–5 and Worker Mobile step 4 for the receipt-to-stock handoff.
- **Verify.** Send a partial receipt from Worker Mobile. Check the order, receipt, and stock views, then disconnect and reconnect the dashboard to confirm it catches up. Switch warehouses and check that the views follow the new scope.

## Complete the pilot

### 4. Findings, evidence, and dispatch views

- Show ordered and received values side by side. Let traders resolve findings with a note and view receipt photos when uploads finish. Show photo availability separately from receipt status.
- Show dispatch history, packing details, and stock adjustment history. Provide the stock adjustment form with reason and photo for authorized roles.
- **Depends on.** Server steps 4 and 6–7 for findings, private evidence, and stock operations.
- **Verify.** Resolve a finding with its evidence, open a partial dispatch, and submit an authorized adjustment that appears in movement history.

### 5. Expenses and owner settings

- Add expense list and entry with category, currency, date, optional customer or order link, and invoice evidence or a documented exception. Give owners the permitted controls for users, warehouse access, tolerances, and expense categories.
- **Depends on.** Server steps 2, 6, and 8 for identity, settings, attachments, and expenses.
- **Verify.** Record an expense with a photo and one with an exception. Use owner and trader accounts to check settings access and confirm that a permission change takes effect on reload.

### 6. Reports and Excel downloads

- Add report filters and export controls for receipts, dispatches and packing lists, inventory, movements, order comparisons, expenses, and purchase orders. Show queued, ready, and failed states for server jobs with authorized downloads.
- **Depends on.** Server step 9 for export jobs and templates.
- **Verify.** Export a filtered report and a trilingual purchase order with product photos. Check the downloaded files against the source records and exercise the failed-job flow.

### 7. Invoice import and review

- Upload XLSX, PDF, or images for purchase or expense extraction. Display the source beside the draft, highlight uncertain values and validation findings, and let the trader edit and confirm. Keep manual entry available when extraction fails.
- **Depends on.** Server steps 6, 9, and 10 for files, jobs, and extraction drafts.
- **Verify.** Review an approved sample with a flagged field, correct it, and confirm the draft. Check that a failed read still lets the trader create the record manually.

### 8. Regional pilot verification

- Exercise sign-in, order-to-stock, findings, expenses, and exports with owners and traders. Check supported languages, keyboard use, and layouts on desktop and tablet.
- **Depends on.** Server step 11 for international and mainland staging.
- **Verify.** Check asset loading, HTTPS, authorized downloads, and live reconnect in both regions. Record results from a mainland connection in Yiwu and log any remaining pilot gaps.
