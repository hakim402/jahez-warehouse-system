import { useQuery } from '@tanstack/react-query';
import { authenticatedJson } from '../../../../app/session';
import { useWarehouseScope } from '../../../../app/use-warehouse-scope';
import { collectMovements } from '../../../stock/movement-pages';
import type { Movement } from '../../../stock/warehouse-api';
import { compareStockCounts, sumStockCounts, type StockCountValue } from '../../../stock/stock-count';

const day = 86_400_000;

export function useReceiptHistory(warehouseId: string | undefined) {
  const scope = useWarehouseScope();
  return useQuery({
    queryKey: scope.queryKey('dashboard-history'),
    enabled: Boolean(warehouseId),
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const cutoff = Date.now() - 56 * day;
      return collectMovements((cursor) => {
        const params = new URLSearchParams({ warehouseId: warehouseId!, limit: '200' });
        if (cursor) params.set('cursor', cursor);
        return authenticatedJson('/stock/movements?' + params, { signal });
      }, (page) => page.movements.some((movement) => Date.parse(movement.createdAt) < cutoff));
    },
  });
}

export function receiptSeries(movements: Movement[], now = new Date()) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const currentStart = end - 27 * day;
  const previousStart = currentStart - 28 * day;
  const current = Array.from({ length: 28 }, () => [] as StockCountValue[]);
  const previous = Array.from({ length: 28 }, () => [] as StockCountValue[]);
  const weekdays = Array.from({ length: 7 }, () => new Set<string>());
  for (const movement of movements) {
    if (movement.kind !== 'receipt') continue;
    // Charts use the ledger posting date so late syncs appear when stock was posted.
    const timestamp = Date.parse(movement.createdAt);
    if (timestamp < previousStart || timestamp >= end + day || !Number.isFinite(timestamp)) continue;
    const index = Math.floor((timestamp - previousStart) / day);
    if (index < 28) previous[index].push(movement.cartons);
    else {
      current[index - 28].push(movement.cartons);
      const weekday = (new Date(timestamp).getUTCDay() + 6) % 7;
      if (movement.receiptId) weekdays[weekday].add(movement.receiptId);
    }
  }
  const currentTotals = current.map(sumStockCounts);
  const previousTotals = previous.map(sumStockCounts);
  const totals = [...currentTotals, ...previousTotals];
  const invalid = totals.some((value) => value === null);
  const tooLarge = totals.some((value) => {
    const high = compareStockCounts(value, Number.MAX_SAFE_INTEGER);
    const low = compareStockCounts(value, -Number.MAX_SAFE_INTEGER);
    return high === null || low === null || high > 0 || low < 0;
  });
  return {
    total: sumStockCounts(currentTotals),
    prior: sumStockCounts(previousTotals),
    tooLarge,
    invalid,
    days: currentTotals.map((value, index) => ({
      date: new Date(currentStart + index * day).toISOString().slice(0, 10),
      current: Number(value ?? 0), previous: Number(previousTotals[index] ?? 0),
    })),
    weekdays: weekdays.map((receipts, index) => ({ date: new Date(Date.UTC(2026, 0, 5 + index)), count: receipts.size })),
  };
}
