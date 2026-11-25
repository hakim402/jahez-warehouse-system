# Jahez Warehouse System Project Structure

Use one repository for the Flutter worker app, React office dashboard, NestJS server, and deployment configuration. Organize application code by warehouse feature. Keep the server as one modular application with two entry points so the REST API and background worker share business rules and can be deployed independently.

[Agreed technology stack](README.md) · [System Design v2 requirements](../Requirments%20/REQUIREMENTS.md)

## Target repository layout

```text
jahez-warehouse-system/
├── apps/
│   ├── server/                 NestJS API and background worker
│   ├── office-web/             React and Vite dashboard
│   └── worker-mobile/          Flutter worker app
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

## App structure

Start with the feature that owns the work. These trees show the target layout and example filenames to use as each feature is implemented.

### Office web

```text
apps/office-web/src/
├── main.tsx
├── app/                          Routing, session, and dashboard layout
├── api/                          Generated TypeScript API client and request setup
├── features/
│   ├── orders/
│   │   ├── pages/
│   │   │   ├── order-list/
│   │   │   │   ├── OrderListPage.tsx
│   │   │   │   └── OrderFilters.tsx
│   │   │   └── order-detail/
│   │   │       ├── OrderDetailPage.tsx
│   │   │       └── OrderLineItems.tsx
│   │   └── components/           Components reused across order pages
│   ├── receiving/
│   ├── stock/
│   ├── expenses/
│   └── reports/
└── shared/
    └── ui/                       Buttons, dialogs, and generic tables
```

Use PascalCase for new page and component filenames and kebab-case for page folders. Keep feature-specific data access and state in the feature. Pages compose components and call the feature API through the shared client.

### Worker mobile

```text
apps/worker-mobile/lib/
├── main.dart
├── app/                          Navigation, session, and regional sign-in
├── api/                          Generated Dart API client and request setup
├── features/
│   ├── receiving/
│   │   ├── screens/
│   │   │   ├── receiving_queue_screen.dart
│   │   │   └── receipt/
│   │   │       ├── receipt_screen.dart
│   │   │       ├── receipt_controller.dart
│   │   │       └── widgets/      Quantity entry, measurements, and confirmation
│   │   └── receiving_repository.dart
│   ├── dispatch/
│   ├── photos/
│   └── stock/
├── offline/                      Drift schema, receipt sync, and photo upload queues
├── shared/
│   └── widgets/                  Controls reused across features
└── l10n/                         Arabic, English, and Chinese translations
```

Use snake_case for Dart filenames. Keep screen-specific state and widgets beside the screen. The receiving controller coordinates one draft across the three steps. The feature repository connects the screen flow to the offline store and API.

### Server

```text
apps/server/
├── src/
│   ├── main.ts                   REST API and Socket.IO entry point
│   ├── worker.ts                 Background job entry point
│   ├── app.module.ts
│   ├── modules/
│   │   ├── receiving/
│   │   │   ├── receiving.module.ts
│   │   │   ├── receiving.controller.ts
│   │   │   ├── receiving.service.ts
│   │   │   ├── receiving.repository.ts
│   │   │   └── dto/
│   │   │       └── confirm-receipt.dto.ts
│   │   └── ...                   See backend feature ownership below
│   └── platform/                 Configuration, database connections, and job infrastructure
├── db/migrations/                PostgreSQL schema and row-level security
└── test/                         API and database integration tests
```

Controllers handle HTTP, DTOs define inputs and outputs, services own business operations, and repositories hold module-specific queries when needed. The API and worker reuse the same services.

### Reuse and comments

- Keep components beside their page or screen. Promote a component to the feature's `components/` or `widgets/` directory when it serves multiple pages or screens in that feature. Use `shared/ui` or `shared/widgets` for reusable controls across features.
- Start a simple page or screen as one file. Add a folder when it has its own components or state. Give files names that describe their responsibility.
- Extract shared business behavior through the owning service. For example, online receiving and offline sync use the same receipt confirmation operation.
- Use comments to explain why a rule is needed, especially around offline retries, permissions, and stock transactions. For a retry-safe receipt, a useful comment is `// Enforce the operation ID and record the stock movement in one transaction so a replay cannot add stock twice.`

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
