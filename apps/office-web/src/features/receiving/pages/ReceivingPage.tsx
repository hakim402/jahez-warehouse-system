import { useSearchParams } from 'react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListTabs, SearchField } from '../../../shared/ui/ListControls';
import { useWarehouseData } from '../../stock/warehouse-api';
import { WarehouseGate, QueueTable, FindingsTable } from '../../stock/pages/WarehouseViews';

export default function ReceivingPage() {
  const { t } = useTranslation();
  const data = useWarehouseData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'findings' ? 'findings' : 'queue';
  const setTab = (value: string) => setParams(value === 'findings' ? { tab: value } : {});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const queue = data.query.data?.queue ?? [];
  const findings = data.query.data?.findings ?? [];
  const rows = queue.filter((order) => (!status || order.status === status) && (!date || order.expectedDate === date) &&
    [order.orderNo, order.supplier.name, order.customer.name, order.customer.shippingMark].some((value) => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  return <><div className="workspace-heading"><h1>{t('receiving')}</h1></div>
    <section className="surface workspace-panel"><WarehouseGate data={data}>
      <ListTabs label={t('receiving')} selected={tab} onChange={setTab} items={[
        { id: 'queue', name: t('expectedDeliveries'), count: queue.length }, { id: 'findings', name: t('discrepancies'), count: findings.length },
      ]} />
      {tab === 'queue' ? <><div className="table-toolbar">
        <SearchField label={t('searchOrders')} value={search} onChange={setSearch} />
        <div className="workspace-actions"><select className="text-input" aria-label={t('status')} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t('allOrders')}</option><option value="ready">{t('ready')}</option><option value="partly_received">{t('partly_received')}</option>
        </select><input className="text-input" type="date" aria-label={t('expectedDate')} value={date} onChange={(event) => setDate(event.target.value)} /></div>
      </div><QueueTable records={rows} /></> : <FindingsTable records={findings} />}
    </WarehouseGate></section></>;
}
