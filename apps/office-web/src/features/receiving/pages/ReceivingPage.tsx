import { useSearchParams } from 'react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListTabs, SearchField } from '../../../shared/ui/ListControls';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { RecordState } from '../../../shared/ui/RecordState';
import { useFindings } from '../receiving-api';
import { useWarehouseData } from '../../stock/warehouse-api';
import { WarehouseGate, QueueTable, FindingsTable } from '../../stock/pages/WarehouseViews';

export default function ReceivingPage() {
  const { t } = useTranslation();
  const data = useWarehouseData();
  const resolved = useFindings(data.scope, 'resolved');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'findings' ? 'findings' : 'queue';
  const setTab = (value: string) => setParams(value === 'findings' ? { tab: value } : {});
  const [search, setSearch] = useState('');
  const [queueStatus, setQueueStatus] = useState('');
  const [findingStatus, setFindingStatus] = useState('open');
  const [date, setDate] = useState('');
  const queue = data.query.data?.queue ?? [];
  const openFindings = data.query.data?.findings ?? [];
  const resolvedFindings = resolved.data ?? [];
  const findings = findingStatus === 'resolved' ? resolvedFindings : findingStatus === 'all' ? [...openFindings, ...resolvedFindings] : openFindings;
  const needle = search.trim().toLocaleLowerCase();
  const rows = queue.filter((order) => (!queueStatus || order.status === queueStatus) && (!date || order.expectedDate === date) &&
    [order.orderNo, order.supplier.name, order.customer.name, order.customer.shippingMark].some((value) => value?.toLocaleLowerCase().includes(needle)));
  const findingRows = findings.filter((finding) => !needle || [finding.type, finding.receiptId, finding.note]
    .some((value) => value?.toLocaleLowerCase().includes(needle)));
  return <><div className="workspace-heading"><h1>{t('receiving')}</h1></div>
    <section className="surface workspace-panel"><WarehouseGate data={data}>
      <ListTabs label={t('receiving')} selected={tab} onChange={setTab} items={[
        { id: 'queue', name: t('expectedDeliveries'), count: queue.length },
        { id: 'findings', name: t('discrepancies'), count: openFindings.length },
      ]} />
      {tab === 'queue' ? <><div className="table-toolbar">
        <SearchField label={t('searchOrders')} value={search} onChange={setSearch} />
        <div className="workspace-actions"><FilterSelect label={t('status')} value={queueStatus} onChange={setQueueStatus}
          options={[{ value: '', label: t('allOrders') }, { value: 'ready', label: t('ready') },
            { value: 'partly_received', label: t('partly_received') }]} /><input className="text-input" type="date" aria-label={t('expectedDate')} value={date} onChange={(event) => setDate(event.target.value)} /></div>
      </div><QueueTable records={rows} /></> : <>
        <div className="table-toolbar">
          <SearchField label={t('searchDiscrepancies')} value={search} onChange={setSearch} />
          <FilterSelect label={t('status')} value={findingStatus} onChange={setFindingStatus}
            options={[{ value: 'open', label: t('open') }, { value: 'resolved', label: t('resolved') }, { value: 'all', label: t('allStatuses') }]} />
        </div>
        {findingStatus !== 'open' && resolved.isError ? <RecordState state="error" action={() => { void resolved.refetch(); }} /> : findingStatus !== 'open' && resolved.isLoading ? <RecordState state="loading" /> : <FindingsTable records={findingRows} />}
      </>}
    </WarehouseGate></section></>;
}
