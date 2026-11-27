import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRecordFormat } from '../../../../shared/format-record';
import { DataTable, type RecordColumn } from '../../../../shared/ui/DataTable';
import { LabeledField } from '../../../../shared/ui/LabeledField';
import { ListTabs, SearchField } from '../../../../shared/ui/ListControls';
import { FilterSelect } from '../../../../shared/ui/FilterSelect';
import { RecordState } from '../../../../shared/ui/RecordState';
import { partyName, useCatalog } from '../../../catalog/catalog-api';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';
import { OrderAmount } from '../../components/OrderSummary';
import { OrderWorkspaceState } from '../../components/OrderWorkspaceState';
import styles from '../../components/OrderWorkspace.module.css';
import { orderStatuses, useOrders, useOrderScope, type OrderRow, type OrderStatus } from '../../order-api';

const noOrders: OrderRow[] = [];
type FilterStatus = OrderStatus | 'all';

export default function OrderListPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const scope = useOrderScope();
  const orders = useOrders(scope);
  const catalog = useCatalog();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [supplierId, setSupplierId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [oldestFirst, setOldestFirst] = useState(false);
  const rows = orders.data ?? noOrders;
  const parties = useMemo(() => new Map(catalog.data?.parties.map((party) => [party.id, party])), [catalog.data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(format.language);
    return rows.filter((order) => {
      const supplier = parties.get(order.supplierId);
      const customer = parties.get(order.customerId);
      const matchesSearch = !needle || [order.orderNo, supplier?.name, supplier?.nameCn,
        customer?.name, customer?.nameCn, customer?.shippingMark]
        .some((value) => value?.toLocaleLowerCase(format.language).includes(needle));
      return matchesSearch && (status === 'all' || status === order.status) &&
        (!supplierId || supplierId === order.supplierId) &&
        (!fromDate || Boolean(order.orderDate && order.orderDate >= fromDate)) &&
        (!toDate || Boolean(order.orderDate && order.orderDate <= toDate));
    }).sort((left, right) => {
      if (!left.orderDate || !right.orderDate) return Number(!left.orderDate) - Number(!right.orderDate);
      return oldestFirst ? left.orderDate.localeCompare(right.orderDate) : right.orderDate.localeCompare(left.orderDate);
    });
  }, [rows, parties, search, status, supplierId, fromDate, toDate, oldestFirst, format.language]);
  const DateArrow = oldestFirst ? ArrowUp : ArrowDown;
  const columns: RecordColumn<OrderRow>[] = [
    { id: 'number', header: t('orderNo'), cell: ({ row }) => (
      <Link className={'record-link ' + styles.orderCode} to={'/orders/' + row.original.id}><bdi>{row.original.orderNo}</bdi></Link>
    ) },
    { id: 'supplier', header: t('supplier'), cell: ({ row }) => (
      <bdi>{partyName(parties.get(row.original.supplierId), format.language) || '—'}</bdi>
    ) },
    { id: 'customer', header: t('customer'), cell: ({ row }) => {
      const party = parties.get(row.original.customerId);
      return <><bdi>{partyName(party, format.language) || '—'}</bdi>
        {party?.shippingMark && <bdi className="secondary-line">{party.shippingMark}</bdi>}</>;
    } },
    { id: 'date', header: () => (
      <button type="button" className={styles.sortButton} aria-label={t(oldestFirst ? 'newestFirst' : 'oldestFirst')}
        onClick={() => setOldestFirst((current) => !current)}>
        {t('orderDate')}<DateArrow size={13} aria-hidden="true" />
      </button>
    ), cell: ({ row }) => <bdi>{format.date(row.original.orderDate)}</bdi> },
    { id: 'expected', header: t('expectedDate'), cell: ({ row }) => <bdi>{format.date(row.original.expectedDate)}</bdi> },
    { id: 'total', header: t('total'), cell: ({ row }) => (
      <OrderAmount currency={row.original.currency} amount={row.original.totalAmount} />
    ) },
    { id: 'status', header: t('status'), cell: ({ row }) => <OrderStatusBadge status={row.original.status} /> },
    { id: 'open', header: () => <span className="sr-only">{t('orderDetails')}</span>, cell: ({ row }) => (
      <Link className="icon-button" tabIndex={-1} to={'/orders/' + row.original.id}
        aria-label={t('openOrder', { order: row.original.orderNo })}>
        <ChevronRight className="rtl-icon" size={16} aria-hidden="true" />
      </Link>
    ) },
  ];
  const tabs = [
    { id: 'all' as const, name: t('allOrders'), count: rows.length },
    ...orderStatuses.map((item) => ({ id: item, name: t(item), count: rows.filter((row) => row.status === item).length })),
  ];
  function clear() {
    setSearch(''); setStatus('all'); setSupplierId(''); setFromDate(''); setToDate('');
  }

  return (
    <>
      <div className="workspace-heading">
        <h1>{t('purchaseOrders')}</h1>
        {scope.warehouseId && <Link to="/orders/new" className="button button-primary">
          <Plus size={16} aria-hidden="true" />{t('newPurchaseOrder')}
        </Link>}
      </div>
      {scope.canRead && !scope.warehouseId &&
        <p className={'surface muted-text ' + styles.notice}>{t('warehouseRequired')}</p>}
      <section className="surface workspace-panel" aria-label={t('purchaseOrders')}>
        {!scope.canRead ? <OrderWorkspaceState active={scope.active} /> :
          orders.isError || catalog.isError ? <RecordState state="error" action={() => {
            if (orders.isError) void orders.refetch();
            if (catalog.isError) void catalog.refetch();
          }} /> : !orders.data || !catalog.data ? <RecordState state="loading" /> : <>
            <ListTabs items={tabs} selected={status} onChange={setStatus} label={t('status')} />
            <div className="table-toolbar">
              <SearchField label={t('searchOrders')} value={search} onChange={setSearch} />
              <div className="workspace-actions">
                <FilterSelect label={t('supplier')} value={supplierId} onChange={setSupplierId}
                  options={[{ value: '', label: t('allSuppliers') }, ...catalog.data.parties
                    .filter((party) => party.type === 'supplier')
                    .map((party) => ({ value: party.id, label: partyName(party, format.language) }))]} />
                <Popover.Root>
                  <Popover.Trigger className="button">
                    <CalendarDays size={16} aria-hidden="true" />{t('orderDate')}<ChevronDown size={14} aria-hidden="true" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className={'menu-content ' + styles.dates} align="end" sideOffset={8} aria-label={t('orderDate')}>
                      <LabeledField label={t('fromDate')}>
                        {(props) => <input {...props} type="date" value={fromDate} max={toDate || undefined}
                          onChange={(event) => setFromDate(event.currentTarget.value)} />}
                      </LabeledField>
                      <LabeledField label={t('toDate')}>
                        {(props) => <input {...props} type="date" value={toDate} min={fromDate || undefined}
                          onChange={(event) => setToDate(event.currentTarget.value)} />}
                      </LabeledField>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>
            {filtered.length ? <DataTable records={filtered} columns={columns} label={t('purchaseOrders')} /> :
              rows.length ? <RecordState state="noResults" action={clear} /> :
                <RecordState state="empty" message={t('noOrders')} />}
          </>}
      </section>
    </>
  );
}
