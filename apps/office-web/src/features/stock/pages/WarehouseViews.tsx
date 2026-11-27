import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { ListTabs, SearchField } from '../../../shared/ui/ListControls';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { RecordState } from '../../../shared/ui/RecordState';
import { useRecordFormat } from '../../../shared/format-record';
import { OrderWorkspaceState } from '../../orders/components/OrderWorkspaceState';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { exactCount, useWarehouseData, type StockRow, type QueueOrder, type Finding } from '../warehouse-api';
import styles from './WarehouseViews.module.css';

type WarehouseData = ReturnType<typeof useWarehouseData>;
export function WarehouseGate({ data, children }: { data: WarehouseData; children: ReactNode }) {
  const { t } = useTranslation();
  if (!data.scope.warehouseId) return <OrderWorkspaceState active={data.scope.active} />;
  if (data.query.isError) return <RecordState state="error" action={() => { void data.query.refetch(); }} />;
  if (!data.query.data) return <RecordState state="loading" />;
  return <>{data.query.isFetching && <span className="sr-only" role="status">{t('loadingRecords')}</span>}{children}</>;
}

export function QueueTable({ records, compact = false }: { records: QueueOrder[]; compact?: boolean }) {
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
  return records.length ? <DataTable records={records} columns={columns} label={t('expectedDeliveries')} /> : <RecordState state="empty" />;
}

export function FindingsTable({ records }: { records: Finding[] }) {
  const { t } = useTranslation();
  const columns: RecordColumn<Finding>[] = [
    { id: 'type', header: t('discrepancies'), cell: ({ row }) => t(row.original.type, { defaultValue: row.original.type }) },
    { id: 'receipt', header: t('receipt'), cell: ({ row }) => <bdi>{row.original.receiptId}</bdi> },
    { id: 'expected', header: t('expected'), cell: ({ row }) => row.original.expected ?? '—' },
    { id: 'actual', header: t('actual'), cell: ({ row }) => row.original.actual ?? '—' },
  ];
  return records.length ? <DataTable records={records} columns={columns} label={t('discrepancies')} /> : <RecordState state="empty" />;
}


export function StockTable({ records, kind }: { records: StockRow[]; kind: 'balances' | 'movements' | 'age' }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const rows = records.map((row, index) => ({ ...row, id: String(index) }));
  const columns: RecordColumn<StockRow & { id: string }>[] = [
    { id: 'product', header: t('product'), cell: ({ row }) => {
      const product = row.original.product;
      const name = format.language === 'ar' ? product.nameAr : format.language === 'zh-Hans' ? product.nameCn : product.nameEn;
      return <bdi>{name || product.nameEn || product.nameCn || product.nameAr || '—'}</bdi>;
    } },
    { id: 'customer', header: t('customer'), cell: ({ row }) => <>{row.original.customerName || '—'}<bdi className="secondary-line">{row.original.customerMark}</bdi></> },
    { id: 'supplier', header: t('supplier'), cell: ({ row }) => row.original.supplierName || '—' },
    { id: 'brand', header: t('brand'), cell: ({ row }) => row.original.brand || '—' },
    { id: 'cartons', header: t('cartons'), cell: ({ row }) => exactCount(row.original.cartons, format.language) },
    { id: 'qty', header: t('units'), cell: ({ row }) => exactCount(row.original.qty, format.language) },
    { id: 'cbm', header: t('volume'), cell: ({ row }) => row.original.cbm === null ? '—' : new Intl.NumberFormat(format.language, { maximumFractionDigits: 3 }).format(row.original.cbm) },
  ];
  if (kind === 'age') columns.push({ id: 'age', header: t('daysInStorage'), cell: ({ row }) => <>{row.original.receiptNo}<span className="secondary-line">{row.original.daysInStorage}</span></> });
  if (kind === 'movements') columns.unshift({ id: 'movement', header: t('movement'), cell: ({ row }) => <>{t(row.original.kind ?? 'movement')}<span className="secondary-line">{row.original.createdAt ? new Date(row.original.createdAt).toLocaleString(format.language) : '—'}</span></> });
  return rows.length ? <DataTable records={rows} columns={columns} label={t(kind === 'balances' ? 'inventory' : kind)} /> : <RecordState state="empty" />;
}

export function InventoryPage() {
  const { t } = useTranslation();
  const data = useWarehouseData();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab = requestedTab === 'movements' || requestedTab === 'age' ? requestedTab : 'balances';
  const setTab = (value: string) => setParams(value === 'balances' ? {} : { tab: value });
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [supplier, setSupplier] = useState('');
  const [brand, setBrand] = useState('');
  const balances = data.query.data?.balances ?? [];
  const records = tab === 'movements' ? data.movements.data?.pages.flatMap((page) => page.movements) ?? [] : tab === 'age' ? data.query.data?.age ?? [] : balances;
  const filtered = records.filter((row) => (!customer || customer === row.customerMark) && (!supplier || supplier === row.supplierName) && (!brand || brand === row.brand) &&
    Object.values(row.product).some((value) => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  return <><div className="workspace-heading"><h1>{t('inventory')}</h1></div><section className="surface workspace-panel"><WarehouseGate data={data}>
    <ListTabs selected={tab} onChange={setTab} label={t('inventory')} items={(['balances', 'movements', 'age'] as const).map((id) => ({ id, name: t(id), count: id === 'movements' ? records.length : data.query.data?.[id].length ?? 0 }))} />
    <div className="table-toolbar"><SearchField label={t('searchProducts')} value={search} onChange={setSearch} /><div className="workspace-actions">
      {([{ key: 'customerMark', label: 'shippingMark', value: customer, set: setCustomer }, { key: 'supplierName', label: 'supplier', value: supplier, set: setSupplier }, { key: 'brand', label: 'brand', value: brand, set: setBrand }] as const).map((filter) =>
        <FilterSelect key={filter.key} label={t(filter.label)} value={filter.value} onChange={filter.set}
          options={[{ value: '', label: t(filter.label) }, ...Array.from(new Set(records.map((row) => row[filter.key]).filter(Boolean)))
            .map((value) => ({ value: value!, label: value! }))]} />)}
    </div></div>
    {tab === 'movements' && data.movements.isError ? <RecordState state="error" action={() => { void data.movements.refetch(); }} /> : tab === 'movements' && !data.movements.data ? <RecordState state="loading" /> : <StockTable key={tab} records={filtered} kind={tab} />}
    {tab === 'movements' && data.movements.hasNextPage && <div className="table-footer"><button className="button" disabled={data.movements.isFetchingNextPage} onClick={() => void data.movements.fetchNextPage()}>{t('loadMore')}</button></div>}
    </WarehouseGate></section></>;
}
