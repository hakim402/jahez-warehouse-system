# Worker Mobile Plan

## First milestone

Let a worker record a receipt offline and sync it when the device reconnects.

1. Wire the API base URL and authenticated API client.
2. Store assigned orders and receipt drafts locally with Drift. Queue photos separately from receipt submission.
3. Sync receipts with stable operation IDs and display pending, synced, and failed states.

## Dependencies and verification

Use the order and sync contracts in the [server plan](../server/PLAN.md). Verify that a draft survives an offline app restart, a receipt syncs once after reconnecting, and a failed photo upload can retry separately.

[Worker mobile progress](../../progress/worker-mobile/PROGRESS.md)
