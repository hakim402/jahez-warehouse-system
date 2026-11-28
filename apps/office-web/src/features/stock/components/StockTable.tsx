import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useWarehouseScope } from '../../../app/use-warehouse-scope';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { RecordState } from '../../../shared/ui/RecordState';
import { ProductIdentity } from '../../../shared/ui/ProductIdentity';
import { useRecordFormat } from '../../../shared/format-record';
import { useProducts } from '../../catalog/catalog-api';
import { StockAdjustmentDialog } from './StockAdjustmentDialog';
import type { StockRow } from '../warehouse-api';
import { formatStockCount } from '../stock-count';

export function StockTable({ records, kind, onClear }: { records: StockRow[]; kind: 'balances' | 'movements' | 'age'; onClear?: () => void }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const scope = useWarehouseScope();
  const catalog = useProducts();
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const rows = records.map((row) => ({ ...row, id: row.id ?? JSON.stringify([
    kind, row.customerId, row.supplierId, row.brand, row.productId, row.receiptId, row.receiptNo, row.createdAt,
  ]) }));
  const columns: RecordColumn<StockRow & { id: string }>[] = [
    { id: 'product', header: t('product'), cell: ({ row }) => {
      const product = row.original.product;
      const catalogProduct = catalog.data?.find((item) => item.id === row.original.productId);
      return <ProductIdentity product={{ ...catalogProduct, ...product, modelNo: product.modelNo || catalogProduct?.modelNo }} />;
    } },
    { id: 'customer', header: t('customer'), cell: ({ row }) => <>{row.original.customerName || '—'}<bdi className="secondary-line">{row.original.customerMark}</bdi></> },
    { id: 'supplier', header: t('supplier'), cell: ({ row }) => row.original.supplierName || '—' },
    { id: 'brand', header: t('brand'), cell: ({ row }) => row.original.brand || '—' },
    { id: 'cartons', header: () => <span className="numeric-value">{t('cartons')}</span>, cell: ({ row }) => <bdi className="numeric-value">{formatStockCount(row.original.cartons, format.language)}</bdi> },
    { id: 'qty', header: () => <span className="numeric-value">{t('units')}</span>, cell: ({ row }) => <bdi className="numeric-value">{formatStockCount(row.original.qty, format.language)}</bdi> },
    { id: 'cbm', header: () => <span className="numeric-value">{t('volume')}</span>, cell: ({ row }) => <bdi className="numeric-value">{format.volume(row.original.cbm)}</bdi> },
  ];
  if (kind === 'age') columns.push({ id: 'age', header: t('daysInStorage'), cell: ({ row }) => <>{row.original.receiptNo}<span className="secondary-line">{row.original.daysInStorage}</span></> });
  if (kind === 'movements') {
    columns.unshift({ id: 'movement', header: t('movement'), cell: ({ row }) => <>{t(row.original.kind ?? 'movement')}<span className="secondary-line">{format.dateTime(row.original.createdAt ?? null)}</span></> });
    columns.push({ id: 'reference', header: t('reference'), cell: ({ row }) => {
      const movement = row.original;
      if (movement.adjustmentNo || movement.adjustmentReason) return <><bdi>{movement.adjustmentNo}</bdi><span className="secondary-line">{movement.adjustmentReason}</span></>;
      if (movement.receiptId) return <Link className="record-link" to={'/receipts/' + movement.receiptId}>{movement.receiptNo || t('viewReceipt')}</Link>;
      if (movement.dispatchId) return <Link className="record-link" to={'/dispatch/' + movement.dispatchId}>{movement.dispatchNo || t('dispatchDetails')}</Link>;
      return '—';
    } });
  }
  if (kind === 'balances') columns.push({ id: 'actions', header: t('actions'), cell: ({ row }) => <button type="button" className="button" data-stock-group={row.original.id} onClick={() => setAdjusting(row.original)}>{t('adjust')}</button> });
  return <>{rows.length ? <DataTable records={rows} columns={columns} label={t(kind === 'balances' ? 'inventory' : kind)} /> : <RecordState state={onClear ? "noResults" : "empty"} action={onClear} />}
    {adjusting && <StockAdjustmentDialog returnFocus={() => document.querySelector<HTMLButtonElement>('[data-stock-group="' + CSS.escape(adjusting.id!) + '"]')} stock={adjusting} scope={scope} onClose={() => setAdjusting(null)} />}</>;
}
