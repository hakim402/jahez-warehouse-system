import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { WarehouseScope } from '../../../app/use-warehouse-scope';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { InvoiceField, validInvoiceFile } from '../../files/components/InvoiceField';
import { uploadOfficeFile } from '../../files/files-api';
import { enqueueImport, importKinds, listImports, uploadPurpose, type ImportKind } from '../imports-api';
import styles from '../pages/Imports.module.css';

export function ImportDialog({ scope, onClose }: { scope: WarehouseScope; onClose: () => void }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ImportKind>('purchase');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const upload = useRef<{ id: string; fileId?: string; enqueueAttempted?: boolean }>({ id: crypto.randomUUID() });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || !scope.warehouseId) return;
    if (!file) { setError('invoiceRequired'); return; }
    busyRef.current = true;
    setBusy(true);
    setError('');
    const attempt = upload.current;
    try {
      if (!attempt.fileId) {
        const source = await uploadOfficeFile({
          warehouseId: scope.warehouseId, uploadId: attempt.id, file, purpose: uploadPurpose[kind],
        });
        attempt.fileId = source.id;
        cache.setQueryData(scope.queryKey('file-metadata', source.id), source);
      }
      // Enqueue has no idempotency key. Reconcile a previous attempt before another POST.
      const existing = attempt.enqueueAttempted && (await listImports(scope.warehouseId))
        .find(item => item.sourceFileId === attempt.fileId && item.kind === kind);
      attempt.enqueueAttempted = true;
      const job = existing || await enqueueImport(scope.warehouseId, kind, attempt.fileId);
      onClose();
      void navigate('/imports/' + encodeURIComponent(job.id));
    } catch {
      setError(attempt.fileId ? 'importEnqueueError' : 'invoiceUploadFailed');
    } finally {
      void cache.invalidateQueries({ queryKey: scope.queryKey('imports') });
      void cache.invalidateQueries({ queryKey: scope.queryKey('import-files') });
      busyRef.current = false;
      setBusy(false);
    }
  }
  return <OfficeDialog title={t('importInvoice')} busy={busy} onClose={onClose}>
    <form onSubmit={submit}>
      <fieldset className={'office-dialog-body ' + styles.fields} disabled={busy}>
        <LabeledField label={t('importType')}>{props => <select {...props} value={kind}
          disabled={Boolean(upload.current.fileId)} onChange={event => {
            setKind(event.target.value as ImportKind);
            upload.current = { id: crypto.randomUUID() };
          }}>
          {importKinds.map(value => <option key={value} value={value}>{t('importKind.' + value)}</option>)}
        </select>}</LabeledField>
        <InvoiceField file={file} disabled={busy || Boolean(upload.current.fileId)} error={error && t(error)} onChange={next => {
          if (busyRef.current || upload.current.fileId) return;
          const invalid = next && !validInvoiceFile(next);
          setFile(invalid ? null : next);
          setError(invalid ? 'invoiceFileInvalid' : '');
          upload.current = { id: crypto.randomUUID() };
        }} />
      </fieldset>
      <div className="office-dialog-actions">
        <button type="button" className="button" disabled={busy} onClick={onClose}>{t('cancel')}</button>
        <button type="submit" className="button button-primary" disabled={busy}>{t(busy ? 'saving' : 'importInvoice')}</button>
      </div>
    </form>
  </OfficeDialog>;
}
