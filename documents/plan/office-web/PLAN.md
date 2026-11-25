# Office Web Plan

## First milestone

Enable office staff to create a manual supplier order and see stock change when a worker's receipt syncs.

1. Wire the API base URL and authenticated API client.
2. Build manual order entry and show the saved order on the office web.
3. Show receipt status and refresh stock when the server publishes a committed update.

## Dependencies and verification

Use the order, stock, and live update contracts in the [server plan](../server/PLAN.md). Verify with a synthetic order that an authorized user can save it and see stock update after receipt sync.

[Office web progress](../../progress/office-web/PROGRESS.md)
