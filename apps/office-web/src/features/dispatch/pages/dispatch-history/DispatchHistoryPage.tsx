import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError } from '../../../../api/client';
import { useRecordFormat } from '../../../../shared/format-record';
import { DataTable, type RecordColumn } from '../../../../shared/ui/DataTable';
import { DateRangeFilter } from '../../../../shared/ui/DateRangeFilter';
import { FilterSelect } from '../../../../shared/ui/FilterSelect';
import { SearchField } from '../../../../shared/ui/ListControls';
import { RecordState } from '../../../../shared/ui/RecordState';
import { formatStockCount } from '../../../stock/stock-count';
import { useDispatches, useDispatchScope, type DispatchSummary } from '../../dispatch-api';
import styles from './DispatchHistoryPage.module.css';

const noDispatches: DispatchSummary[] = [];

function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DispatchHistoryPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const scope = useDispatchScope();
  const query = useDispatches(scope);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const rows = query.data ?? noDispatches;
  const volumeFormatter = useMemo(() => new Intl.NumberFormat(format.language, {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  }), [format.language]);
  const weightFormatter = useMemo(() => new Intl.NumberFormat(format.language, {
    minimumFractionDigits: 1, maximumFractionDigits: 3,
  }), [format.language]);

  const customers = useMemo(() => Array.from(new Map(rows.map((row) => [row.customerId, row])).values())
    .map((row) => ({
      value: row.customerId,
      label: [row.customerName, row.customerMark].filter(Boolean).join(' · ') || row.customerId,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, format.language)), [rows, format.language]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(format.language);
    return rows.filter((row) => {
      const matchesSearch = !needle || [row.dispatchNo, row.customerName, row.customerMark, row.destination]
        .some((value) => value?.toLocaleLowerCase(format.language).includes(needle));
      const dispatchedDate = localDateKey(row.dispatchedAt);
      return matchesSearch && (!customerId || row.customerId === customerId) &&
        (!fromDate || Boolean(dispatchedDate && dispatchedDate >= fromDate)) &&
        (!toDate || Boolean(dispatchedDate && dispatchedDate <= toDate));
    });
  }, [rows, search, customerId, fromDate, toDate, format.language]);

  const columns: RecordColumn<DispatchSummary>[] = [
    { id: 'dispatchNo', header: t('dispatchNo'), cell: ({ row }) => (
      <Link className={'record-link ' + styles.dispatchCode} to={'/dispatch/' + encodeURIComponent(row.original.id)}>
        <bdi>{row.original.dispatchNo}</bdi>
      </Link>
    ) },
    { id: 'dispatchedAt', header: t('dispatchedAt'), cell: ({ row }) => (
      <bdi className={styles.timestamp}><time dateTime={row.original.dispatchedAt}>
        {format.dateTime(row.original.dispatchedAt)}
      </time></bdi>
    ) },
    { id: 'customer', header: `${t('customer')} / ${t('shippingMark')}`, cell: ({ row }) => (
      <><bdi>{row.original.customerName || '—'}</bdi>
        {row.original.customerMark && <bdi className="secondary-line">{row.original.customerMark}</bdi>}</>
    ) },
    { id: 'destination', header: t('destination'), cell: ({ row }) => <bdi>{row.original.destination || '—'}</bdi> },
    { id: 'cartons', header: t('cartons'), cell: ({ row }) => (
      <bdi dir="ltr" className={styles.numeric}>{formatStockCount(row.original.cartons, format.language)}</bdi>
    ) },
    { id: 'cbm', header: t('volume'), cell: ({ row }) => (
      <bdi dir="ltr" className={styles.numeric}>{row.original.cbm === null ? '—' : volumeFormatter.format(row.original.cbm)}</bdi>
    ) },
    { id: 'weightKg', header: t('weightKg'), cell: ({ row }) => (
      <bdi dir="ltr" className={styles.numeric}>{row.original.weightKg === null ? '—' : weightFormatter.format(row.original.weightKg)}</bdi>
    ) },
    { id: 'open', header: () => <span className="sr-only">{t('dispatchDetails')}</span>, cell: ({ row }) => (
      <Link className="icon-button" tabIndex={-1} to={'/dispatch/' + encodeURIComponent(row.original.id)}
        aria-label={`${t('dispatchNo')}: ${row.original.dispatchNo}`}>
        <ChevronRight className="rtl-icon" size={16} aria-hidden="true" />
      </Link>
    ) },
  ];
  const hasFilters = Boolean(search.trim() || customerId || fromDate || toDate);
  const unavailable = query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const clearFilters = () => {
    setSearch('');
    setCustomerId('');
    setFromDate('');
    setToDate('');
  };

  return (
    <>
      <div className="workspace-heading">
        <h1>{t('dispatchHistory')}</h1>
      </div>
      <section className="surface workspace-panel" aria-label={t('dispatchHistory')} aria-busy={query.isFetching}>
        {!scope.canRead || !scope.warehouseId ? (
          <RecordState state={scope.active.title === 'loadingWarehouse' ? 'loading' : 'error'}
            message={t(scope.active.message ?? scope.active.title)} action={scope.active.retry} />
        ) : query.isError ? (
          <RecordState state="error" message={unavailable ? t('dispatchUnavailable') : undefined}
            action={unavailable ? undefined : () => { void query.refetch(); }} />
        ) : !query.data ? (
          <RecordState state="loading" />
        ) : <>
          {query.isFetching && <span className="sr-only" role="status">{t('loadingRecords')}</span>}
          <div className={'table-toolbar ' + styles.toolbar}>
            <SearchField label={t('searchDispatches')} value={search} onChange={setSearch} />
            <div className="workspace-actions">
              <FilterSelect label={t('allCustomers')} value={customerId} onChange={setCustomerId}
                options={[{ value: '', label: t('allCustomers') }, ...customers]} />
              <DateRangeFilter label={t('dispatchDate')} from={fromDate} to={toDate}
                onFromChange={setFromDate} onToChange={setToDate} />
            </div>
          </div>
          {filtered.length ? (
            <div className={styles.tableWrap}><DataTable records={filtered} columns={columns} label={t('dispatchHistory')} /></div>
          ) : rows.length || hasFilters ? (
            <RecordState state="noResults" action={clearFilters} />
          ) : (
            <RecordState state="empty" message={t('noDispatches')} />
          )}
          <p className={styles.limitNote}>{t('dispatchLimitNote')}</p>
        </>}
      </section>
    </>
  );
}
