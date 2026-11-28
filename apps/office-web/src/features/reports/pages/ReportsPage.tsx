import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Info, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { officeLanguage } from '../../../app/i18n';
import { useWarehouseScope, type WarehouseScope } from '../../../app/use-warehouse-scope';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { WarehouseState } from '../../../shared/ui/WarehouseState';
import { useRecordFormat } from '../../../shared/format-record';
import { partyName, useParties } from '../../catalog/catalog-api';
import { useOrders } from '../../orders/order-api';
import { ReportBuilder } from '../components/ReportBuilder';
import { downloadExport, useExportHistory } from '../exports-api';
import { exportStatuses, reportDefinitions, reportFilters, reportKinds, type ExportJob, type ReportKind } from '../report-types';
import styles from './ReportsPage.module.css';

export default function ReportsPage() {
  const { t } = useTranslation();
  const scope = useWarehouseScope();
  const [params] = useSearchParams();
  const requestedKind = params.get('kind') as ReportKind;
  const kind = reportKinds.includes(requestedKind) ? requestedKind : 'goods_dispatched';
  return <>
    <div className="workspace-heading"><h1>{t('reportsExports')}</h1></div>
    {scope.warehouseId ? <div className={styles.layout} key={scope.queryKey('reports').join('/')}>
      <ReportBuilder key={params.toString()} scope={scope} initialKind={kind}
        initialFilters={reportFilters(kind, Object.fromEntries(params))} />
      <ExportHistory scope={scope} />
    </div> : <section className="surface workspace-panel"><WarehouseState active={scope.active} /></section>}
  </>;
}

function ExportHistory({ scope }: { scope: WarehouseScope }) {
  const { t, i18n } = useTranslation();
  const format = useRecordFormat();
  const query = useExportHistory(scope);
  const parties = useParties();
  const orders = useOrders(scope, Boolean(query.data?.exports.some(job => job.filters.orderId)));
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState<ExportJob>();
  const [downloading, setDownloading] = useState<string>();
  const [downloadError, setDownloadError] = useState(false);
  const activeDownload = useRef<AbortController | null>(null);
  useEffect(() => () => activeDownload.current?.abort(), []);

  const rows = useMemo(() => query.data?.exports.filter(job => !status || job.status === status) ?? [],
    [query.data, status]);
  const language = officeLanguage(i18n.resolvedLanguage);
  const names = new Map(parties.data?.map(party => [party.id, partyName(party, language)]));
  const orderNumbers = new Map(orders.data?.map(order => [order.id, order.orderNo]));

  async function download(job: ExportJob) {
    if (activeDownload.current) return;
    const controller = new AbortController();
    activeDownload.current = controller;
    setDownloading(job.id);
    setDownloadError(false);
    try { await downloadExport(job, controller.signal); }
    catch { if (!controller.signal.aborted) setDownloadError(true); }
    finally {
      activeDownload.current = null;
      if (!controller.signal.aborted) setDownloading(undefined);
    }
  }

  const columns: RecordColumn<ExportJob>[] = [
    { id: 'report', header: t('reportType'), cell: ({ row }) => t(reportDefinitions[row.original.kind]?.label ?? 'reportType') },
    { id: 'filters', header: t('reportFilters'), cell: ({ row }) => {
      const { from, to, customerId, supplierId, orderId } = row.original.filters;
      const labels = [
        from && t('reportFilterValue', { label: t('fromDate'), value: format.date(from) }),
        to && t('reportFilterValue', { label: t('toDate'), value: format.date(to) }),
        customerId && t('reportFilterValue', { label: t('customer'), value: names.get(customerId) || customerId }),
        supplierId && t('reportFilterValue', { label: t('supplier'), value: names.get(supplierId) || supplierId }),
        orderId && t('reportFilterValue', { label: t('reportOrder'), value: orderNumbers.get(orderId) || orderId }),
      ].filter(Boolean);
      return labels.length ? <div className={styles.summary}>{labels.map(label => <bdi key={label}>{label}</bdi>)}</div> : t('reportNoFilters');
    } },
    { id: 'requested', header: t('reportRequestedAt'), cell: ({ row }) => format.dateTime(row.original.createdAt) },
    { id: 'status', header: t('status'), cell: ({ row }) =>
      <span className={styles.badge} data-status={row.original.status}>{t('exportStatus.' + row.original.status)}</span> },
    { id: 'actions', header: t('actions'), cell: ({ row: { original: job } }) => {
      if (job.status === 'failed') return <button className="button" onClick={() => setFailed(job)}>
        <Info size={15} aria-hidden="true" />{t('reportViewError')}
      </button>;
      if (job.status === 'completed') return <button className="button" disabled={Boolean(downloading)} onClick={() => void download(job)}>
        <Download size={15} aria-hidden="true" />{t(downloading === job.id ? 'reportDownloading' : 'download')}
      </button>;
      return '—';
    } },
  ];

  return <section className={'surface workspace-panel ' + styles.history}>
    <div className={styles.historyHeading}>
      <h2>{t('reportHistory')}</h2>
      <div className="workspace-actions">
        <FilterSelect label={t('status')} value={status} onChange={setStatus} options={[
          { value: '', label: t('allStatuses') },
          ...exportStatuses.map(value => ({ value, label: t('exportStatus.' + value) })),
        ]} />
        <button className="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw size={15} aria-hidden="true" />{t('reportRefresh')}
        </button>
      </div>
    </div>
    {downloadError && <p className={'field-error ' + styles.notice} role="alert">{t('reportDownloadError')}</p>}
    <div className={styles.historyBody}><QueryState query={query}>
      {rows.length ? <DataTable key={status} records={rows} columns={columns} label={t('reportHistory')} /> :
        <RecordState state={status ? 'noResults' : 'empty'} message={t(status ? 'noResults' : 'reportEmpty')}
          action={status ? () => setStatus('') : undefined} />}
    </QueryState></div>
    {query.data?.exports.length === 100 && <p className={'muted-text ' + styles.notice}>{t('reportHistoryLimit')}</p>}
    {failed && <OfficeDialog title={t('reportViewError')} onClose={() => setFailed(undefined)}>
      <div className="office-dialog-body">
        <strong>{t(reportDefinitions[failed.kind]?.label ?? 'reportType')}</strong>
        <p>{t('reportJobFailed')}</p>
      </div>
      <div className="office-dialog-actions"><button className="button" onClick={() => setFailed(undefined)}>{t('close')}</button></div>
    </OfficeDialog>}
  </section>;
}
