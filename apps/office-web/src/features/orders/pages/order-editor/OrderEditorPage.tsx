import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../../../api/client';
import { useRecordFormat } from '../../../../shared/format-record';
import { LabeledField } from '../../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../../shared/ui/OfficeDialog';
import { RecordState } from '../../../../shared/ui/RecordState';
import { partyName, useCatalog, type Catalog, type PartyKind } from '../../../catalog/catalog-api';
import { OrderAmount, OrderSummary } from '../../components/OrderSummary';
import { OrderBackLink } from '../../components/OrderBackLink';
import { OrderWorkspaceState } from '../../components/OrderWorkspaceState';
import styles from '../../components/OrderWorkspace.module.css';
import { createOrder, updateOrder, useOrder, useOrders, useOrderScope, type DraftInput, type FullOrder } from '../../order-api';
import { OrderLineEditor } from './OrderLineEditor';
import { emptyLine, initialDraft, validateDraft, type DraftErrors, type DraftForm, type DraftLine } from './order-draft';

const currencies = ['USD', 'CNY', 'AFN', 'EUR', 'AED', 'HKD', 'PKR'];

export default function OrderEditorPage() {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const scope = useOrderScope();
  const catalog = useCatalog();
  const order = useOrder(scope, orderId ?? '');

  if (!scope.canRead) return <OrderWorkspaceState active={scope.active} />;
  if (!orderId && !scope.warehouseId) return <>
    <OrderBackLink /><RecordState state="error" message={t('warehouseRequired')} />
  </>;
  if ((catalog.isError && !catalog.data) || (order.isError && !order.data)) return <>
    <OrderBackLink /><RecordState state="error"
      action={() => { if (order.isError) void order.refetch(); if (catalog.isError) void catalog.refetch(); }} />
  </>;
  if (!catalog.data || (orderId && !order.data)) return <RecordState state="loading" />;
  if (order.data && order.data.status !== 'draft') return <>
    <OrderBackLink /><RecordState state="error" message={t('draftOnly')} />
  </>;

  if (!orderId && (!catalog.data.products.length || !['supplier', 'customer'].every((type) =>
    catalog.data.parties.some((party) => party.type === type)))) {
    return <>
      <OrderBackLink />
      <RecordState state="empty" message={t('missingCatalog')} />
      <Link className="button" to="/catalog">{t('catalog')}</Link>
    </>;
  }
  return <OrderEditor key={orderId ?? 'new'} catalog={catalog.data} order={order.data} scope={scope} />;
}

function serverFields(error: ApiError): DraftErrors {
  const message = error.validationMessage ?? '';
  if (/supplier id/i.test(message)) return { supplierId: 'invalidSelection' };
  if (/customer id/i.test(message)) return { customerId: 'invalidSelection' };
  if (/deposit/i.test(message)) return { deposit: 'invalidMoney' };
  if (/order total/i.test(message)) return { total: 'totalTooLarge' };
  if (/order line|product id|cartons|quantity|unit price|line amount/i.test(message)) return { lines: 'linesInvalid' };
  return {};
}

