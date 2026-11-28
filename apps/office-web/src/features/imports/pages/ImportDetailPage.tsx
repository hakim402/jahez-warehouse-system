import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useWarehouseScope, type WarehouseScope } from '../../../app/use-warehouse-scope';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { WarehouseState } from '../../../shared/ui/WarehouseState';
import { InvoiceReviewForm } from '../components/InvoiceReviewForm';
import { InvoiceSource } from '../components/InvoiceSource';
import { enqueueImport, importedRecordPath, listImports, useImport, type InvoiceImport } from '../imports-api';
import styles from './Imports.module.css';

export default function ImportDetailPage() {
  const { t } = useTranslation();
  const scope = useWarehouseScope();
  const { importId = '' } = useParams();
  return <>
    <Link className="button" to="/imports">{t('invoiceImports')}</Link>
    {scope.warehouseId ? <ImportDetail key={scope.queryKey('import', importId).join('/')} scope={scope} id={importId} /> :
      <section className="surface workspace-panel"><WarehouseState active={scope.active} /></section>}
  </>;
}

function ImportDetail({ scope, id }: { scope: WarehouseScope; id: string }) {
  const { t } = useTranslation();
  const query = useImport(scope, id);
  const item = query.data;
  const manual = item?.kind === 'expense' ? '/expenses?record=1' : '/orders/new';
  const source = item && <InvoiceSource scope={scope} fileId={item.sourceFileId} />;
  return <QueryState query={query}>
    {item?.status === 'draft' ? <InvoiceReviewForm item={item} scope={scope} source={source} /> : item &&
      <>
        <div className="workspace-heading"><h1>{t('importReviewTitle')}</h1></div>
        <div className={styles.split}>
          {source}
          <section className={'surface ' + styles.panel}>
            <h2>{t('importStatus.' + item.status)}</h2>
            {item.status === 'queued' || item.status === 'processing' ? <RecordState state="loading" message={t('importWaiting')} /> : null}
            {item.status === 'failed' && <p className="field-error" role="alert">{t('importFailed')}</p>}
            <div className="workspace-actions">
              {item.status === 'committed' && item.committedEntityId &&
                <Link className="button button-primary" to={importedRecordPath(item.kind, item.committedEntityId)}>{t('importOpenRecord')}</Link>}
              {item.status === 'failed' && <RetryImport scope={scope} item={item} />}
              {item.status !== 'committed' && <Link className="button" to={manual}>{t('importManual')}</Link>}
            </div>
          </section>
        </div>
      </>}
    {item?.status === 'draft' && <div className={styles.manual}>
      <Link className="button" to={manual}>{t('importManual')}</Link>
    </div>}
  </QueryState>;
}

function RetryImport({ scope, item }: { scope: WarehouseScope; item: InvoiceImport }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);

  async function retry() {
    if (running.current || !scope.warehouseId) return;
    running.current = true;
    setBusy(true);
    setFailure(false);
    try {
      const history = await listImports(scope.warehouseId);
      const existing = history.find(job => job.id !== item.id && job.kind === item.kind &&
        job.sourceFileId === item.sourceFileId && job.status !== 'failed');
      const job = existing ?? await enqueueImport(scope.warehouseId, item.kind, item.sourceFileId);
      void navigate('/imports/' + encodeURIComponent(job.id), { replace: true });
    } catch {
      setFailure(true);
    } finally {
      void cache.invalidateQueries({ queryKey: scope.queryKey('imports') });
      running.current = false;
      setBusy(false);
    }
  }

  return <>
    <button className="button button-primary" disabled={busy} onClick={() => void retry()}>{t(busy ? 'saving' : 'retry')}</button>
    {failure && <p className="field-error" role="alert">{t('importEnqueueError')}</p>}
  </>;
}
