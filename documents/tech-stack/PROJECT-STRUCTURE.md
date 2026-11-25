# Jahez Warehouse System Project Structure

Use one repository for the Flutter worker app, React office dashboard, NestJS server, and deployment configuration. Organize application code by warehouse feature. Keep the server as one modular application with two entry points so the REST API and background worker share business rules and can be deployed independently.

[Agreed technology stack](README.md) · [System Design v2](../Requirments%20/Requirments.docx)

## Target repository layout

```text
jahez-warehouse-system/
├── apps/
│   ├── server/                 NestJS API and background worker
│   │   ├── src/
│   │   │   ├── main.ts         REST API and Socket.IO gateway
│   │   │   ├── worker.ts       pg-boss job runner
│   │   │   ├── modules/        Warehouse features and their business rules
│   │   │   └── platform/       Configuration, database connections and job infrastructure
│   │   ├── db/migrations/      PostgreSQL schema and row-level security migrations
│   │   └── test/               API and database integration tests
│   ├── office-web/
│   │   └── src/
│   │       ├── app/            Routes, session and application layout
│   │       ├── features/       Orders, receiving, stock, expenses and reports
│   │       ├── shared/         Reusable UI and formatting
│   │       └── api/            Generated TypeScript client and request setup
│   └── worker-mobile/
│       └── lib/
│           ├── app/            Startup, navigation, regional sign-in and session
│           ├── features/       Receiving, dispatch, photos and stock views
│           ├── offline/        Drift schema, sync and upload queues
│           ├── l10n/           Arabic, English and Chinese translations
│           └── api/            Generated Dart client and request setup
├── contracts/
│   └── openapi.json            Published schema for the versioned REST API
├── deploy/
│   ├── compose.yml             Shared deployment definition
│   ├── nginx/                  HTTPS, web assets, API and WebSocket routes
│   ├── env/                    Local, international and mainland .env examples
│   └── backup/                 Backup and restore scripts
├── documents/                  Requirements, invoice samples and architecture
├── .github/workflows/          Build, test and release checks if using GitHub
├── pnpm-workspace.yaml         Server and office web workspace
├── pnpm-lock.yaml
└── README.md                   Project entry point and local setup
```

Use pnpm for the TypeScript applications and Flutter's package tooling for the mobile app. Generate the OpenAPI schema from NestJS and use it to generate the TypeScript and Dart clients. Keep `/api/v1` compatible with the previous mobile release while workers update their devices. [pnpm workspaces](https://pnpm.io/workspaces) · [NestJS OpenAPI](https://github.com/nestjs/docs.nestjs.com/blob/master/content/openapi/introduction.md) · [OpenAPI Dart generator](https://openapi-generator.tech/docs/generators/dart-dio/)

## Backend feature ownership

| Module | Owns |
| --- | --- |
| `identity` and `tenancy` | Sign-in, tenant membership, roles, warehouse access, and usage counts for future plans |
| `catalog` and `orders` | Suppliers, customer marks, products, purchase orders, and order approval |
| `invoice-ingestion` | XLSX and PDF parsing, regional AI integration, validation, and extraction drafts for trader review |
| `receiving` | Receipt confirmation, partial deliveries, measurements, and discrepancy findings |
| `inventory` | Stock movements, available balances, adjustments, and stock age by receipt lot |
| `dispatch` | Carton selection, shipment confirmation, stock allocation through inventory, and packing-list data |
| `expenses` and `reports` | Expense records, report queries, and Excel export jobs |
| `files` | Attachment metadata, tenant-scoped access, and local, S3, or OSS storage |
| `sync` and `realtime` | Retry-safe sync, missed changes after reconnect, and warehouse-scoped Socket.IO notifications |

Within each feature, keep HTTP handlers, business operations, and database access easy to identify. `receiving` and `dispatch` call `inventory` to record movements. Mobile sync invokes the same server operations as the online API, with the same authorization, validations, and audit trail.

## Boundaries to establish first

- **Tenant and warehouse access.** Resolve access from the authenticated membership. Scope database records, attachments, jobs, and socket subscriptions by tenant and, where applicable, by warehouse. Keep worker responses and offline caches free of prices and costs.
- **Stock consistency.** Post confirmed receipts once per client operation ID, even when the device retries. Allow offline dispatch preparation and require online confirmation for the pilot. Validate available stock and record the dispatch movement in one transaction. Keep receipt-lot references so stock age remains traceable after partial dispatches.
- **Offline recovery.** Persist receipt actions and photo uploads independently. Keep the original worker attribution when a shared device reconnects. Send Socket.IO events after committed changes and let clients refresh from the API when they reconnect.
- **Regional configuration.** Use the same application build and migration history in both regions, with separate databases and server-side secrets. Validate each regional profile at startup. Keep uploads outside the web root and record their storage location so changing `STORAGE_DRIVER` preserves access to earlier files.

## Implementation and project workflow

1. **Foundation.** Set up the three applications, local Compose environment, tenant and warehouse membership, migrations, and the first API contract. Keep a short root README with the commands a new developer needs to run locally. In parallel, benchmark invoice extraction on approved samples so the riskiest input formats are understood early.
2. **First working flow.** Build manual order entry → offline receipt → sync → stock ledger → live dashboard. Use one synthetic warehouse and a second tenant to verify isolation. This validates the full operational path before extraction accuracy becomes a dependency.
3. **Complete warehouse operations.** Add dispatch, packing lists, expenses, reports, and audit views. Test duplicate receipt sync, concurrent dispatches, partial deliveries, and worker price restrictions against PostgreSQL.
4. **Invoice automation.** Add deterministic XLSX and PDF import, then the regional invoice AI adapters and trader review. Use the benchmark to set the acceptance checks for extraction and measure the time traders spend correcting a draft.
5. **Regional pilot and release.** Verify both deployment configurations in staging, run network checks from Yiwu, and practice restoring PostgreSQL and files before onboarding other companies. Keep plans assigned manually until billing is ready.

Give each issue one owner, a testable outcome, and any affected roles or regions. Use small pull requests that include the relevant migration, API contract update, and validation evidence when a change crosses applications. Release both regions from the same code revision and record each region's deployed version separately.
