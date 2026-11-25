# Server Plan

## First milestone

Connect the NestJS API to PostgreSQL and support the first order-to-stock workflow.

1. Load and validate the server environment and check database readiness.
2. Add initial migrations for companies, warehouses, users, and memberships. Enforce access using warehouse membership.
3. Implement manual orders and idempotent receipt sync. Post stock movements in the receipt transaction and publish live updates after it commits.

## Dependencies and verification

Use the local PostgreSQL instance for development. With synthetic data, verify database readiness, cross-tenant denial, and a receipt replay that leaves stock counted once. Coordinate the order and receipt contracts with [office web](../office-web/PLAN.md) and [worker mobile](../worker-mobile/PLAN.md).

[Server progress](../../progress/server/PROGRESS.md)
