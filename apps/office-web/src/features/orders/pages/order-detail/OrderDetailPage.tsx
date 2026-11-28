import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Ellipsis, Pencil, XCircle } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../../../api/client';
import { useRecordFormat } from '../../../../shared/format-record';
import { OfficeDialog } from '../../../../shared/ui/OfficeDialog';
import { RecordState } from '../../../../shared/ui/RecordState';
import { partyName, productName, useCatalog } from '../../../catalog/catalog-api';
import { OrderBackLink } from '../../components/OrderBackLink';
import { OrderStatusBadge } from '../../components/OrderStatusBadge';
import { OrderSummary } from '../../components/OrderSummary';
import { WarehouseState } from '../../../../shared/ui/WarehouseState';
import styles from '../../components/OrderWorkspace.module.css';
import { changeOrderStatus, useOrder, useOrderScope } from '../../order-api';

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const id = useParams().orderId ?? '';
  const scope = useOrderScope();
  const query = useOrder(scope, id);
  const catalog = useCatalog();
  const cache = useQueryClient();
  const [action, setAction] = useState<'confirm' | 'cancel'>();
  const [actionError, setActionError] = useState(false);
  const mutation = useMutation({ mutationFn: (value: 'confirm' | 'cancel') => changeOrderStatus(id, value) });

  if (!scope.canRead) return <WarehouseState active={scope.active} />;
  if (query.isError || catalog.isError) {
    const unavailable = query.error instanceof ApiError && [403, 404].includes(query.error.status);
    return <><OrderBackLink /><RecordState state="error" message={unavailable ? t('orderUnavailable') : undefined}
      action={unavailable ? undefined : () => {
        if (query.isError) void query.refetch();
        if (catalog.isError) void catalog.refetch();
      }} /></>;
  }
  if (!query.data || !catalog.data) return <RecordState state="loading" />;
  const order = query.data;
  const products = new Map(catalog.data.products.map((product) => [product.id, product]));
  const supplier = catalog.data.parties.find((party) => party.id === order.supplierId);
  const customer = catalog.data.parties.find((party) => party.id === order.customerId);
  const details = [
    ['supplier', partyName(supplier, format.language)], ['customer', partyName(customer, format.language)],
    ['shippingMark', customer?.shippingMark], ['orderDate', format.date(order.orderDate)],
    ['expectedDate', format.date(order.expectedDate)], ['currency', format.currencyName(order.currency)],
  ] as const;
  function choose(value: 'confirm' | 'cancel') {
    setActionError(false);
    setAction(value);
  }
  async function submitAction() {
    if (!action || mutation.isPending) return;
    setActionError(false);
    try {
      const result = await mutation.mutateAsync(action);
      cache.setQueryData(scope.detailKey(id), result);
      void cache.invalidateQueries({ queryKey: scope.listKey });
      setAction(undefined);
    } catch {
      setActionError(true);
      void query.refetch();
    }
  }

  return (
    <>
      <OrderBackLink />
      <div className="workspace-heading">
        <div className="workspace-actions"><h1><bdi>{order.orderNo}</bdi></h1><OrderStatusBadge status={order.status} /></div>
        <div className="workspace-actions">
          {order.status === 'draft' && <>
            <Link className="button" to={'/orders/' + id + '/edit'}><Pencil size={15} aria-hidden="true" />{t('editDraft')}</Link>
            <button type="button" className="button button-primary" onClick={() => choose('confirm')}>
              <Check size={17} aria-hidden="true" />{t('confirmOrder')}
            </button>
          </>}
          {(order.status === 'draft' || order.status === 'ready') && <DropdownMenu.Root>
            <DropdownMenu.Trigger className="button" aria-label={t('orderActions')}><Ellipsis size={18} aria-hidden="true" /></DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" align="end" sideOffset={8}>
                <DropdownMenu.Item className="menu-item" onSelect={() => choose('cancel')}>
                  <XCircle size={16} aria-hidden="true" />{t('cancelOrder')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>}
        </div>
      </div>
      <div className={styles.grid}>
        <div className={styles.main}>
          <section className={'surface workspace-panel ' + styles.formPanel} aria-labelledby="order-details">
            <h2 id="order-details">{t('orderDetails')}</h2>
            <dl className={styles.formGrid + ' ' + styles.details}>{details.map(([label, value]) => (
              <div key={label}><dt>{t(label)}</dt><dd><bdi>{value || '—'}</bdi></dd></div>
            ))}</dl>
          </section>
          <section className="surface workspace-panel" aria-labelledby="order-lines">
            <h2 id="order-lines" className="panel-heading">{t('lineItems')}</h2>
            <div className="table-scroll" role="region" tabIndex={0} aria-label={t('lineItems')}>
              <table className="records-table">
                <thead><tr>{['product', 'cartons', 'unitsPerCarton', 'units', 'unitPrice', 'amount'].map((column) =>
                  <th key={column} scope="col">{t(column)}</th>)}</tr></thead>
                <tbody>{order.lines.map((line) => <tr key={line.id}>
                  <td><bdi>{productName(products.get(line.productId), format.language) || line.productId}</bdi></td>
                  <td>{format.quantity(line.cartons)}</td>
                  <td>{format.quantity(line.qtyPerCarton)}</td>
                  <td>{format.quantity(line.qty)}</td>
                  <td><bdi>{format.unitPrice(line.unitPrice)}</bdi></td>
                  <td><bdi>{format.amount(line.amount)}</bdi></td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>
        <OrderSummary lineCount={order.lines.length} cartons={order.lines.reduce((sum, line) => sum + line.cartons, 0)}
          units={order.lines.reduce((sum, line) => sum + line.qty, 0)}
          deposit={<bdi>{format.amount(order.deposit)}</bdi>} total={order.totalAmount} currency={order.currency} />
      </div>
      {action && <OfficeDialog title={t(action === 'confirm' ? 'confirmOrder' : 'cancelOrder')}
        onClose={() => setAction(undefined)} busy={mutation.isPending}>
        <div className="office-dialog-body">
          <p>{t(action === 'confirm' ? 'confirmOrderText' : 'cancelOrderText')}</p>
          {actionError && <p className="field-error" role="alert">{t('orderActionFailed')}</p>}
        </div>
        <div className="office-dialog-actions">
          <button type="button" className="button" disabled={mutation.isPending} onClick={() => setAction(undefined)}>
            {t('goBack')}
          </button>
          <button type="button" className={'button ' + (action === 'confirm' ? 'button-primary' : 'button-danger')}
            disabled={mutation.isPending} onClick={() => void submitAction()}>
            {t(mutation.isPending ? 'saving' : action === 'confirm' ? 'confirmOrder' : 'cancelOrder')}
          </button>
        </div>
      </OfficeDialog>}
    </>
  );
}
