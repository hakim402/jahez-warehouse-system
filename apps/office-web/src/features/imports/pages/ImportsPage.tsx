import { ChevronRight, FileText, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useWarehouseScope, type WarehouseScope } from '../../../app/use-warehouse-scope';
import { useRecordFormat } from '../../../shared/format-record';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { ClearFilters, SearchField } from '../../../shared/ui/ListControls';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { WarehouseState } from '../../../shared/ui/WarehouseState';
import { listOfficeFiles } from '../../files/files-api';
import { ImportDialog } from '../components/ImportDialog';
import { importedRecordPath, importKinds, importStatuses, uploadPurpose, useImports, type InvoiceImport } from '../imports-api';
import styles from './Imports.module.css';

export default function ImportsPage() {
  const scope = useWarehouseScope();
  const { t } = useTranslation();
  return scope.warehouseId ? <ImportHistory key={scope.queryKey('imports').join('/')} scope={scope} /> : <>
    <div className="workspace-heading"><h1>{t('invoiceImports')}</h1></div>
    <section className="surface workspace-panel"><WarehouseState active={scope.active} /></section>
  </>;
}

function ImportHistory({ scope }: { scope: WarehouseScope }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const [upload, setUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const history = useImports(scope);
  const sources = useQuery({
    queryKey: scope.queryKey('import-files'),
    queryFn: async ({ signal }) => {
      const groups = await Promise.allSettled(importKinds.map(value =>
        listOfficeFiles(scope.warehouseId!, { purpose: uploadPurpose[value] }, signal),
      ));
      if (groups.every(group => group.status === 'rejected')) throw groups[0].reason;
      return groups.flatMap(group => group.status === 'fulfilled' && group.value.warehouseId === scope.warehouseId
        ? group.value.files : []);
    },
  });
  const files = useMemo(() => new Map(sources.data?.map(file => [file.id, file])), [sources.data]);
  const records = useMemo(() => history.data?.filter(item => (!kind || kind === item.kind) &&
    (!status || status === item.status) &&
    (!search.trim() || (files.get(item.sourceFileId)?.originalName ?? '').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  ) ?? [], [history.data, files, kind, status, search]);
  const clear = () => { setSearch(''); setKind(''); setStatus(''); };
  const filtered = Boolean(search || kind || status);
  const columns: RecordColumn<InvoiceImport>[] = [
    { id: 'file', header: t('importSource'), cell: ({ row }) => {
      const file = files.get(row.original.sourceFileId);
      return <div className={styles.file}><FileText size={18} aria-hidden="true" /><span>
        <strong><bdi>{file?.originalName || t('importSource')}</bdi></strong>
        {file && <small>{t('importFileSize', { value: format.quantity(Math.ceil(file.sizeBytes / 1024)) })}</small>}
      </span></div>;
    } },
    { id: 'kind', header: t('importType'), cell: ({ row }) => t('importKind.' + row.original.kind) },
    { id: 'created', header: t('importUploaded'), cell: ({ row }) => format.dateTime(row.original.createdAt) },
    { id: 'status', header: t('status'), cell: ({ row }) =>
      <span className={styles.badge} data-status={row.original.status}>{t('importStatus.' + row.original.status)}</span> },
    { id: 'action', header: t('actions'), cell: ({ row: { original: item } }) => {
      if (item.status === 'committed' && item.committedEntityId) {
        return <Link className="button" to={importedRecordPath(item.kind, item.committedEntityId)}>{t('importOpenRecord')}</Link>;
      }
      const detail = '/imports/' + encodeURIComponent(item.id);
      if (item.status === 'queued' || item.status === 'processing') {
        return <Link className={'record-link ' + styles.statusLink} to={detail}>
          {t('importViewStatus')}<ChevronRight className="rtl-icon" size={14} aria-hidden="true" />
        </Link>;
      }
      return <Link className="button" to={detail}>
        {t(item.status === 'draft' ? 'importReview' : item.status === 'failed' ? 'reportViewError' : 'importViewStatus')}
      </Link>;
    } },
  ];
  return <>
    <div className="workspace-heading"><h1>{t('invoiceImports')}</h1>
      <button className="button button-primary" onClick={() => setUpload(true)}><Upload size={16} aria-hidden="true" />{t('importInvoice')}</button>
    </div>
    <section className={'surface workspace-panel ' + styles.history}>
      <div className="table-toolbar">
        <SearchField label={t('importSearch')} value={search} onChange={setSearch} />
        <div className="workspace-actions">
          <FilterSelect label={t('importType')} value={kind} onChange={setKind} options={[
            { value: '', label: t('importAllTypes') }, ...importKinds.map(value => ({ value, label: t('importKind.' + value) })),
          ]} />
          <FilterSelect label={t('status')} value={status} onChange={setStatus} options={[
            { value: '', label: t('allStatuses') }, ...importStatuses.map(value => ({ value, label: t('importStatus.' + value) })),
          ]} />
          {filtered && <ClearFilters onClear={clear} />}
        </div>
      </div>
      {sources.isError && <p className="query-warning">{t('importMetadataError')} <button className="button" onClick={() => void sources.refetch()}>{t('retry')}</button></p>}
      <div className={styles.historyBody}><QueryState query={history}>
        {records.length ? <DataTable key={[kind, status, search].join('|')} records={records} columns={columns} label={t('invoiceImports')} /> :
          <RecordState state={filtered ? 'noResults' : 'empty'} action={filtered ? clear : undefined} />}
      </QueryState></div>
      {history.data?.length === 100 && <p className={'muted-text ' + styles.notice}>{t('importHistoryLimit')}</p>}
    </section>
    {upload && <ImportDialog scope={scope} onClose={() => setUpload(false)} />}
  </>;
}
