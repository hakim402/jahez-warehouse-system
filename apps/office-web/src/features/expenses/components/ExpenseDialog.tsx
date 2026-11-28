import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../api/client';
import type { WarehouseScope } from '../../../app/use-warehouse-scope';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { useRecordFormat } from '../../../shared/format-record';
import { partyName, useCatalog } from '../../catalog/catalog-api';
import { uploadOfficeFile, type OfficeFile } from '../../files/files-api';
import { useOrders } from '../../orders/order-api';
import { categoryName, recordExpense, useExpenseCategories, type ExpenseInput } from '../expenses-api';
import { expenseAmount, validExpenseDate } from '../expense-validation';
import { InvoiceField, invoiceTypes } from './InvoiceField';
import styles from './ExpenseDialog.module.css';

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function ExpenseDialog({ scope, onClose }: { scope: WarehouseScope; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const cache = useQueryClient();
  const categories = useExpenseCategories();
  const catalog = useCatalog();
  const orders = useOrders(scope);
  const [form, setForm] = useState({ amount: '', currency: 'CNY', expenseDate: today(), categoryId: '', customerId: '', orderId: '', noInvoiceNote: '' });
  const [mode, setMode] = useState<'invoice' | 'exception'>('invoice');
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<OfficeFile>();
  const uploadId = useRef(crypto.randomUUID());
  const operation = useRef({ id: crypto.randomUUID(), fingerprint: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })); setFailure(undefined);
  };
  const chooseFile = (next: File | null) => {
    if (busy || unknown) return;
    setFile(null); setUploaded(undefined); uploadId.current = crypto.randomUUID();
    const invalid = next && (next.size === 0 || next.size > 15 * 1024 * 1024 || !invoiceTypes.includes(next.type));
    setErrors((current) => ({ ...current, file: invalid ? t('invoiceFileInvalid') : '' }));
    if (!invalid) setFile(next);
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const element = event.currentTarget;
    const amount = expenseAmount(form.amount);
    const validation: Record<string, string> = {};
    if (!amount) validation.amount = t('expenseAmountInvalid');
    if (!/^[A-Z]{3}$/.test(form.currency)) validation.currency = t('currencyInvalid');
    if (!validExpenseDate(form.expenseDate)) validation.expenseDate = t('expenseDateInvalid');
    if (!categories.data?.some((category) => category.id === form.categoryId && category.active)) validation.categoryId = t('chooseCategory');
    if (mode === 'invoice' && !file) validation.file = t('invoiceRequired');
    if (mode === 'exception' && !form.noInvoiceNote.trim()) validation.noInvoiceNote = t('exceptionRequired');
    setErrors(validation); setFailure(undefined);
    if (!unknown && Object.keys(validation).length) { requestAnimationFrame(() => element.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    setBusy(true);
    let posting = false;
    try {
      let evidence = uploaded;
      if (mode === 'invoice' && !evidence) {
        evidence = await uploadOfficeFile({ warehouseId: scope.warehouseId!, uploadId: uploadId.current, purpose: 'expense_invoice', file: file! });
        setUploaded(evidence);
      }
      const body = {
        warehouseId: scope.warehouseId!, amount: amount!, currency: form.currency, expenseDate: form.expenseDate,
        categoryId: form.categoryId, customerId: form.customerId || null, orderId: form.orderId || null,
        invoiceFileId: mode === 'invoice' ? evidence!.id : null, noInvoiceNote: mode === 'exception' ? form.noInvoiceNote.trim() : null,
      };
      const fingerprint = JSON.stringify(body);
      // A retry after a lost response must claim the same server operation and evidence upload.
      if (operation.current.fingerprint && operation.current.fingerprint !== fingerprint) operation.current.id = crypto.randomUUID();
      operation.current.fingerprint = fingerprint;
      const payload: ExpenseInput = { ...body, clientOperationId: operation.current.id };
      posting = true;
      await recordExpense(payload);
      await cache.invalidateQueries({ queryKey: scope.queryKey('expenses') });
      onClose();
    } catch (error) {
      const ambiguous = posting && (!(error instanceof ApiError) || error.status >= 500);
      setUnknown(ambiguous);
      setFailure(ambiguous ? t('expenseResultUnknown') : !posting ? t('invoiceUploadFailed') :
        error instanceof ApiError && error.status === 403 ? t('restricted') : error instanceof ApiError && error.validationMessage || t('saveFailed'));
    } finally { setBusy(false); }
  }
  const field = (key: 'amount' | 'expenseDate', label: string) => <LabeledField label={t(label)} error={errors[key]}>
    {(attributes) => <input {...attributes} type={key === 'expenseDate' ? 'date' : 'text'} inputMode={key === 'amount' ? 'decimal' : undefined}
      dir={key === 'expenseDate' ? undefined : 'ltr'} value={form[key]}
      onChange={(event) => update(key, event.currentTarget.value)} />}
  </LabeledField>;
  return <OfficeDialog title={t('recordExpense')} onClose={onClose} busy={busy} closeDisabled={unknown}>
    <form onSubmit={submit} noValidate>
      <fieldset className={'office-dialog-body ' + styles.fields} disabled={busy || unknown}>
        <div className={styles.grid}>{field('amount', 'amount')}
          <LabeledField label={t('currency')} error={errors.currency}>{(attributes) => <select {...attributes} value={form.currency} onChange={(event) => update('currency', event.target.value)}>
            {Intl.supportedValuesOf('currency').map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>}</LabeledField>
          <LabeledField label={t('category')} error={errors.categoryId}>{(attributes) => <select {...attributes} value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>
            <option value="">{t('chooseCategory')}</option>{categories.data?.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{categoryName(item, format.language)}</option>)}
          </select>}</LabeledField>
          {field('expenseDate', 'expenseDate')}
          <LabeledField label={t('customer')} hint={t('optional')}>{(attributes) => <select {...attributes} value={form.customerId} onChange={(event) => update('customerId', event.target.value)}>
            <option value="">{t('none')}</option>{catalog.data?.parties.filter((party) => party.type === 'customer').map((party) => <option key={party.id} value={party.id}>{partyName(party, format.language)}</option>)}
          </select>}</LabeledField>
          <LabeledField label={t('purchaseOrder')} hint={t('optional')}>{(attributes) => <select {...attributes} value={form.orderId} onChange={(event) => update('orderId', event.target.value)}>
            <option value="">{t('none')}</option>{orders.data?.map((order) => <option key={order.id} value={order.id}>{order.orderNo}</option>)}
          </select>}</LabeledField>
        </div>
        {(categories.isError || catalog.isError || orders.isError) && <p className="field-error" role="alert">{t('expenseOptionsFailed')} <button type="button" className="button" onClick={() => { void categories.refetch(); void catalog.refetch(); void orders.refetch(); }}>{t('retry')}</button></p>}
        <div className={styles.modes} role="group" aria-label={t('invoiceEvidence')}>
          <button type="button" aria-pressed={mode === 'invoice'} onClick={() => setMode('invoice')}>{t('attachInvoice')}</button>
          <button type="button" aria-pressed={mode === 'exception'} onClick={() => setMode('exception')}>{t('addException')}</button>
        </div>
        {mode === 'invoice' ? <InvoiceField file={file} error={errors.file} onChange={chooseFile} /> :
          <LabeledField label={t('noInvoiceNote')} error={errors.noInvoiceNote}>{(attributes) => <textarea {...attributes} rows={3} maxLength={2000} value={form.noInvoiceNote} onChange={(event) => update('noInvoiceNote', event.target.value)} />}</LabeledField>}
        {failure && <p className="field-error" role="alert">{failure}</p>}
      </fieldset>
      <div className="office-dialog-actions"><button type="button" className="button" disabled={busy || unknown} onClick={onClose}>{t('cancel')}</button>
        <button type="submit" className="button button-primary" disabled={busy || !categories.data}>{t(busy ? 'saving' : unknown ? 'retryExpense' : 'recordExpense')}</button></div>
    </form>
  </OfficeDialog>;
}
