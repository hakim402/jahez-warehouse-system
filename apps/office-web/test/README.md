# Office Web regional pilot verification

The local pilot smoke uses the real API, PostgreSQL, pg-boss job consumer and Socket.IO. It uses generated data, private temporary disk storage, and the deterministic extraction provider. It creates and removes a unique disposable database and restricted role for each run.

Build the server and Office Web from the repository root. Supply `TEST_ADMIN_DATABASE_URL` through the local environment using a loopback PostgreSQL administrator connection that can create databases and roles. The database named in that URL is used only as the connection for provisioning the disposable database.

```bash
pnpm --dir apps/server build
pnpm --dir apps/office-web build
node apps/office-web/test/pilot-smoke.cjs international
node apps/office-web/test/pilot-smoke.cjs cn-mainland
```

Use the same release revision in both staging environments. Record the region, deployed revision, latest migration, test time, role and test result for each row in the [Office Web Step 8 progress log](../../../documents/progress/office-web/PROGRESS.md#step-8--regional-pilot-verification). Keep synthetic credentials and raw logs that contain tokens outside Git. Setup, backup and restore checks live in the [deployment runbook](../../../deploy/RUNBOOK.md).

| Check | Staging acceptance |
| --- | --- |
| Network and assets | Open the staging Office Web URL. Verify valid HTTPS, redirect from HTTP, fonts and lazy route assets. Check same-origin `/api/v1/health/ready` and a Socket.IO WebSocket upgrade over TLS. Capture mainland results from Yiwu without a VPN. |
| Sign-in and permissions | Sign in as synthetic owner and trader. Check existing assigned warehouse and direct links. Verify owner settings access, trader denial, cross-company isolation, permission change and session revocation. Check worker commercial-route denial using the worker client contract. |
| Order to stock | Confirm a synthetic purchase order. Send a partial receipt using the previous supported Worker Mobile release. Verify order progress, receipt, discrepancies, balances, movement history and stock age. Resolve a finding and view private evidence. Exercise dispatch and an adjustment. |
| Live recovery | Observe a receipt live in the dashboard. Disconnect Office Web, submit a second receipt, then reconnect and verify REST catches up. Confirm a non-member cannot subscribe. Test configured warehouse scope in separately provisioned builds where applicable. |
| Private files and invoices | Upload a synthetic purchase and expense invoice. Verify private original and evidence downloads, review gates, correct fields, commits and manual fallback. Check the actual S3/OSS provider and the region’s DeepSeek/Qwen extraction with approved synthetic inputs. |
| Reports | Request a filtered Excel export and a trilingual purchase-order workbook. Confirm queue completion, workbook columns, row counts and totals, filename and authorized download. Record embedded product photos and exact client workbook parity as Server Step 9 gaps until delivered. |
| Visual and keyboard | Compare current screens with the approved Office Web references. Check EN, Arabic RTL and Simplified Chinese on desktop, tablet and phone. Tab through filters, dialogs and actions. Verify focus return, table scrolling and print preview. |

Local profile passes validate the application workflow with local providers. Record staging results from the real regional infrastructure and configured providers.
