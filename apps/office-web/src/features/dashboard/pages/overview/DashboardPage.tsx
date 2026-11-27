import { Boxes, ChevronRight, Clock3, PackageCheck, Plus, SlidersHorizontal, TriangleAlert, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { RecordState } from '../../../../shared/ui/RecordState';
import { useRecordFormat } from '../../../../shared/format-record';
import { OrderStatusBadge } from '../../../orders/components/OrderStatusBadge';
import { useWarehouseData } from '../../../stock/warehouse-api';
import { formatStockCount, stockCountSign, sumStockCounts } from '../../../stock/stock-count';
import { WarehouseGate } from '../../../stock/pages/WarehouseViews';
import styles from './DashboardPage.module.css';

const DashboardCharts = lazy(() => import('./DashboardCharts').then((module) => ({ default: module.DashboardCharts })));

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const format = useRecordFormat();
  const data = useWarehouseData();
  const current = data.query.data;
  const language = i18n.resolvedLanguage || 'en';
  const count = (value: string | number | null) => formatStockCount(value, language);
  const cartons = sumStockCounts(current?.balances.map((row) => row.cartons) ?? []);
  const cards = [
    { label: 'readyForReceiving', value: current?.queue.filter((order) => order.status === 'ready').length ?? 0, icon: PackageCheck },
    { label: 'partly_received', value: current?.queue.filter((order) => order.status === 'partly_received').length ?? 0, icon: Clock3 },
    { label: 'openFindings', value: current?.findings.length ?? 0, icon: TriangleAlert },
    { label: 'cartonsInStock', value: cartons, icon: Boxes },
  ];
  const deliveries = [...(current?.queue ?? [])].sort((a, b) =>
    (a.expectedDate || '9999').localeCompare(b.expectedDate || '9999')).slice(0, 3);
  const activity = data.movements.data?.pages[0].movements.slice(0, 3) ?? [];
  const panelLink = (to: string, label: string) => <Link className={styles.panelLink} to={to}>{t(label)}<ChevronRight size={14} className="rtl-icon" aria-hidden="true" /></Link>;
  return <>
    <div className="workspace-heading"><h1>{t('dashboard')}</h1>{data.scope.warehouseId &&
      <Link className="button button-primary" to="/orders/new"><Plus size={16} aria-hidden="true" />{t('newPurchaseOrder')}</Link>}</div>
    <WarehouseGate data={data}>
      <div className={styles.cards}>{cards.map(({ label, value, icon: Icon }) => <section className={'surface workspace-panel ' + styles.card} key={label}>
        <div className={styles.cardHeading}><h2>{t(label)}</h2><Icon size={15} aria-hidden="true" /></div>
        <strong>{count(value)}</strong><small>{t('comparisonUnavailable')}</small>
      </section>)}</div>
      <div className={styles.panels}>
        {data.scope.warehouseId && <Suspense fallback={<>
          <section className={'surface workspace-panel ' + styles.chartPanel}><h2 className="panel-heading">{t('cartonsReceived')}</h2><RecordState state="loading" /></section>
          <section className={'surface workspace-panel ' + styles.chartPanel}><h2 className="panel-heading">{t('receiptsByWeekday')}</h2><RecordState state="loading" /></section>
        </>}><DashboardCharts warehouseId={data.scope.warehouseId} /></Suspense>}
        <section className={'surface workspace-panel ' + styles.deliveryPanel}>
          <div className={styles.panelHeader}><h2>{t('expectedDeliveries')}</h2>{panelLink('/receiving', 'viewReceiving')}</div>
          {deliveries.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label={t('expectedDeliveries')}>
            <table className={styles.table}><thead><tr>{['orderAndSupplier', 'expectedDate', 'cartonsLeft', 'status'].map((key) => <th key={key} scope="col">{t(key)}</th>)}</tr></thead>
              <tbody>{deliveries.map((order) => <tr key={order.id}>
                <td><Link className="record-link" to={'/orders/' + order.id}><bdi>{order.orderNo}</bdi></Link><span className={styles.secondary}>{order.supplier.name}</span></td>
                <td>{format.date(order.expectedDate)}</td><td>{count(order.remainingCartons)}</td><td><OrderStatusBadge status={order.status} /></td>
              </tr>)}</tbody>
            </table>
          </div> : <RecordState state="empty" />}
        </section>
        <section className="surface workspace-panel">
          <div className={styles.panelHeader}><h2>{t('needsAttention')}</h2>{panelLink('/receiving?tab=findings', 'viewDiscrepancies')}</div>
          {current?.findings.length ? <ul className={styles.findings}>{current.findings.slice(0, 3).map((finding) => <li key={finding.id}>
            <Link to="/receiving?tab=findings" className={styles.finding}>
              <span className={styles.warning}><TriangleAlert size={16} aria-hidden="true" /></span>
              <span><strong>{t(finding.type, { defaultValue: finding.type.replaceAll('_', ' ') })}</strong>
                <small>{t('expected')} {format.quantity(finding.expected)} · {t('actual')} {format.quantity(finding.actual)}</small></span>
              <ChevronRight size={14} className="rtl-icon" aria-hidden="true" />
            </Link>
          </li>)}</ul> : <RecordState state="empty" />}
        </section>
        <section className={'surface workspace-panel ' + styles.activity}>
          <div className={styles.panelHeader}><h2>{t('recentActivity')}</h2>{panelLink('/inventory?tab=movements', 'viewStockMovements')}</div>
          {data.movements.isError ? <RecordState state="error" action={() => { void data.movements.refetch(); }} /> : !data.movements.data ? <RecordState state="loading" /> : activity.length ?
            <div className="table-scroll" tabIndex={0} role="region" aria-label={t('recentActivity')}><table className={styles.table}>
              <thead><tr>{['movement', 'product', 'cartons', 'time'].map((label) => <th key={label} scope="col">{t(label)}</th>)}</tr></thead>
              <tbody>{activity.map((movement) => {
                const Icon = movement.kind === 'receipt' ? PackageCheck : movement.kind === 'dispatch' ? Truck : SlidersHorizontal;
                const product = movement.product;
                const name = language === 'ar' ? product.nameAr : language === 'zh-Hans' ? product.nameCn : product.nameEn;
                const sign = stockCountSign(movement.cartons);
                return <tr key={movement.id}>
                  <td><div className={styles.movement}><span className={styles.movementIcon} data-kind={movement.kind}><Icon size={16} aria-hidden="true" /></span><span><strong>{t(movement.kind === 'receipt' ? 'receiptConfirmed' : movement.kind === 'dispatch' ? 'dispatchConfirmed' : 'adjust')}</strong><small>{movement.receiptNo || movement.dispatchNo || movement.adjustmentNo || '—'}</small></span></div></td>
                  <td><bdi>{name || product.nameEn || product.nameCn || product.nameAr || '—'}</bdi></td>
                  <td className={styles.delta} data-positive={sign === 1}>{sign === 1 ? '+' : ''}{count(movement.cartons)}</td>
                  <td>{new Date(movement.createdAt).toLocaleString(language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                </tr>;
              })}</tbody></table></div> : <RecordState state="empty" />}
        </section>
      </div>
    </WarehouseGate>
  </>;
}
