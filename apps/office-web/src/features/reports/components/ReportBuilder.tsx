import { useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../api/client';
import { officeLanguage } from '../../../app/i18n';
import type { WarehouseScope } from '../../../app/use-warehouse-scope';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { QueryState } from '../../../shared/ui/QueryState';
import { partyName, useParties } from '../../catalog/catalog-api';
import { useOrders } from '../../orders/order-api';
import { createExport } from '../exports-api';
import { reportDefinitions, reportFilters, reportKinds, type ExportJob, type ReportFilters, type ReportKind } from '../report-types';
import styles from '../pages/ReportsPage.module.css';

export function ReportBuilder({ scope, initialKind, initialFilters }: {
  scope: WarehouseScope;
  initialKind: ReportKind;
  initialFilters: ReportFilters;
}) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const [kind, setKind] = useState(initialKind);
  const [draft, setDraft] = useState(initialFilters);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const fields: readonly (keyof ReportFilters)[] = reportDefinitions[kind].fields;
  const filters = reportFilters(kind, draft);
  const parties = useParties();
  const orders = useOrders(scope, fields.includes('orderId'));
  const invalidDate = Boolean(filters.from && filters.to && filters.from > filters.to);
  const validOrder = Boolean(orders.data?.some(order => order.id === filters.orderId));
  const language = officeLanguage(i18n.resolvedLanguage);

  function change(field: keyof ReportFilters, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
    setSubmitted(false);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !scope.warehouseId || invalidDate) return;
    if ((kind === 'purchase_order' || filters.orderId) && !validOrder) {
      setError('reportChooseOrder');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setSubmitted(false);
    setError(undefined);
    const key = scope.queryKey('exports');
    try {
      const job = await createExport(scope.warehouseId, kind, filters);
      cache.setQueryData<{ exports: ExportJob[] }>(key, previous => previous && ({
        ...previous,
        exports: [job, ...previous.exports.filter(item => item.id !== job.id)].slice(0, 100),
      }));
      setSubmitted(true);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 403 ? 'restricted' : 'reportSubmitError');
    } finally {
      await cache.invalidateQueries({ queryKey: key });
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className={'surface ' + styles.builder}>
    <h2>{t('reportBuilder')}</h2>
    <form onSubmit={submit} noValidate>
      <fieldset className={styles.fields} disabled={busy}>
        <div className="field">
          <span className={styles.label}>{t('reportType')}</span>
          <FilterSelect label={t('reportType')} value={kind} onChange={value => {
            if (!reportKinds.includes(value as ReportKind)) return;
            const next = value as ReportKind;
            setKind(next);
            setDraft(current => reportFilters(next, current));
            setError(undefined);
            setSubmitted(false);
          }} options={reportKinds.map(value => ({ value, label: t(reportDefinitions[value].label) }))} />
        </div>
        {(['from', 'to'] as const).filter(field => fields.includes(field)).map(field =>
          <LabeledField key={field} label={t(field === 'from' ? 'fromDate' : 'toDate')}
            error={invalidDate && field === 'to' ? t('dateRangeInvalid') : undefined}>
            {props => <input {...props} type="date" value={draft[field] ?? ''} onChange={event => change(field, event.target.value)} />}
          </LabeledField>)}
        {(['customer', 'supplier'] as const).map(role => {
          const field = role === 'customer' ? 'customerId' : 'supplierId';
          if (!fields.includes(field)) return null;
          const options = parties.data?.filter(party => party.type === role).map(party => ({
            value: party.id,
            label: [partyName(party, language), party.shippingMark].filter(Boolean).join(' · '),
          })) ?? [];
          return <LabeledField key={field} label={t(role)}>
            {props => <select {...props} value={draft[field] ?? ''} onChange={event => change(field, event.target.value)}>
              <option value="">{t(role === 'customer' ? 'allCustomers' : 'allSuppliers')}</option>
              {draft[field] && !options.some(option => option.value === draft[field]) &&
                <option value={draft[field]}>{draft[field]}</option>}
              {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>}
          </LabeledField>;
        })}
        {fields.includes('orderId') && <LabeledField label={t('reportOrder')}>
          {props => <select {...props} required={kind === 'purchase_order'} value={draft.orderId ?? ''}
            onChange={event => change('orderId', event.target.value)}>
            <option value="">{t(kind === 'purchase_order' ? 'reportChooseOrder' : 'reportAllOrders')}</option>
            {draft.orderId && !validOrder && <option value={draft.orderId}>{draft.orderId}</option>}
            {orders.data?.map(order => <option key={order.id} value={order.id}>{order.orderNo}</option>)}
          </select>}
        </LabeledField>}
        <button className="button button-primary" disabled={busy || invalidDate || Boolean((kind === 'purchase_order' || filters.orderId) && !validOrder)}>
          <Plus size={16} aria-hidden="true" />{t(busy ? 'reportSubmitting' : 'reportGenerate')}
        </button>
      </fieldset>
      {fields.some(field => field === 'customerId' || field === 'supplierId') && parties.isError &&
        <QueryState query={parties}>{null}</QueryState>}
      {fields.includes('orderId') && <QueryState query={orders}>{null}</QueryState>}
      <p className="muted-text">{t('reportScopeNote')}</p>
      {error && <p className="field-error" role="alert">{t(error)}</p>}
      {submitted && <p role="status">{t('reportSubmitted')}</p>}
    </form>
  </section>;
}
