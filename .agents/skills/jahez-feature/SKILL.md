---
name: jahez-feature
description: Implement or review Jahez warehouse features for orders, receiving, dispatch, inventory, offline sync, invoice ingestion, expenses, reports, or related API and client changes.
---

# Jahez Feature Workflow

Start with the [repository workflow](../../../AGENTS.md#workflow-for-every-step). Keep implementation within the requested app and roadmap step. Save its numbered plan before coding, record verified progress under the same number, then commit and push according to the guide.

1. Read [Project Context](../../../documents/context/PROJECT-CONTEXT.md), the [app layouts](../../../documents/tech-stack/PROJECT-STRUCTURE.md#app-structure), and the relevant [backend module ownership](../../../documents/tech-stack/PROJECT-STRUCTURE.md#backend-feature-ownership). Check the current page, screen, module, and callers before choosing where the change belongs.
2. For visible UI changes, first read the [Jahez brand kit guidance](../../../documents/context/PROJECT-CONTEXT.md#brand-kit) and use its tokens and artwork. Keep page components and screen widgets beside their owners. Share UI at the narrowest scope with multiple consumers. Reuse the owning service for common operations. Explain the reasons behind non-obvious rules in comments, especially around permissions, retries, and transactions.
3. Trace the operation through the affected clients, server module, and persisted records. Resolve tenant and warehouse access on the server from authenticated membership. Apply that scope to affected queries, jobs, file access, and live events.
4. Check the applicable warehouse invariants.
   - **Stock.** Post movements through the inventory module. Check available quantity and record dispatch in one database transaction. Preserve receipt-lot links when a partial shipment affects stock age.
   - **Offline sync.** Route online and synced mutations through the same service. Key retries by client operation ID, preserve the original worker, and handle photo uploads independently. Keep worker payloads and local caches free of prices and costs. Send live events after a successful commit.
   - **Invoice ingestion.** Parse supported spreadsheets and searchable PDFs directly. Route photos and scans through the configured regional provider. Preserve source values, validate extracted arithmetic, and show uncertain fields to the trader.
5. When changing the REST contract, check both clients and preserve compatibility with the supported previous mobile version. When changing PostgreSQL, review tenant isolation and migration behavior with existing data.
6. Exercise the affected workflow with synthetic or redacted data. For stock or sync changes, check replay and concurrent dispatch where applicable. Record the results in the app's step progress before committing.
