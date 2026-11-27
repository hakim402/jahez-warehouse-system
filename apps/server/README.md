# Jahez Server

The backend for Jahez Warehouse System. One NestJS application provides the REST API and a separate worker process handles Excel exports and invoice extraction.

For Office Web and Worker Mobile development, use the shared [Backend Integration Guide](../../documents/api/BACKEND-INTEGRATION.md). It covers request examples, roles, offline retries, files, live events, and the client design and structure references.

| Component | Used for |
| --- | --- |
| NestJS and TypeScript | REST API under `/api/v1` |
| PostgreSQL | Tenant data, warehouse permissions, stock ledger, audit, and migrations |
| pg-boss | Background jobs using PostgreSQL |
| Socket.IO | Warehouse updates with authorization checked before delivery |
| Private disk, S3, or Alibaba OSS | Photos, invoices, and generated files |

## Development setup

Run the commands below from the **repository root**. Use Node.js 22, pnpm 9.15.9, and PostgreSQL. Local database verification uses PostgreSQL 17.

```bash
corepack enable
pnpm --dir apps/server install --frozen-lockfile
cp apps/server/.env.example apps/server/.env
openssl rand -hex 32
```

Paste the generated value into `JWT_SECRET` in the local `.env`. Fill in the database URLs and replace their placeholder passwords. URL-encode special characters in database passwords.

| Setting | Development value or purpose |
| --- | --- |
| `PORT` | `3000` |
| `DEPLOYMENT_PROFILE` | `international` or `cn-mainland` |
| `DATABASE_URL` | Restricted API and worker database login |
| `MIGRATION_DATABASE_URL` | Separate schema-owner login for migrations |
| `JWT_SECRET` | Random signing secret from the command above |
| `STORAGE_DRIVER` | `local` |
| `STORAGE_LOCAL_DIR` | `../../storage`, relative to `apps/server` |
| `INVOICE_AI_PROVIDER` | `sample` for synthetic extraction without a network call, or `none` to disable extraction |

The complete settings and database grant guidance are in [`.env.example`](.env.example). Real AI extraction also requires the configured endpoint, model, and API key. Keep `.env` private.

### Prepare PostgreSQL

Have a database administrator create the application database, a migration role that owns its schema, and a restricted runtime login. Use the two connection URLs above for those roles. The runtime login needs `CONNECT` to the database and `USAGE` on the application schema.

```bash
pnpm --dir apps/server build
pnpm --dir apps/server migrate
```

Apply the runtime grants described in [`.env.example`](.env.example) after migration. This includes the narrow update grants for job records, append-only ledger permissions, and pg-boss schema permissions. Migrations grant privileged auth and receiving functions to the runtime user resolved from `DATABASE_URL`.

Migration files are applied in filename order and recorded with checksums. Rerunning the command applies pending files. Add a new migration when changing an already-shared schema.

### Start the API and worker

Use separate terminals.

```bash
# Terminal 1 — API with reload
pnpm --dir apps/server dev
```

```bash
# Terminal 2 — compiled worker
pnpm --dir apps/server build
pnpm --dir apps/server start:worker
```

Rebuild and restart the worker after changing its code. Both processes read `apps/server/.env`. The API enqueues jobs and the worker consumes them.

### Create test accounts

Account provisioning currently uses administrator-managed database records. Create a synthetic company, warehouse, users, and warehouse memberships. Users have `owner`, `trader`, or `worker` roles. Set `users.password_hash` using the server's scrypt helper.

Generate a hash with the compiled helper from the server directory. This prompts for a local test password.

```bash
cd apps/server
node -e 'const r=require("node:readline").createInterface({input:process.stdin,output:process.stdout}); r.question("Synthetic test password (visible while typing): ",p=>{console.log(require("./dist/modules/auth/password").hashPassword(p));r.close();});'
```

Return to the repository root for subsequent commands. Use disposable data when testing mutations. Phone sign-in uses the password credential. SMS delivery and a self-service registration flow are still pending.

## macOS PostgreSQL troubleshooting

