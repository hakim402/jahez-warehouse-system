import { ArrowDown, ArrowUp, FileText, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useWarehouseScope } from '../../../app/use-warehouse-scope';
import { useRecordFormat } from '../../../shared/format-record';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { DateRangeFilter } from '../../../shared/ui/DateRangeFilter';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { ClearFilters, SearchField } from '../../../shared/ui/ListControls';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { WarehouseGate } from '../../../shared/ui/WarehouseGate';
import { PrivateFileDialog } from '../../files/components/PrivateFileDialog';
import { ExpenseDialog } from '../components/ExpenseDialog';
import { categoryName, useExpenseCategories, useExpenses, type Expense } from '../expenses-api';
import styles from './ExpensesPage.module.css';

const noExpenses: Expense[] = [];

export default function ExpensesPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const scope = useWarehouseScope();
  const query = useExpenses(scope);
  const categories = useExpenseCategories();
  const [recording, setRecording] = useState(false);
  const [evidence, setEvidence] = useState<Expense>();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [customer, setCustomer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [oldest, setOldest] = useState(false);
  const rows = query.data ?? noExpenses;
  const needle = search.trim().toLocaleLowerCase(format.language);
  const filtered = useMemo(() => rows.filter((row) => (!category || row.categoryId === category) && (!customer || row.customerId === customer) &&
    (!from || row.expenseDate >= from) && (!to || row.expenseDate <= to) && (!needle ||
      [row.expenseNo, row.customerName, row.customerMark, row.orderNo, row.categoryName].some((value) => value?.toLocaleLowerCase(format.language).includes(needle))))
    .sort((a, b) => oldest ? a.expenseDate.localeCompare(b.expenseDate) : b.expenseDate.localeCompare(a.expenseDate)),
    [rows, category, customer, from, to, needle, oldest, format.language]);
  const customers = Array.from(new Map(rows.filter((row) => row.customerId).map((row) => [row.customerId!, {
    value: row.customerId!, label: [row.customerName, row.customerMark].filter(Boolean).join(' · ') || row.customerId!,
  }])).values());
  const categoryOptions = categories.data?.map((item) => ({ value: item.id, label: categoryName(item, format.language) })) ??
    Array.from(new Map(rows.map((row) => [row.categoryId, { value: row.categoryId, label: row.categoryName }])).values());
  const categoryNames = useMemo(() => new Map(categories.data?.map((item) => [item.id, categoryName(item, format.language)])), [categories.data, format.language]);
  const clear = () => { setSearch(''); setCategory(''); setCustomer(''); setFrom(''); setTo(''); };
  const hasFilters = Boolean(needle || category || customer || from || to);
  const SortIcon = oldest ? ArrowUp : ArrowDown;
  const columns: RecordColumn<Expense>[] = [
    { id: 'number', header: t('expenseNo'), cell: ({ row }) => <bdi className="record-link">{row.original.expenseNo}</bdi> },
    { id: 'date', header: () => <button type="button" className={styles.sort} onClick={() => setOldest(!oldest)} aria-label={t(oldest ? 'newestFirst' : 'oldestFirst')}>{t('expenseDate')}<SortIcon size={13} aria-hidden="true" /></button>, cell: ({ row }) => format.date(row.original.expenseDate) },
    { id: 'category', header: t('category'), cell: ({ row }) => <strong>{categoryNames.get(row.original.categoryId) || row.original.categoryName}</strong> },
    { id: 'customer', header: t('customerMark'), cell: ({ row }) => <><bdi>{row.original.customerName || '—'}</bdi><bdi className="secondary-line">{row.original.customerMark}</bdi></> },
    { id: 'order', header: t('purchaseOrder'), cell: ({ row }) => row.original.orderId ? <Link className="record-link" to={'/orders/' + row.original.orderId}>{row.original.orderNo || t('orderDetails')}</Link> : '—' },
    { id: 'amount', header: () => <span className="numeric-value">{t('amount')}</span>, cell: ({ row }) => <bdi className="numeric-value"><small>{row.original.currency}</small> <strong>{format.amount(row.original.amount)}</strong></bdi> },
    { id: 'evidence', header: t('invoiceEvidence'), cell: ({ row }) => <button type="button" className={row.original.invoiceFileId ? styles.invoice : styles.exception} onClick={() => setEvidence(row.original)}><FileText size={14} aria-hidden="true" />{t(row.original.invoiceFileId ? 'viewInvoice' : 'exceptionNoted')}</button> },
  ];
  return <>
    <div className="workspace-heading"><h1>{t('expenses')}</h1><button type="button" className="button button-primary" disabled={!scope.warehouseId} onClick={() => setRecording(true)}><Plus size={16} aria-hidden="true" />{t('recordExpense')}</button></div>
    <section className="surface workspace-panel"><WarehouseGate scope={scope}><QueryState query={query}>
      <div className="table-toolbar"><SearchField label={t('searchExpenses')} value={search} onChange={setSearch} /><div className="workspace-actions">
        <FilterSelect label={t('category')} value={category} onChange={setCategory} options={[{ value: '', label: t('category') }, ...categoryOptions]} />
        <FilterSelect label={t('customer')} value={customer} onChange={setCustomer} options={[{ value: '', label: t('customer') }, ...customers]} />
        <DateRangeFilter label={t('expenseDate')} from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        {hasFilters && <ClearFilters onClear={clear} />}
      </div></div>
      {filtered.length ? <DataTable records={filtered} columns={columns} label={t('expenses')} /> : <RecordState state={hasFilters ? 'noResults' : 'empty'} action={hasFilters ? clear : undefined} />}
      <p className={styles.limit}>{t('expenseLimit')}</p>
    </QueryState></WarehouseGate></section>
    {recording && <ExpenseDialog scope={scope} onClose={() => setRecording(false)} />}
    {evidence?.invoiceFileId && <PrivateFileDialog scope={scope} fileId={evidence.invoiceFileId} name={evidence.expenseNo + '-invoice'} onClose={() => setEvidence(undefined)} />}
    {evidence && !evidence.invoiceFileId && <OfficeDialog title={t('noInvoiceNote')} onClose={() => setEvidence(undefined)}><div className={'office-dialog-body ' + styles.note}><strong>{evidence.expenseNo}</strong><p>{evidence.noInvoiceNote}</p></div></OfficeDialog>}
  </>;
}
