import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ClearFilters, ListTabs, SearchField } from '../../../shared/ui/ListControls';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { useRecordFormat } from '../../../shared/format-record';
import { WarehouseGate } from '../../../shared/ui/WarehouseGate';
import { QueryState } from '../../../shared/ui/QueryState';
import { StockTable } from '../components/StockTable';
import { useWarehouseData } from '../warehouse-api';
import { formatStockCount, sumStockCounts } from '../stock-count';

export default function InventoryPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const data = useWarehouseData(['balances', 'age', 'movements']);
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab = requestedTab === 'movements' || requestedTab === 'age' ? requestedTab : 'balances';
  const setTab = (value: string) => setParams(value === 'balances' ? {} : { tab: value });
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [supplier, setSupplier] = useState('');
  const [brand, setBrand] = useState('');
  const balances = data.balances.data ?? [];
  const movements = Array.from(new Map((data.movements.data?.pages.flatMap((page) => page.movements) ?? []).map((row) => [row.id, row])).values());
  const query = tab === 'movements' ? data.movements : tab === 'age' ? data.age : data.balances;
  const clear = () => { setSearch(''); setCustomer(''); setSupplier(''); setBrand(''); };
  const hasFilters = Boolean(search.trim() || customer || supplier || brand);
  const records = tab === 'movements' ? movements : tab === 'age' ? data.age.data ?? [] : balances;
  const filtered = records.filter((row) => (!customer || customer === row.customerMark) && (!supplier || supplier === row.supplierName) && (!brand || brand === row.brand) &&
    Object.values(row.product).some((value) => value?.toLocaleLowerCase(format.language).includes(search.trim().toLocaleLowerCase(format.language))));
  return <><div className="workspace-heading"><h1>{t('inventory')}</h1></div><section className="surface workspace-panel"><WarehouseGate scope={data.scope}>
    <ListTabs end={data.balances.data ? t('stockTotal', { value: formatStockCount(sumStockCounts(balances.map((row) => row.cartons)), format.language) }) : undefined} selected={tab} onChange={setTab} label={t('inventory')} items={(['balances', 'movements', 'age'] as const).map((id) => ({ id, name: t(id), count: id === 'movements' ? (data.movements.data ? movements.length : undefined) : data[id].data?.length, partial: id === 'movements' && data.movements.hasNextPage }))} />
    <div className="table-toolbar"><SearchField label={t('searchProducts')} value={search} onChange={setSearch} /><div className="workspace-actions">
      {([{ key: 'customerMark', label: 'shippingMark', value: customer, set: setCustomer }, { key: 'supplierName', label: 'supplier', value: supplier, set: setSupplier }, { key: 'brand', label: 'brand', value: brand, set: setBrand }] as const).map((filter) =>
        <FilterSelect key={filter.key} label={t(filter.label)} value={filter.value} onChange={filter.set}
          options={[{ value: '', label: t(filter.label) }, ...Array.from(new Set(records.map((row) => row[filter.key]).filter(Boolean)))
            .map((value) => ({ value: value!, label: value! }))]} />)}
    {hasFilters && <ClearFilters onClear={clear} />}</div></div>
    <QueryState query={query}><StockTable key={tab} records={filtered} kind={tab} onClear={hasFilters ? clear : undefined} /></QueryState>
    {tab === 'movements' && data.movements.hasNextPage && <div className="table-footer"><span>{t('loadedMovements', { value: format.quantity(movements.length) })}</span><button className="button" disabled={data.movements.isFetchingNextPage} onClick={() => void data.movements.fetchNextPage()}>{t('loadMore')}</button></div>}
    </WarehouseGate></section></>;
}
