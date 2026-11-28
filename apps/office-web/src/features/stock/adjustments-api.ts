import { useQuery } from '@tanstack/react-query';
import { authenticatedJson } from '../../app/session';
import { useWarehouseScope } from '../../app/use-warehouse-scope';
import { compareStockCounts, stockCountSign, sumStockCounts } from './stock-count';
import { collectMovements } from './movement-pages';
import type { Movement, StockRow } from './warehouse-api';

export type StockGroup = Pick<StockRow, 'customerId' | 'supplierId' | 'brand' | 'productId'>;

export type StockLot = {
  receiptLineId: string;
  receiptId: string | null;
  receiptNo: string | null;
  receivedAt: string | null;
  product: StockRow['product'];
  brand: string | null;
  cartons: string;
  qty: string | null;
  cbm: string | null;
  receivedCartons: string;
  receivedQty: string | null;
  receivedCbm: string | null;
};

export type AdjustmentInput = {
  clientOperationId: string;
  warehouseId: string;
  reason: string;
  photoFileId: string;
  cartons: number;
  qty: number | null;
  cbm: number | null;
  note: string | null;
  receiptLineId: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  brand?: string | null;
  productId?: string | null;
};

export type AdjustmentResponse = {
  id: string;
  adjustmentNo: string;
  warehouseId: string;
  reason: string;
  note: string | null;
  photoFileId: string;
  customerId: string | null;
  supplierId: string | null;
  brand: string | null;
  productId: string | null;
  receiptLineId: string | null;
  cartons: number;
  qty: number | null;
  cbm: number | null;
  adjustedBy: string;
  adjustedAt: string;
  stockMovementId: string;
};

export function stockGroupKey(group: StockGroup): string {
  return JSON.stringify([group.customerId, group.supplierId, group.brand, group.productId]);
}

export function recordStockAdjustment(input: AdjustmentInput) {
  return authenticatedJson<AdjustmentResponse>('/stock/adjustments', { method: 'POST', json: input });
}

export function useStockLots(scope: ReturnType<typeof useWarehouseScope>, group: StockGroup | null) {
  const key = group ? stockGroupKey(group) : '';
  return useQuery({
    queryKey: scope.queryKey('stock-lots', key),
    enabled: scope.canRead && Boolean(scope.warehouseId && group),
    queryFn: async ({ signal }) => {
      const movements = await collectMovements((cursor) => authenticatedJson(
        movementQuery(scope.warehouseId!, group!, cursor), { signal }));
      return remainingLots(movements, group!);
    },
  });
}

function movementQuery(warehouseId: string, group: StockGroup, cursor: string | null) {
  const query = new URLSearchParams({ warehouseId, limit: '200' });
  if (group.customerId) query.set('customerId', group.customerId);
  if (group.supplierId) query.set('supplierId', group.supplierId);
  if (group.brand) query.set('brand', group.brand);
  if (group.productId) query.set('productId', group.productId);
  if (cursor) query.set('cursor', cursor);
  return '/stock/movements?' + query;
}

function remainingLots(movements: Movement[], group: StockGroup): StockLot[] {
  const lots = new Map<string, {
    receiptLineId: string;
    receiptId: string | null;
    receiptNo: string | null;
    receivedAt: string | null;
    product: StockRow['product'];
    brand: string | null;
    cartons: Array<string | number>;
    qty: Array<string | number | null>;
    cbm: Array<string | number | null>;
    receivedCartons: string | null;
    receivedQty: string | null;
    receivedCbm: string | null;
  }>();
  for (const movement of movements) {
    if (!movement.receiptLineId || movement.customerId !== group.customerId || movement.supplierId !== group.supplierId ||
      movement.brand !== group.brand || movement.productId !== group.productId) continue;
    const lot = lots.get(movement.receiptLineId) ?? {
      receiptLineId: movement.receiptLineId,
      receiptId: movement.receiptId ?? null,
      receiptNo: movement.receiptNo ?? null,
      receivedAt: movement.receivedAt ?? movement.createdAt,
      product: movement.product,
      brand: movement.brand,
      cartons: [], qty: [], cbm: [],
      receivedCartons: null, receivedQty: null, receivedCbm: null,
    };
    lot.cartons.push(movement.cartons);
    lot.qty.push(movement.qty);
    lot.cbm.push(movement.cbm === null ? null : String(movement.cbm));
    if (movement.kind === 'receipt') {
      lot.receiptId = movement.receiptId ?? lot.receiptId;
      lot.receiptNo = movement.receiptNo ?? lot.receiptNo;
      lot.receivedAt = movement.receivedAt ?? lot.receivedAt;
      lot.receivedCartons = String(movement.cartons);
      lot.receivedQty = movement.qty === null ? null : String(movement.qty);
      lot.receivedCbm = movement.cbm === null ? null : String(movement.cbm);
    }
    lots.set(movement.receiptLineId, lot);
  }
  return Array.from(lots.values()).flatMap((lot) => {
    const cartons = sumStockCounts(lot.cartons);
    if (!cartons || (compareStockCounts(cartons, 0) ?? 0) <= 0 || !lot.receivedCartons ||
      (compareStockCounts(lot.receivedCartons, 0) ?? 0) <= 0) return [];
    const qty = sumStockCounts(lot.qty);
    const cbm = sumStockCounts(lot.cbm);
    return [{
      receiptLineId: lot.receiptLineId,
      receiptId: lot.receiptId,
      receiptNo: lot.receiptNo,
      receivedAt: lot.receivedAt,
      product: lot.product,
      brand: lot.brand,
      cartons,
      qty: qty && stockCountSign(qty) !== 0 ? qty : null,
      cbm: cbm && stockCountSign(cbm) !== 0 ? cbm : null,
      receivedCartons: lot.receivedCartons,
      receivedQty: lot.receivedQty,
      receivedCbm: lot.receivedCbm,
    }];
  }).sort((left, right) => (left.receivedAt ?? '').localeCompare(right.receivedAt ?? ''));
}
