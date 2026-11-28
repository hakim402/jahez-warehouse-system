import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useWarehouseScope } from '../../../app/use-warehouse-scope';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { RecordState } from '../../../shared/ui/RecordState';
import { StatusBadge } from '../../../shared/ui/StatusBadge';
import { useRecordFormat } from '../../../shared/format-record';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { formatStockCount } from '../../stock/stock-count';
import { FindingReviewDialog } from './FindingReviewDialog';
import type { QueueOrder, Finding } from '../receiving-api';
import styles from './ReceivingTables.module.css';

export function QueueTable({ records, compact = false, onClear }: { records: QueueOrder[]; compact?: boolean; onClear?: () => void }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const columns: RecordColumn<QueueOrder>[] = [
    { id: 'order', header: t('orderNo'), cell: ({ row }) => <><Link className="record-link" to={'/orders/' + row.original.id}>{row.original.orderNo}</Link>{compact && <span className="secondary-line">{row.original.supplier.name}</span>}</> },
    ...(!compact ? [
      { id: 'supplier', header: t('supplier'), cell: ({ row }: { row: { original: QueueOrder } }) => <bdi>{row.original.supplier.name}</bdi> },
      { id: 'customer', header: t('customer'), cell: ({ row }: { row: { original: QueueOrder } }) => <><bdi>{row.original.customer.name}</bdi><bdi className="secondary-line">{row.original.customer.shippingMark}</bdi></> },
    ] : []),
    { id: 'date', header: t('expectedDate'), cell: ({ row }) => format.date(row.original.expectedDate) },
    ...(!compact ? [{ id: 'progress', header: t('cartonsReceived'), cell: ({ row }: { row: { original: QueueOrder } }) => {
      const order = row.original;
      const received = order.expectedCartons - order.remainingCartons;
      return <div className={styles.progress}><progress max={Math.max(1, order.expectedCartons)} value={received} />{format.quantity(received)} / {format.quantity(order.expectedCartons)}</div>;
    } }] : []),
    { id: 'remaining', header: t('cartonsLeft'), cell: ({ row }) => format.quantity(row.original.remainingCartons) },
    { id: 'status', header: t('status'), cell: ({ row }) => <OrderStatusBadge status={row.original.status} /> },
  ];
  return records.length ? <DataTable records={records} columns={columns} label={t('expectedDeliveries')} /> : <RecordState state={onClear ? "noResults" : "empty"} action={onClear} />;
}

export function FindingsTable({ records, onClear }: { records: Finding[]; onClear?: () => void }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const scope = useWarehouseScope();
  const [review, setReview] = useState<Finding | null>(null);
  const columns: RecordColumn<Finding>[] = [
    { id: 'type', header: t('discrepancyType'), cell: ({ row }) => t(row.original.type, { defaultValue: row.original.type }) },
    { id: 'receipt', header: t('receipt'), cell: ({ row }) => <Link className="record-link" to={'/receipts/' + row.original.receiptId}>{t('viewReceipt')}</Link> },
    { id: 'expected', header: t('expected'), cell: ({ row }) => formatStockCount(row.original.expected, format.language) },
    { id: 'actual', header: t('actual'), cell: ({ row }) => formatStockCount(row.original.actual, format.language) },
    { id: 'status', header: t('status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: 'actions', header: t('actions'), cell: ({ row }) => row.original.status === 'open'
      ? <button type="button" className="button" onClick={() => setReview(row.original)}>{t('review')}</button>
      : <span className="muted-text">{row.original.note || '—'}</span> },
  ];
  return <>{records.length ? <DataTable records={records} columns={columns} label={t('discrepancies')} /> : <RecordState state={onClear ? "noResults" : "empty"} action={onClear} />}
    {review && <FindingReviewDialog finding={review} scope={scope} onClose={() => setReview(null)} />}</>;
}
