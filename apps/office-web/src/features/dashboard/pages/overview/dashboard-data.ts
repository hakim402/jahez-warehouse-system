import { useQuery } from '@tanstack/react-query';
import { authenticatedJson, useSession } from '../../../../app/session';
import type { Movement } from '../../../stock/warehouse-api';

const day = 86_400_000;

export function useReceiptHistory(warehouseId: string | undefined) {
  const { session } = useSession();
  return useQuery({
    queryKey: ['dashboard-history', session?.user.tenantId, session?.user.id, warehouseId],
    enabled: Boolean(warehouseId),
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const cutoff = Date.now() - 56 * day;
      const records = new Map<string, Movement>();
      const seenCursors = new Set<string>();
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ warehouseId: warehouseId!, limit: '200' });
        if (cursor) params.set('cursor', cursor);
        const page = await authenticatedJson<{ movements: Movement[]; nextCursor: string | null }>(
          '/stock/movements?' + params, { signal },
        );
        page.movements.forEach((movement) => records.set(movement.id, movement));
        cursor = page.nextCursor;
        if (page.movements.some((movement) => Date.parse(movement.createdAt) < cutoff)) break;
        if (cursor && seenCursors.has(cursor)) throw new Error('Repeated movement cursor');
        if (cursor) seenCursors.add(cursor);
      } while (cursor);
      return [...records.values()];
    },
  });
}

export function receiptSeries(movements: Movement[], now = new Date()) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const currentStart = end - 27 * day;
  const previousStart = currentStart - 28 * day;
  const current = Array<bigint>(28).fill(0n);
  const previous = Array<bigint>(28).fill(0n);
  const weekdays = Array.from({ length: 7 }, () => new Set<string>());
  for (const movement of movements) {
    if (movement.kind !== 'receipt') continue;
    // Charts use the ledger posting date so late syncs appear when stock was posted.
    const timestamp = Date.parse(movement.createdAt);
    if (timestamp < previousStart || timestamp >= end + day || !Number.isFinite(timestamp)) continue;
    const index = Math.floor((timestamp - previousStart) / day);
    const cartons = BigInt(movement.cartons);
    if (index < 28) previous[index] += cartons;
    else {
      current[index - 28] += cartons;
      const weekday = (new Date(timestamp).getUTCDay() + 6) % 7;
      if (movement.receiptId) weekdays[weekday].add(movement.receiptId);
    }
  }
  const tooLarge = [...current, ...previous].some((value) => value > BigInt(Number.MAX_SAFE_INTEGER));
  const total = current.reduce((sum, value) => sum + value, 0n);
  const prior = previous.reduce((sum, value) => sum + value, 0n);
  return {
    total, prior, tooLarge,
    days: current.map((value, index) => ({
      date: new Date(currentStart + index * day).toISOString().slice(0, 10),
      current: Number(value), previous: Number(previous[index]),
    })),
    weekdays: weekdays.map((receipts, index) => ({ date: new Date(Date.UTC(2026, 0, 5 + index)), count: receipts.size })),
  };
}
