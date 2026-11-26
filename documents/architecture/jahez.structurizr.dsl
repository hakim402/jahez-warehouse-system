// Jahez Warehouse System — current-state C4 model (as built through server Step 8, commit e56d1e2, 2026-11-26)
// Produced by architecture-visualization:system-modeler + c4model.
// Evidence index: system-model.evidence.md. Open with Qoder's Structurizr DSL viewer.
workspace "Jahez Warehouse System" "Multi-tenant warehouse operations: receiving, stock, dispatch, expenses, evidence files, offline sync." {

    model {
        owner = person "Owner" "Tenant administrator. Manages catalog, expense categories, and all office operations."
        trader = person "Trader" "Office staff. Records orders, receipts, dispatches, adjustments, and expenses."
        worker = person "Warehouse Worker" "Warehouse-floor staff. Confirms receipts and dispatches; must never see prices or costs."

        jahez = softwareSystem "Jahez Warehouse System" "Tenant-isolated warehouse operations platform for JAHEZ TRADE CO." {

            officeWeb = container "Office Web Dashboard" "React 19 + Vite 8 SPA. Placeholder shell only ('Jahez Office' heading); feature/api folders exist but are empty. No API integration yet." "React 19 / Vite 8" "Scaffold"

            workerMobile = container "Worker Mobile App" "Flutter app. Placeholder shell only ('Jahez Worker' text); api/offline/feature folders exist but are empty. Offline sync engine not implemented yet." "Flutter" "Scaffold"

            api = container "Warehouse API" "NestJS 11 modular monolith. REST under /api/v1 and Socket.IO attached to the same HTTP server. Verified end-to-end on disposable PostgreSQL (Steps 1-8)." "NestJS 11 / Node.js" {
                tenancy = component "Tenancy" "Session auth (JWT + auth_sessions revalidation), AuthGuard, WarehouseAccessGuard, warehouse membership lookup. Roles: owner / trader / worker." "NestJS module"
                auth = component "Auth" "Login, refresh, logout, session listing/revocation. Password hashing." "NestJS module"
                catalog = component "Catalog" "Parties (suppliers/customers) and products CRUD." "NestJS module"
                orders = component "Orders" "Manual order entry: awaiting list, create, confirm, cancel." "NestJS module"
                receiving = component "Receiving" "Receipt confirmation with photo evidence and findings; posts receipt stock movements; idempotent via client_operations." "NestJS module"
                inventory = component "Inventory" "Stock balances, movement ledger, lot age; office-only signed adjustments with mandatory photo." "NestJS module"
                dispatch = component "Dispatch" "FIFO receipt-lot allocation, shortage reporting, packing lists; posts negative lot-linked movements under advisory stock lock." "NestJS module"
                expenses = component "Expenses" "Office-only expense recording (invoice file XOR no-invoice note) and owner-managed categories. Deliberately excluded from worker sync feed." "NestJS module"
                files = component "Files & Evidence" "Multipart upload, list, metadata, download. Purpose-based office-only restrictions; content-type allowlist; per-file storage provider + key." "NestJS module"
                sync = component "Offline Sync" "POST push replays queued receipt confirmations per item; GET pull streams worker-safe sync_changes by integer cursor." "NestJS module"
                realtime = component "Realtime Gateway" "Socket.IO warehouse rooms (tenant:warehouse). Session revalidated per delivery; expense.recorded withheld from worker sockets." "NestJS module"
                platform = component "Platform" "SERVER_CONFIG validation, DatabaseService (pg pool + withTenant RLS GUCs), StorageService (local/S3/OSS providers), audit writer, migration runner." "NestJS module"
            }

            workerProcess = container "Background Worker Process" "Separate NestJS application context (dist/worker.js). Currently performs a PostgreSQL readiness check only; pg-boss job queue planned in Step 9." "Node.js" "Stub"

            migrator = container "Migration Runner" "CLI (dist/migrate.js) applying db/migrations 0001-0009 with schema_migrations ledger, advisory lock, checksum drift detection." "Node.js CLI" "CLI"

            db = container "Warehouse Database" "Single PostgreSQL database. Row-level security keyed on transaction-local app.tenant_id / app.user_id GUCs; append-only ledgers (stock_movements, audit_events, sync_changes, dispatches, adjustments, expenses); client_operations idempotency; document_counters." "PostgreSQL" "Database"

            localFiles = container "Local File Storage" "Private disk volume (STORAGE_LOCAL_DIR). Default write provider; earlier files stay readable through the provider recorded on their row." "Filesystem" "Storage"
        }

        s3 = softwareSystem "S3-compatible Object Storage" "Optional file provider (STORAGE_DRIVER=s3). Code path implemented; runtime cloud verification pending staging credentials." "External"
        oss = softwareSystem "Alibaba Cloud OSS" "Optional file provider for the cn-mainland deployment profile (STORAGE_DRIVER=oss). Code path implemented; runtime cloud verification pending." "External"

        // Actor relationships (role capabilities evidenced by server role checks; client UIs are scaffolds)
        owner -> officeWeb "Office operations incl. expense-category management (intended UI; scaffold today)"
        trader -> officeWeb "Orders, receipts, dispatches, adjustments, expenses (intended UI; scaffold today)"
        worker -> workerMobile "Receipt/dispatch confirmation, photos (intended UI; scaffold today)"

        owner -> jahez "Administers tenant via role-scoped API"
        trader -> jahez "Records warehouse operations via role-scoped API"
        worker -> jahez "Confirms receipts/dispatches; cost data withheld server-side"

        // Container relationships
        officeWeb -> api "Planned: REST /api/v1 + Socket.IO subscribe (no client code yet)" "HTTPS / WebSocket" "Planned"
        workerMobile -> api "Planned: REST + sync push/pull + Socket.IO (no client code yet)" "HTTPS / WebSocket" "Planned"
        api -> db "Reads/writes via pg pool; per-transaction tenant GUCs enforce RLS" "SQL"
        api -> localFiles "Puts/streams evidence files (default driver)" "file"
        api -> s3 "Optional PutObject/GetObject (configured; runtime unverified)" "S3 API" "Unverified"
        api -> oss "Optional put/getStream (configured; runtime unverified)" "OSS SDK" "Unverified"
        workerProcess -> db "Readiness check (SELECT 1) only" "SQL"
        migrator -> db "Applies migrations as privileged provisioning role" "SQL"

        // Component relationships (NestJS module imports + service calls)
        auth -> tenancy "Session issuing/validation"
        auth -> platform "DB access"
        catalog -> tenancy "Guards"
        catalog -> platform "DB access"
        orders -> tenancy "Guards"
        orders -> platform "DB access"
        orders -> realtime "Publishes committed order changes"
        receiving -> tenancy "Guards"
        receiving -> platform "DB access, audit"
        receiving -> inventory "Posts receipt stock movements"
        receiving -> realtime "Publishes committed receipt/finding changes"
        inventory -> tenancy "Guards + office-role checks"
        inventory -> platform "DB access, audit"
        inventory -> realtime "Publishes adjustment.recorded"
        dispatch -> tenancy "Guards"
        dispatch -> platform "DB access, audit, advisory stock lock"
        dispatch -> inventory "FIFO lot drawdown movements"
        dispatch -> realtime "Publishes dispatch.confirmed"
        expenses -> tenancy "Guards + office/owner role checks"
        expenses -> platform "DB access, audit"
        expenses -> realtime "Publishes expense.recorded (office sockets only)"
        files -> tenancy "Guards + purpose-based role checks"
        files -> platform "StorageService providers, DB"
        sync -> tenancy "Guards + warehouse access"
        sync -> receiving "Replays queued receipt confirmations"
        sync -> platform "Reads sync_changes feed"
        realtime -> tenancy "Session revalidation per subscription/delivery"
        tenancy -> platform "DB access (auth_sessions, memberships)"
        platform -> db "pg pool; withTenant sets RLS GUCs" "SQL"
        platform -> localFiles "Local provider put/get" "file"
        platform -> s3 "S3 provider put/get" "S3 API" "Unverified"
        platform -> oss "OSS provider put/get" "OSS SDK" "Unverified"
    }

    views {
        systemContext jahez "SystemContext" "L1 - actors, system boundary, optional external storage providers." {
            include *
            autolayout tb
        }

        containers jahez "Containers" "L2 - deployable units. Client apps are scaffolds; planned edges dashed." {
            include *
            autolayout tb
        }

        components api "ServerComponents" "L3 - NestJS modules inside the Warehouse API and their evidenced dependencies." {
            include *
            autolayout tb
        }

        styles {
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Database" {
                shape cylinder
                background #438dd5
                color #ffffff
            }
            element "Storage" {
                shape folder
                background #438dd5
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Scaffold" {
                background #999999
                color #ffffff
                border dashed
            }
            element "Stub" {
                background #999999
                color #ffffff
                border dashed
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "CLI" {
                shape component
            }
            relationship "Planned" {
                style dashed
                color #777777
            }
            relationship "Unverified" {
                style dashed
                color #b8860b
            }
        }
    }
}