function OrderEditor({ catalog, order, scope }: {
  catalog: Catalog;
  order?: FullOrder;
  scope: ReturnType<typeof useOrderScope>;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [form, setForm] = useState(() => initialDraft(order));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [remoteFields, setRemoteFields] = useState<DraftErrors>({});
  const [uncertain, setUncertain] = useState<Pick<DraftForm, 'supplierId' | 'customerId' | 'orderNo'>>();
  const [reviewing, setReviewing] = useState(false);
  const draft = validateDraft(form);
  const errors = submitted ? { ...remoteFields, ...draft.errors } : {};
  const fieldError = (field: keyof DraftErrors) => errors[field] && t(errors[field]);
  const recovery = useOrders(scope, reviewing);
  const matchingOrders = uncertain ? recovery.data?.filter((candidate) =>
    candidate.supplierId === uncertain.supplierId && candidate.customerId === uncertain.customerId &&
    (!uncertain.orderNo || candidate.orderNo === uncertain.orderNo),
  ).slice(0, 8) : undefined;
  const mutation = useMutation({
    mutationFn: (input: DraftInput) => order
      ? updateOrder(order.id, input)
      : createOrder({ ...input, warehouseId: scope.warehouseId!,
        supplierId: form.supplierId, customerId: form.customerId,
        orderNo: form.orderNo.trim() || undefined }),
  });

  function update<K extends Exclude<keyof DraftForm, 'lines'>>(key: K, value: DraftForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setRemoteFields((previous) => ({ ...previous, [key]: undefined }));
  }

  function updateLine(key: string, field: keyof DraftLine, value: string) {
    setForm((previous) => ({
      ...previous, lines: previous.lines.map((line) => line.key === key ? { ...line, [field]: value } : line),
    }));
    setRemoteFields((previous) => ({ ...previous, lines: undefined, total: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || uncertain) return;
    setError(undefined);
    setRemoteFields({});
    setSubmitted(true);
    if (!draft.input) {
      const formElement = event.currentTarget;
      requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    try {
      const saved = await mutation.mutateAsync(draft.input);
      cache.setQueryData(scope.detailKey(saved.id), saved);
      void cache.invalidateQueries({ queryKey: scope.listKey });
      navigate('/orders/' + saved.id, { replace: true });
    } catch (failure) {
      if (!order && (!(failure instanceof ApiError) || failure.status >= 500)) {
        setUncertain({ supplierId: form.supplierId, customerId: form.customerId, orderNo: form.orderNo.trim() });
        void cache.invalidateQueries({ queryKey: scope.listKey, refetchType: 'none' });
        setError('orderCreateUnclear');
      } else if (failure instanceof ApiError && failure.status === 400) {
        setRemoteFields(serverFields(failure));
        setError('validationFailed');
      } else {
        setError(failure instanceof ApiError && failure.status === 403 ? 'restricted' :
          failure instanceof ApiError && failure.status === 409 ? 'conflict' : 'saveFailed');
      }
    }
  }

  function partyField(type: PartyKind) {
    const key = type === 'supplier' ? 'supplierId' : 'customerId';
    const options = catalog.parties.filter((party) => party.type === type);
    const selectedMissing = form[key] && !options.some((party) => party.id === form[key]);
    return <LabeledField label={t(type)} error={fieldError(key)}>
      {(props) => <select {...props} required disabled={Boolean(order)} value={form[key]}
        onChange={(event) => update(key, event.currentTarget.value)}>
        <option value="">{t(type === 'supplier' ? 'chooseSupplier' : 'chooseCustomer')}</option>
        {selectedMissing && <option value={form[key]}>{form[key]}</option>}
        {options.map((party) => <option key={party.id} value={party.id}>
          {partyName(party, format.language)}{party.shippingMark ? ' · ' + party.shippingMark : ''}
        </option>)}
      </select>}
    </LabeledField>;
  }

  return (
    <>
      <OrderBackLink />
      <div className="workspace-heading"><h1>{t(order ? 'editDraft' : 'newPurchaseOrder')}</h1></div>
      {error && <div className={'surface ' + styles.notice} role="alert">
        <p className="field-error">{t(error)}</p>
        {uncertain && <button type="button" className="button" onClick={() => setReviewing(true)}>{t('checkOrderList')}</button>}
      </div>}
      <form noValidate onSubmit={submit} aria-busy={mutation.isPending}>
        <fieldset className={styles.editorFields} disabled={mutation.isPending}>
          <div className={styles.grid}>
            <div className={styles.main}>
              <section className={'surface workspace-panel ' + styles.formPanel} aria-labelledby="order-fields">
                <h2 id="order-fields">{t('orderDetails')}</h2>
                <div className={styles.formGrid}>
                  {partyField('supplier')}
                  {partyField('customer')}
                  <LabeledField label={t('currency')} error={fieldError('currency')}>
                    {(props) => <input {...props} dir="ltr" list="order-currencies" value={form.currency}
                      maxLength={3} onChange={(event) => update('currency', event.currentTarget.value)} />}
                  </LabeledField>
                  <datalist id="order-currencies">{currencies.map((currency) =>
                    <option key={currency} value={currency}>{format.currencyName(currency)}</option>)}</datalist>
                  {(['orderDate', 'expectedDate'] as const).map((field) =>
                    <LabeledField key={field} label={t(field)} error={fieldError(field)}
                      hint={field === 'expectedDate' ? t('optional') : undefined}>
                      {(props) => <input {...props} type="date" value={form[field]}
                        onChange={(event) => update(field, event.currentTarget.value)} />}
                    </LabeledField>)}
                  <LabeledField label={t('orderNo')} hint={order ? undefined : t('optional')}>
                    {(props) => <input {...props} readOnly={Boolean(order)} value={form.orderNo}
                      placeholder={t('autoOrderNumber')} onChange={(event) => update('orderNo', event.currentTarget.value)} />}
                  </LabeledField>
                </div>
              </section>
              {submitted && fieldError('lines') && <p className="field-error" role="alert">{fieldError('lines')}</p>}
              <OrderLineEditor lines={form.lines} estimates={draft.lines} products={catalog.products} showErrors={submitted}
                updateLine={updateLine}
                addLine={() => setForm((previous) => ({ ...previous, lines: [...previous.lines, emptyLine()] }))}
                removeLine={(key) => setForm((previous) => previous.lines.length <= 1 ? previous : ({
                  ...previous, lines: previous.lines.filter((line) => line.key !== key),
                }))} />
            </div>
            <OrderSummary lineCount={form.lines.length} cartons={draft.totalCartons} units={draft.totalQuantity}
              currency={form.currency.trim().toUpperCase() || null} total={draft.total}
              deposit={<LabeledField hiddenLabel label={t('deposit')} error={fieldError('deposit')}>
                {(props) => <input {...props} dir="ltr" inputMode="decimal" value={form.deposit}
                  placeholder="0.00" onChange={(event) => update('deposit', event.currentTarget.value)} />}
              </LabeledField>}
              actions={<>
                {fieldError('total') && <p className="field-error" role="alert">{fieldError('total')}</p>}
                <button type="submit" className="button button-primary" disabled={mutation.isPending || Boolean(uncertain)}>
                  {t(mutation.isPending ? 'saving' : 'saveDraft')}
                </button>
              </>} />
          </div>
        </fieldset>
      </form>
      {reviewing && <OfficeDialog title={t('checkOrderList')} onClose={() => setReviewing(false)}>
        <div className="office-dialog-body">
          {recovery.isError ? <RecordState state="error" action={() => { void recovery.refetch(); }} /> :
            recovery.isFetching || !recovery.data ? <RecordState state="loading" /> :
              matchingOrders?.length ? <>
                <p>{t('matchingOrders')}</p>
                <ul className={styles.reviewList}>{matchingOrders.map((candidate) => <li key={candidate.id}>
                  <Link to={'/orders/' + candidate.id} className="record-link"><bdi>{candidate.orderNo}</bdi></Link>
                  {' · '}<OrderAmount amount={candidate.totalAmount} currency={candidate.currency} />
                </li>)}</ul>
              </> : <p>{t('noMatchingOrders')}</p>}
        </div>
        <div className="office-dialog-actions">
          <button type="button" className="button" onClick={() => setReviewing(false)}>{t('goBack')}</button>
          <button type="button" className="button button-primary" disabled={!recovery.isSuccess || recovery.isFetching}
            onClick={() => { setReviewing(false); setUncertain(undefined); setError(undefined); }}>
            {t('checkedOrderList')}
          </button>
        </div>
      </OfficeDialog>}
    </>
  );
}
