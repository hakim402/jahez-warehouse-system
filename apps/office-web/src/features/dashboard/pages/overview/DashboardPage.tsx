import { useTranslation } from 'react-i18next';
import { RecordState } from '../../../../shared/ui/RecordState';
import { Link } from 'react-router';
import { useWarehouseData, exactCount } from '../../../stock/warehouse-api';
import { WarehouseGate, QueueTable, FindingsTable, StockTable } from '../../../stock/pages/WarehouseViews';
import styles from '../../../stock/pages/WarehouseViews.module.css';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const data = useWarehouseData();
  const current = data.query.data;
  const cartons = current?.balances.reduce((sum, row) => sum + BigInt(row.cartons), 0n) ?? 0n;
  const cards = [
    ['readyForReceiving', current?.queue.filter((order) => order.status === 'ready').length ?? 0],
    ['partly_received', current?.queue.filter((order) => order.status === 'partly_received').length ?? 0],
    ['openFindings', current?.findings.length ?? 0], ['cartonsInStock', cartons.toString()],
  ] as const;
  return <>
    <div className="workspace-heading"><h1>{t('dashboard')}</h1>{data.scope.warehouseId &&
      <Link className="button button-primary" to="/orders/new">{t('newPurchaseOrder')}</Link>}</div>
    <WarehouseGate data={data}>
      <div className={styles.cards}>{cards.map(([label, value]) => <section className={'surface workspace-panel ' + styles.card} key={label}>
        <h2>{t(label)}</h2><strong>{exactCount(value, i18n.resolvedLanguage || 'en')}</strong>
      </section>)}</div>
      <div className={styles.panels}>
        <section className="surface workspace-panel"><div className="workspace-heading panel-heading"><h2>{t('expectedDeliveries')}</h2><Link className="record-link" to="/receiving">{t('receiving')}</Link></div><QueueTable compact records={current?.queue.slice(0, 3) ?? []} /></section>
        <section className="surface workspace-panel"><h2 className="panel-heading">{t('openFindings')}</h2><FindingsTable records={current?.findings.slice(0, 3) ?? []} /></section>
        <section className="surface workspace-panel"><h2 className="panel-heading">{t('recentActivity')}</h2>
          {data.movements.isError ? <button className="button" onClick={() => void data.movements.refetch()}>{t('retry')}</button> : !data.movements.data ? <RecordState state="loading" /> : <StockTable records={data.movements.data?.pages[0].movements.slice(0, 5) ?? []} kind="movements" />}
        </section>
      </div>
    </WarehouseGate>
  </>;
}
