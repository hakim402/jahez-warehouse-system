import { ArrowLeft, Check, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../../../api/client';
import { useRecordFormat } from '../../../../shared/format-record';
import { RecordState } from '../../../../shared/ui/RecordState';
import { productName } from '../../../../shared/product-name';
import { formatStockCount, sumStockCounts } from '../../../stock/stock-count';
import { useDispatch, useDispatchScope, type DispatchLine } from '../../dispatch-api';
import styles from './DispatchDetailPage.module.css';

function DispatchBackLink() {
  const { t } = useTranslation();
  return <Link to="/dispatch" className={'back-link ' + styles.backLink}>
    <ArrowLeft className="rtl-icon" size={15} aria-hidden="true" />{t('dispatchHistory')}
  </Link>;
}

export default function DispatchDetailPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const id = useParams().dispatchId ?? '';
  const scope = useDispatchScope();
  const query = useDispatch(scope, id);


  if (!scope.canRead || !scope.warehouseId) {
    return <><DispatchBackLink /><section className="surface workspace-panel">
      <RecordState state={scope.active.title === 'loadingWarehouse' ? 'loading' : 'error'}
        message={t(scope.active.message ?? scope.active.title)} action={scope.active.retry} />
    </section></>;
  }
  if (query.isError) {
    const unavailable = query.error instanceof ApiError && [403, 404].includes(query.error.status);
    return <><DispatchBackLink /><RecordState state="error" message={unavailable ? t('dispatchUnavailable') : undefined}
      action={unavailable ? undefined : () => { void query.refetch(); }} /></>;
  }
  if (!query.data) return <><DispatchBackLink /><RecordState state="loading" /></>;

  const dispatch = query.data;
  const totalUnits = sumStockCounts(dispatch.lines.map((line) => line.qty));
  const sourceReceipts = dispatch.lines.flatMap((line) => line.allocations.map((allocation, index) => ({
    id: `${line.id}:${allocation.receiptLineId}:${index}`,
    line,
    allocation,
  }))).sort((left, right) => left.allocation.receivedAt.localeCompare(right.allocation.receivedAt) ||
    left.allocation.receiptNo.localeCompare(right.allocation.receiptNo));

  function lineProductName(line: DispatchLine) {
    return productName(line.product, format.language) || '—';
  }

  return (
    <div className={styles.dispatchDetail}>
      <DispatchBackLink />
      <div className="workspace-heading">
        <div className="workspace-actions">
          <h1><bdi>{dispatch.dispatchNo}</bdi></h1>
          <span className={styles.confirmedBadge} data-status={dispatch.status}>
            <Check size={13} aria-hidden="true" />{t('confirmed')}
          </span>
        </div>
        <button type="button" className={'button button-primary ' + styles.printButton} onClick={() => window.print()}>
          <Printer size={17} aria-hidden="true" />{t('printPackingList')}
        </button>
      </div>
      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={'surface ' + styles.detailsPanel} aria-labelledby="dispatch-details">
            <h2 id="dispatch-details">{t('dispatchDetails')}</h2>
            <dl className={'record-details ' + styles.detailsGrid}>
              <div>
                <dt>{`${t('customer')} / ${t('shippingMark')}`}</dt>
                <dd><bdi>{dispatch.customerName || '—'}</bdi>
                  {dispatch.customerMark && <span className={styles.secondaryValue}><bdi>{dispatch.customerMark}</bdi></span>}
                </dd>
              </div>
              <div>
                <dt>{t('destination')}</dt>
                <dd><bdi>{dispatch.destination || '—'}</bdi></dd>
              </div>
              <div>
                <dt>{t('dispatchedAt')}</dt>
                <dd><bdi className={styles.timestamp}><time dateTime={dispatch.dispatchedAt}>
                  {format.dateTime(dispatch.dispatchedAt)}
                </time></bdi></dd>
              </div>
              <div>
                <dt>{t('dispatchedBy')}</dt>
                <dd><bdi>{dispatch.dispatchedBy}</bdi></dd>
              </div>
              <div>
                <dt>{t('originWarehouse')}</dt>
                <dd><bdi>{scope.active.warehouse?.name || '—'}</bdi></dd>
              </div>
            </dl>
          </section>
          <section className="surface" aria-labelledby="packing-list">
            <h2 id="packing-list" className="panel-heading">{t('packingList')}</h2>
            {dispatch.lines.length ? (
              <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={t('packingList')}>
                <table className={'records-table ' + styles.packingTable}>
                  <thead><tr>{['product', 'supplier', 'brand', 'cartons', 'units', 'volume', 'weightKg'].map((column) =>
                    <th key={column} scope="col">{t(column)}</th>)}</tr></thead>
                  <tbody>{dispatch.lines.map((line) => <tr key={line.id}>
                    <td><bdi>{lineProductName(line)}</bdi>
                      {line.product.modelNo && <span className={styles.secondaryValue}><bdi>{line.product.modelNo}</bdi></span>}
                    </td>
                    <td><bdi>{line.supplierName || '—'}</bdi></td>
                    <td><bdi>{line.brand || '—'}</bdi></td>
                    <td><bdi dir="ltr" className={styles.numeric}>{formatStockCount(line.cartons, format.language)}</bdi></td>
                    <td><bdi dir="ltr" className={styles.numeric}>{formatStockCount(line.qty, format.language)}</bdi></td>
                    <td><bdi dir="ltr" className={styles.numeric}>{line.cbm === null ? '—' : format.volume(line.cbm)}</bdi></td>
                    <td><bdi dir="ltr" className={styles.numeric}>{line.weightKg === null ? '—' : format.weight(line.weightKg)}</bdi></td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : <RecordState state="empty" />}
          </section>
          <section className="surface" aria-labelledby="source-receipts">
            <h2 id="source-receipts" className="panel-heading">{t('sourceReceipts')}</h2>
            {sourceReceipts.length ? (
              <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={t('sourceReceipts')}>
                <table className={'records-table ' + styles.receiptsTable}>
                  <thead><tr>{['receipt', 'receivedAt', 'product', 'cartonsUsed'].map((column) =>
                    <th key={column} scope="col">{t(column)}</th>)}</tr></thead>
                  <tbody>{sourceReceipts.map(({ id: rowId, line, allocation }) => <tr key={rowId}>
                    <td><bdi>{allocation.receiptNo}</bdi></td>
                    <td><bdi className={styles.timestamp}><time dateTime={allocation.receivedAt}>
                      {format.dateTime(allocation.receivedAt)}
                    </time></bdi></td>
                    <td><bdi>{lineProductName(line)}</bdi>
                      {line.product.modelNo && <span className={styles.secondaryValue}><bdi>{line.product.modelNo}</bdi></span>}
                    </td>
                    <td><bdi dir="ltr" className={styles.numeric}>
                      {formatStockCount(allocation.cartons, format.language)}
                    </bdi></td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : <RecordState state="empty" />}
          </section>
        </div>
        <aside className={'surface ' + styles.totalsPanel} aria-labelledby="shipment-totals">
          <h2 id="shipment-totals">{t('shipmentTotals')}</h2>
          <dl className={styles.totals}>
            <div><dt>{t('cartons')}</dt><dd><bdi dir="ltr">
              {formatStockCount(dispatch.totals.cartons, format.language)}
            </bdi></dd></div>
            <div><dt>{t('units')}</dt><dd><bdi dir="ltr">{formatStockCount(totalUnits, format.language)}</bdi></dd></div>
            <div><dt>{t('volume')}</dt><dd><bdi dir="ltr">
              {dispatch.totals.cbm === null ? '—' : format.volume(dispatch.totals.cbm)}
            </bdi></dd></div>
            <div><dt>{t('weightKg')}</dt><dd><bdi dir="ltr">
              {dispatch.totals.weightKg === null ? '—' : format.weight(dispatch.totals.weightKg)}
            </bdi></dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
