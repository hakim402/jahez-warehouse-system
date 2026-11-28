import { useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../api/client';
import { officeLanguage } from '../../../app/i18n';
import type { WarehouseScope } from '../../../app/use-warehouse-scope';
import { useRecordFormat } from '../../../shared/format-record';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { QueryState } from '../../../shared/ui/QueryState';
import { partyName, productName, useParties, useProducts } from '../../catalog/catalog-api';
import { categoryName, useExpenseCategories } from '../../expenses/expenses-api';
import { commitImport, importedRecordPath, saveReview, type Field, type InvoiceImport, type LineKey } from '../imports-api';
import { expenseFields, lineKeys, linePath, numericField, prepareReview, purchaseFields, valueText, type ReviewForm } from '../review-model';
import styles from '../pages/Imports.module.css';

const emptyForm: ReviewForm = { edits: {}, matches: {}, products: {}, reviewed: [] };
const selectKeys = { supplierId: 'supplier', customerId: 'customer', categoryId: 'category' } as const;
type MatchKey = keyof typeof selectKeys;
type Options = { id: string; label: string }[];

export function InvoiceReviewForm({ item, scope, source }: { item: InvoiceImport; scope: WarehouseScope; source: ReactNode }) {
  const { t, i18n } = useTranslation();
  const language = officeLanguage(i18n.resolvedLanguage);
  const format = useRecordFormat();
  const confidence = new Intl.NumberFormat(language, { style: 'percent' });
  const cache = useQueryClient();
  const navigate = useNavigate();
  const parties = useParties();
  const products = useProducts();
  const categories = useExpenseCategories();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState<{ key: string; detail?: string; error?: boolean }>();
  const purchase = item.kind === 'purchase';
  const result = prepareReview(item, form);
  const matches = { ...item.draft.review, ...form.matches };
  const originalLines = item.draft.lines ?? [];
  const originalHeader = item.draft.header ?? {};
  const options: Record<MatchKey, Options> = {
    supplierId: parties.data?.filter(party => party.type === 'supplier').map(party => ({ id: party.id, label: partyName(party, language) })) ?? [],
    customerId: parties.data?.filter(party => party.type === 'customer').map(party => ({
      id: party.id, label: [partyName(party, language), party.shippingMark].filter(Boolean).join(' · '),
    })) ?? [],
    categoryId: categories.data?.filter(category => category.active).map(category => ({ id: category.id, label: categoryName(category, language) })) ?? [],
  };
  const productOptions = products.data?.map(product => ({
    id: product.id, label: [productName(product, language), product.modelNo].filter(Boolean).join(' · '),
  })) ?? [];
  const matchValid = (key: MatchKey) => options[key].some(option => option.id === matches[key]);
  const matchesValid = purchase
    ? matchValid('supplierId') && matchValid('customerId') &&
      Array.from({ length: Math.max(1, originalLines.length) }, (_, index) =>
        productOptions.some(option => option.id === (form.products[index] ?? originalLines[index]?.productId)),
      ).every(Boolean)
    : matchValid('categoryId') && (!matches.customerId || matchValid('customerId'));
  const invalidEdit = Object.keys(result.errors).some(path => path in form.edits);

  async function submit(create: boolean) {
    if (locked.current || invalidEdit || (create && (!result.ready || !matchesValid))) return;
    locked.current = true;
    setBusy(true);
    setMessage(undefined);
    const queryKey = scope.queryKey('import', item.id);
    try {
      await cache.cancelQueries({ queryKey });
      const updated = await saveReview(item.id, create ? result.commitPatch : result.patch);
      cache.setQueryData(queryKey, updated);
      setForm(emptyForm);
      if (!create) { setMessage({ key: 'importSaved' }); return; }
      const response = await commitImport(item.id);
      const id = purchase ? response.orderId : response.expenseId;
      if (!id) throw new Error('Missing imported record');
      await cache.invalidateQueries({ queryKey: scope.queryKey(purchase ? 'orders' : 'expenses') });
      void navigate(importedRecordPath(item.kind, id), { replace: true });
    } catch (error) {
      setMessage({
        key: 'importSaveError', error: true,
        detail: error instanceof ApiError && [400, 409].includes(error.status) ? error.validationMessage : undefined,
      });
    } finally {
      void cache.invalidateQueries({ queryKey });
      void cache.invalidateQueries({ queryKey: scope.queryKey('imports') });
      locked.current = false;
      setBusy(false);
    }
  }

  function field(key: string, original: Field | undefined, path: string, header = false) {
    const value = form.edits[path] ?? valueText(original);
    const label = t(purchase && key === 'amount' ? 'importSourceAmount' : 'importField.' + key);
    const flagged = item.unreviewedFields.includes(path);
    const date = key === 'orderDate' || key === 'expenseDate';
    return <div key={path}>
      <LabeledField label={label} error={result.errors[path] && t(result.errors[path])}>
        {props => <input {...props} value={value} type={date ? 'date' : 'text'} inputMode={numericField(key) ? 'decimal' : undefined}
          maxLength={key === 'currency' ? 3 : undefined} onChange={event => {
            const next = event.currentTarget.value;
            setForm(current => ({ ...current, edits: { ...current.edits, [path]: next } }));
          }} />}
      </LabeledField>
      {(flagged || original?.source || (header && date && value)) && <small className="muted-text">
        <bdi>{[valueText(original), original?.source].filter(Boolean).join(' · ')}</bdi>
      </small>}
    </div>;
  }

  function match(key: MatchKey) {
    const value = matches[key] ?? '';
    return <SelectField key={key} label={t(selectKeys[key])} value={value} options={options[key]} onChange={value =>
      setForm(current => ({ ...current, matches: { ...current.matches, [key]: value || null } }))} />;
  }

  return <>
    <div className="workspace-heading">
      <h1>{t('importReviewTitle')}</h1>
      <div className="workspace-actions">
        <button className="button" disabled={busy || invalidEdit} onClick={() => void submit(false)}>{t('importSave')}</button>
        <button className="button button-primary" disabled={busy || !result.ready || !matchesValid} onClick={() => void submit(true)}>
          {t(purchase ? 'importCreateOrder' : 'importCreateExpense')}
        </button>
      </div>
    </div>
    <div className={styles.split}>
      {source}
      <div className={styles.review}>
        {message && <p role={message.error ? 'alert' : 'status'} className={message.error ? 'field-error' : undefined}>
          {t(message.key)} {message.detail && <bdi>{message.detail}</bdi>}
        </p>}
        <fieldset className={styles.review} disabled={busy}>
          <section className={'surface ' + styles.panel}>
            <h2>{t('importDraft')}</h2>
            {parties.isError && <QueryState query={parties}>{null}</QueryState>}
            {!purchase && <QueryState query={categories}>{null}</QueryState>}
            <div className={styles.grid}>
              {purchase ? match('supplierId') : match('categoryId')}
              {match('customerId')}
              {(purchase ? ['orderDate', 'currency'] : expenseFields).map(key => field(key, originalHeader[key], 'header.' + key, true))}
            </div>
            {purchase && <details className={styles.extracted}>
              <summary>{t('importExtractedDetails')}</summary>
              <div className={styles.grid}>
                {purchaseFields.filter(key => key !== 'orderDate' && key !== 'currency')
                  .map(key => field(key, originalHeader[key], 'header.' + key, true))}
              </div>
            </details>}
          </section>
          {purchase && <section className={'surface ' + styles.panel}>
            <h2>{t('importLines')}</h2>
            <QueryState query={products}>{null}</QueryState>
            {Array.from({ length: Math.max(1, originalLines.length) }, (_, index) => {
              const line = originalLines[index];
              return <div className={styles.line} key={index}>
                <h3>{t('importLine', { number: format.quantity(index + 1) })}</h3>
                <SelectField label={t('product')} options={productOptions} value={form.products[index] ?? line?.productId ?? ''}
                  onChange={value => setForm(current => ({ ...current, products: { ...current.products, [index]: value } }))} />
                <div className={styles.lineValues}>
                  {(['cartons', 'qtyPerCarton', 'unitPrice', 'amount'] as const).map(key => field(key, line?.[key], linePath(index, key)))}
                </div>
                <details className={styles.extracted}>
                  <summary>{t('importExtractedDetails')}</summary>
                  <div className={styles.grid}>{lineKeys.filter(key => ['description', 'brand', 'size', 'cbm'].includes(key))
                    .map(key => field(key, line?.[key], linePath(index, key)))}</div>
                </details>
              </div>;
            })}
            <p><strong>{t('importCalculatedTotal')}</strong> <bdi>{result.total === null ? '—' : format.amount(result.total)}</bdi></p>
            <p className="muted-text">{t('importCalculatedHelp')}</p>
          </section>}
          {item.unreviewedFields.length > 0 && <section className={'surface ' + styles.panel}>
            <h2>{t('importUncertain')}</h2>
            <p>{t('importUncertainHelp')}</p>
            {item.unreviewedFields.map(path => {
              const line = /^lines\[(\d+)\]\.(\w+)$/.exec(path);
              const key = line?.[2] ?? path.replace(/^header\./, '');
              const value = line ? originalLines[Number(line[1])]?.[key as LineKey] : originalHeader[key];
              const corrected = !result.unreviewed.includes(path) && !form.reviewed.includes(path);
              return <label className={styles.check} key={path}>
                <input type="checkbox" checked={corrected || form.reviewed.includes(path)} disabled={corrected} onChange={event => {
                  const checked = event.currentTarget.checked;
                  setForm(current => ({ ...current, reviewed: checked ? [...current.reviewed, path] : current.reviewed.filter(value => value !== path) }));
                }} />
                <span>{line && t('importLine', { number: format.quantity(Number(line[1]) + 1) }) + ' · '}
                  {t('importField.' + key)} <bdi>{valueText(value)}</bdi>
                  {value && <small> · <bdi>{confidence.format(value.confidence)}</bdi>
                    {value.source && <> · <bdi>{value.source}</bdi></>}
                  </small>}
                </span>
              </label>;
            })}
          </section>}
        </fieldset>
        {(!result.ready || !matchesValid) && <p className={'surface ' + styles.notice} role="status">{t('importReviewNeeded')}</p>}
      </div>
    </div>
  </>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Options; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return <LabeledField label={label}>{props => <select {...props} value={value} onChange={event => onChange(event.currentTarget.value)}>
    <option value="">{t('importSelect')}</option>
    {value && !options.some(option => option.id === value) && <option value={value}>{t('importMissingMatch')}</option>}
    {options.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
  </select>}</LabeledField>;
}