If readiness returns `503` with `{"status":"error","database":"down"}`, check which database
installation owns port 5432 before resetting a password. This project was set up locally on
PostgreSQL 17 installed under `/Library/PostgreSQL/17`. Homebrew PostgreSQL 14 can start on the
same port and have different roles and databases.

```bash
brew services list
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

Use the listener PID from `lsof` to identify its data directory.

```bash
# Replace LISTENER_PID with the PostgreSQL listener's numeric PID.
lsof -a -p LISTENER_PID -d cwd
```

`/usr/local/var/postgresql@14` indicates the Homebrew installation. If your intended project
database is in PostgreSQL 17 and PostgreSQL 14 is occupying the port, switch services as below.
Stopping PostgreSQL 14 interrupts any application currently using that instance.

```bash
brew services stop postgresql@14
sudo launchctl bootstrap system /Library/LaunchDaemons/postgresql-17.plist
sudo launchctl kickstart -k system/postgresql-17
/Library/PostgreSQL/17/bin/pg_isready -h 127.0.0.1 -p 5432
```

If `bootstrap` reports the service is already loaded, continue with `kickstart`. The readiness
command should report `accepting connections`. Verify the project database with a password prompt.

```bash
/Library/PostgreSQL/17/bin/psql -X -h 127.0.0.1 -p 5432 -U postgres -d jahez_warehouse_db -W -c 'SELECT 1;'
```

This command checks the local administrator connection. The application's `DATABASE_URL` should
use its provisioned runtime role, and `MIGRATION_DATABASE_URL` its migration role, as described
above. If the administrator check succeeds but API readiness still fails, check the configured
runtime role, database name, and credentials against the API terminal's PostgreSQL error.

Stop the API with `Ctrl+C` in its terminal, restart from the repository root, then verify readiness
from a second terminal.

```bash
pnpm --dir apps/server dev
```

```bash
curl --fail http://127.0.0.1:3000/api/v1/health/ready
```

Success contains `"status":"ok"` and `"database":"up"`. `latencyMs` varies. Restart the worker
too if it exited while PostgreSQL was unavailable. Switching these services preserves their data
directories.

## Commands

| Command from repository root | Purpose |
| --- | --- |
| `pnpm --dir apps/server typecheck` | Check TypeScript |
| `pnpm --dir apps/server build` | Compile into `dist/` |
| `pnpm --dir apps/server migrate` | Run migrations from the compiled entry point |
| `pnpm --dir apps/server dev` | Start the API with reload |
| `pnpm --dir apps/server start` | Start the compiled API |
| `pnpm --dir apps/server start:worker` | Start the compiled job worker |

## Test the system

Start with health checks.

```bash
curl --fail http://127.0.0.1:3000/api/v1/health
curl --fail http://127.0.0.1:3000/api/v1/health/ready
```

Liveness returns `200` when the API is running. Readiness returns `200` when PostgreSQL is available and `503` otherwise. Jobs require the worker and PostgreSQL.

In an API client, send `POST /api/v1/auth/login` with the synthetic account's `phone`, `password`, `tenantId`, and a `deviceId`. Use the returned `accessToken` as a bearer token on protected requests. Refresh with `POST /auth/refresh`, sign out with `POST /auth/logout`, and manage active devices through `/auth/sessions`.

| Test | Requests and expected result |
| --- | --- |
| Manual order | Office user creates supplier/customer through `/parties`, a product through `/products`, then creates and confirms `/orders` |
| Worker queue | `GET /orders/awaiting?warehouseId=...` shows ready and partial orders with outstanding cartons |
| Receiving | `POST /receipts/confirm` with a UUID `clientOperationId`, `warehouseId`, `orderId`, and receipt lines posts stock atomically |
| Retry | Resubmit the identical receipt operation and receive its original acknowledgment without duplicate stock |
| Offline sync | `POST /sync/push` accepts an `operations` array; `GET /sync/pull?warehouseId=...&cursor=...` catches up |
| Stock | `/stock`, `/stock/movements`, and `/stock/age` accept `warehouseId` and supported group filters |
| Evidence | Multipart `POST /files?warehouseId=...` uses `uploadId`, `purpose`, optional entity link, and `file`; download through `/files/:id/content` |
| Dispatch | `POST /dispatches` checks stock and allocates FIFO receipt lots; `/dispatches/:id` returns packing details |
| Adjustment | Office `POST /stock/adjustments` requires a reason and an authorized adjustment photo |
| Expense | Office `POST /expenses` requires invoice evidence or a documented exception |
| Export | Office `POST /exports` creates a job; poll `/exports/:id` and download `/exports/:id/file` after completion |
| Invoice review | Upload source evidence, call `/orders/extract` or `/expenses/extract`, review `/imports/:id`, then commit it |
| Isolation | A second tenant and a same-tenant non-member cannot access the first warehouse; workers cannot access commercial orders, expenses, imports, exports, or invoice files |

Routes in the table use the `/api/v1` prefix. Review the [controllers](src/modules/) for the exact request fields. There is currently no packaged automated test command or generated OpenAPI document. The verification evidence in [Server Progress](../../documents/progress/server/PROGRESS.md) records the disposable-database scenarios already exercised.

For live updates, connect a Socket.IO client to the API with `auth.token` set to the access token, then emit `subscribe` with `{ warehouseId }` and check the acknowledgment. Clients refresh affected views on events and recover missed changes through sync pull. Expense events are office-only.

## Code layout

```text
src/
  main.ts             API and Socket.IO startup
  worker.ts           Background job consumption
  migrate.ts          Migration entry point
  modules/            Auth, tenancy, orders, receiving, stock, files, and other features
  platform/           Configuration, database, storage, audit, and migrations
