import { ExportLink } from '../../reports/components/ExportLink';
import { useSearchParams } from 'react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearFilters, ListTabs, SearchField } from '../../../shared/ui/ListControls';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { useFindings } from '../receiving-api';
import { useWarehouseData } from '../../stock/warehouse-api';
import { WarehouseGate } from '../../../shared/ui/WarehouseGate';
import { QueryState } from '../../../shared/ui/QueryState';
import { QueueTable, FindingsTable } from '../components/ReceivingTables';

export default function ReceivingPage() {
  const { t } = useTranslation();
  const data = useWarehouseData(['queue', 'findings']);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'findings' ? 'findings' : 'queue';
  const setTab = (value: string) => setParams(value === 'findings' ? { tab: value } : {});
  const [queueSearch, setQueueSearch] = useState('');
  const [findingSearch, setFindingSearch] = useState('');
  const [queueStatus, setQueueStatus] = useState('');
  const [findingStatus, setFindingStatus] = useState('open');
  const [date, setDate] = useState('');
  const resolved = useFindings(data.scope, 'resolved', tab === 'findings' && findingStatus !== 'open');
  const queue = data.queue.data ?? [];
  const openFindings = data.findings.data ?? [];
  const resolvedFindings = resolved.data ?? [];
  const findings = findingStatus === 'resolved' ? resolvedFindings : findingStatus === 'all' ? [...openFindings, ...resolvedFindings] : openFindings;
  const queueNeedle = queueSearch.trim().toLocaleLowerCase();
  const needle = findingSearch.trim().toLocaleLowerCase();
  const clearQueue = () => { setQueueSearch(''); setQueueStatus(''); setDate(''); };
  const clearFindings = () => { setFindingSearch(''); setFindingStatus('open'); };
  const queueFiltered = Boolean(queueSearch.trim() || queueStatus || date);
  const findingsFiltered = Boolean(findingSearch.trim() || findingStatus !== 'open');
  const rows = queue.filter((order) => (!queueStatus || order.status === queueStatus) && (!date || order.expectedDate === date) &&
    [order.orderNo, order.supplier.name, order.customer.name, order.customer.shippingMark].some((value) => value?.toLocaleLowerCase().includes(queueNeedle)));
  const findingRows = findings.filter((finding) => !needle || [finding.type, t(finding.type), finding.receiptId, finding.id, finding.note]
    .some((value) => value?.toLocaleLowerCase().includes(needle)));
  return <><div className="workspace-heading"><h1>{t('receiving')}</h1>{data.scope.warehouseId && <ExportLink kind="goods_received" />}</div>
    <section className="surface workspace-panel"><WarehouseGate scope={data.scope}>
      <ListTabs label={t('receiving')} selected={tab} onChange={setTab} items={[
        { id: 'queue', name: t('expectedDeliveries'), count: data.queue.data?.length },
        { id: 'findings', name: t('discrepancies'), count: data.findings.data?.length },
      ]} />
      {tab === 'queue' ? <><div className="table-toolbar">
        <SearchField label={t('searchOrders')} value={queueSearch} onChange={setQueueSearch} />
        <div className="workspace-actions"><FilterSelect label={t('status')} value={queueStatus} onChange={setQueueStatus}
          options={[{ value: '', label: t('allOrders') }, { value: 'ready', label: t('ready') },
            { value: 'partly_received', label: t('partly_received') }]} /><input className="text-input" type="date" aria-label={t('expectedDate')} value={date} onChange={(event) => setDate(event.target.value)} />{queueFiltered && <ClearFilters onClear={clearQueue} />}</div>
      </div><QueryState query={data.queue}><QueueTable records={rows} onClear={queueFiltered ? clearQueue : undefined} /></QueryState></> : <>
        <div className="table-toolbar">
          <SearchField label={t('searchDiscrepancies')} value={findingSearch} onChange={setFindingSearch} />
          <div className="workspace-actions"><FilterSelect label={t('status')} value={findingStatus} onChange={setFindingStatus}
            options={[{ value: 'open', label: t('open') }, { value: 'resolved', label: t('resolved') }, { value: 'all', label: t('allStatuses') }]} />{findingsFiltered && <ClearFilters onClear={clearFindings} />}</div>
        </div>
        <QueryState query={findingStatus === 'resolved' ? resolved : data.findings}>
          {findingStatus === 'all' ? <QueryState query={resolved}><FindingsTable records={findingRows} onClear={findingsFiltered ? clearFindings : undefined} /></QueryState> :
            <FindingsTable records={findingRows} onClear={findingsFiltered ? clearFindings : undefined} />}
        </QueryState>
      </>}
    </WarehouseGate></section></>;
}
