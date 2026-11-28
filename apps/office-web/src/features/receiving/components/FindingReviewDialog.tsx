import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError } from '../../../api/client';
import { useRecordFormat } from '../../../shared/format-record';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { RecordState } from '../../../shared/ui/RecordState';
import { productName, useCatalog } from '../../catalog/catalog-api';
import type { useOrderScope } from '../../orders/order-api';
import { formatStockCount } from '../../stock/stock-count';
import { resolveFinding, useReceipt, useReceiptEvidence, type Finding } from '../receiving-api';
import { ReceiptEvidence } from './ReceiptEvidence';
import styles from './FindingReviewDialog.module.css';

export function FindingReviewDialog({ finding, scope, onClose }: {
  finding: Finding;
  scope: ReturnType<typeof useOrderScope>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const cache = useQueryClient();
  const receipt = useReceipt(scope, finding.receiptId);
  const evidence = useReceiptEvidence(scope, receipt.data);
  const catalog = useCatalog();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string>();
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const line = receipt.data?.lines.find((item) => item.id === finding.receiptLineId);
  const product = catalog.data?.products.find((item) => item.id === line?.productId);
  const mutation = useMutation({
    mutationFn: () => resolveFinding(finding.id, note.trim()),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['findings'] }),
        cache.invalidateQueries({ queryKey: ['receipt'] }),
        cache.invalidateQueries({ queryKey: ['receipt-files'] }),
        cache.invalidateQueries({ queryKey: ['warehouse-data'] }),
      ]);
      onClose();
    },
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) {
      setNoteError(t('resolutionNoteRequired'));
      noteRef.current?.focus();
      return;
    }
    setNoteError(undefined);
    mutation.mutate();
  };
  const error = mutation.error instanceof ApiError && mutation.error.status === 409
    ? t('conflict')
    : mutation.error instanceof ApiError && mutation.error.validationMessage || t('resolveFindingFailed');
  return <OfficeDialog title={t('reviewFinding')} onClose={onClose} busy={mutation.isPending} wide>
    <div className="office-dialog-body">
      <dl className={styles.details}>
        <div><dt>{t('discrepancyType')}</dt><dd>{t(finding.type)}</dd></div>
        <div><dt>{t('status')}</dt><dd>{t(finding.status)}</dd></div>
        <div><dt>{t('expected')}</dt><dd>{formatStockCount(finding.expected, format.language)}</dd></div>
        <div><dt>{t('actual')}</dt><dd>{formatStockCount(finding.actual, format.language)}</dd></div>
        <div><dt>{t('receipt')}</dt><dd>{receipt.data ? <Link className="record-link" to={'/receipts/' + receipt.data.id}>{receipt.data.receiptNo}</Link> : <span className="muted-text">{t('loadingRecords')}</span>}</dd></div>
        <div><dt>{t('receivedAt')}</dt><dd>{format.dateTime(receipt.data?.receivedAt ?? null)}</dd></div>
        <div><dt>{t('product')}</dt><dd>{productName(product, format.language) || line?.productId || '—'}</dd></div>
        <div><dt>{t('condition')}</dt><dd>{line ? t(line.condition) : '—'}</dd></div>
      </dl>
      <section className={styles.section} aria-labelledby="finding-evidence-title">
        <h3 id="finding-evidence-title">{t('photoEvidence')}</h3>
        {receipt.isError ? <RecordState state="error" action={() => { void receipt.refetch(); }} /> : <ReceiptEvidence
          scope={scope} files={evidence.data} loading={receipt.isLoading || evidence.isLoading}
          error={evidence.isError} retry={() => { void evidence.refetch(); }} />}
      </section>
      {finding.status === 'resolved' ? <section className={styles.section}><h3>{t('resolutionNote')}</h3><p>{finding.note || '—'}</p></section> : <form onSubmit={submit} noValidate>
        <LabeledField label={t('resolutionNote')} hint={t('required')} error={noteError}>
          {(attributes) => <textarea {...attributes} ref={noteRef} rows={4} maxLength={2000} value={note} disabled={mutation.isPending}
            onChange={(event) => { setNote(event.target.value); if (noteError) setNoteError(undefined); }} />}
        </LabeledField>
        {mutation.isError && <p className="field-error" role="alert">{error}</p>}
        <div className="office-dialog-actions">
          <button type="button" className="button" disabled={mutation.isPending} onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? t('saving') : t('resolveFinding')}</button>
        </div>
      </form>}
    </div>
  </OfficeDialog>;
}