db/migrations/        Ordered SQL migrations
```

Keep business rules in their owning service. REST requests, offline retries, and job handlers reuse the same operations. Tenant context is set inside database transactions and PostgreSQL RLS reinforces service authorization. Worker payloads use explicit fields that exclude commercial data.

## Production

International API requests use `https://api.jahez.online/api/v1`, with readiness at
`https://api.jahez.online/api/v1/health/ready`. Office Web runs at `https://office.jahez.online`.
Socket.IO connects to the API host using `/socket.io/`. The current office configuration uses
relative `/api/v1` and same-origin Socket.IO through Nginx. See the domain and TLS guidance below.

Follow the [deployment runbook](../../deploy/RUNBOOK.md) for first-time provisioning, TLS, runtime grants, and backups. Both regions use the same image and migrations with independent environment settings.

1. Create the region environment from [`deploy/env/`](../../deploy/env/), configure database roles and secrets, and provision private storage.
2. Build the image, run migrations, apply runtime grants, and start the API and worker. Compose runs migrations before the API and waits for API readiness before starting the worker.
3. Render the Nginx template, provide valid TLS certificates, and verify HTTPS, `/api/`, and `/socket.io/` routing.
4. Verify readiness, a full warehouse flow, and restore recovery before admitting pilot users.

Useful commands from the repository root after provisioning the international profile are below. Use `cn-mainland.env` for mainland deployment.

```bash
docker compose --env-file deploy/env/international.env -f deploy/compose.yml config --quiet
docker compose --env-file deploy/env/international.env -f deploy/compose.yml up -d --build
docker compose --env-file deploy/env/international.env -f deploy/compose.yml ps
docker compose --env-file deploy/env/international.env -f deploy/compose.yml logs --tail=100 api worker
```

Select `local`, `s3`, or `oss` with `STORAGE_DRIVER`, provide that provider's settings, and recreate the services. Retain the settings needed to read files uploaded under earlier providers. The private disk must be writable by the container user and persist across restarts.

The [backup scripts](../../deploy/backup/) encrypt database dumps and local files. Configure off-server regional retention. Cloud objects need their own versioning or replication and a tested restore procedure. Restore only into an intended recovery database and storage directory.

### Remaining release checks

Real regional Docker startup, TLS routing, cloud storage round-trips and recovery, Yiwu connectivity, and previous-mobile-version compatibility still require staging verification. Live DeepSeek/Qwen accuracy, direct searchable-PDF parsing, and handwritten invoice automation remain open or deferred. See [Step 11 progress](../../documents/progress/server/PROGRESS.md#step-11--regional-staging-and-pilot-readiness) before treating the backend as pilot-ready.
