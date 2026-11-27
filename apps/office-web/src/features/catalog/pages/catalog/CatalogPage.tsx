import { Package, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { languages, type Language } from '../../../../app/i18n';
import { useRecordFormat } from '../../../../shared/format-record';
import { DataTable, type RecordColumn } from '../../../../shared/ui/DataTable';
import { ListTabs, SearchField } from '../../../../shared/ui/ListControls';
import { FilterSelect } from '../../../../shared/ui/FilterSelect';
import { RecordState } from '../../../../shared/ui/RecordState';
import { partyName, productName, productNameFields, useCatalog, type Party, type Product } from '../../catalog-api';
import { CatalogEditor, catalogAction, photoSource, type CatalogEditorState } from './CatalogEditor';
import styles from './CatalogPage.module.css';

const kindLabels = { product: 'products', supplier: 'suppliers', customer: 'customers' } as const;
type Kind = keyof typeof kindLabels;
type CatalogRow = Product | Party;
const empty: CatalogRow[] = [];
const catalogLanguages = Object.keys(languages) as Language[];

function ProductPhoto({ value }: { value: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const src = photoSource(value);
  return <span className={styles.thumbnail}>
    {src && src !== failedSrc
      ? <img src={src} width="40" height="40" alt="" loading="lazy" referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)} />
      : <Package size={17} aria-hidden="true" />}
  </span>;
}

export default function CatalogPage() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const catalog = useCatalog();
  const [kind, setKind] = useState<Kind>('product');
  const [search, setSearch] = useState('');
  const [nameLanguage, setNameLanguage] = useState<Language | ''>('');
  const [photoStatus, setPhotoStatus] = useState('');
  const [editor, setEditor] = useState<CatalogEditorState>();
  const records = useMemo(() => {
    if (!catalog.data) return empty;
    return kind === 'product' ? catalog.data.products : catalog.data.parties.filter((party) => party.type === kind);
  }, [catalog.data, kind]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(format.language);
    return records.filter((record) => {
      const terms = 'type' in record ? [record.name, record.nameCn, record.shippingMark] :
        [record.nameEn, record.nameAr, record.nameCn, record.modelNo];
      if (needle && !terms.some((term) => term?.toLocaleLowerCase(format.language).includes(needle))) return false;
      if ('type' in record) return true;
      if (nameLanguage && !record[productNameFields[nameLanguage]]) return false;
      return !photoStatus || (photoStatus === 'with' ? Boolean(record.photoUrl) : !record.photoUrl);
    });
  }, [records, search, nameLanguage, photoStatus, format.language]);

  const columns: RecordColumn<CatalogRow>[] = kind === 'product' ? [
    { id: 'name', header: t('product'), cell: ({ row: { original: record } }) => {
      if ('type' in record) return null;
      return <div className={styles.productName}>
        <ProductPhoto value={record.photoUrl} />
        <bdi>{productName(record, format.language) || record.modelNo || '—'}</bdi>
      </div>;
    } },
    { id: 'model', header: t('modelNo'), cell: ({ row }) => (
      <bdi>{'modelNo' in row.original ? row.original.modelNo || '—' : '—'}</bdi>
    ) },
    { id: 'languages', header: t('namesAvailable'), cell: ({ row: { original: record } }) =>
      'type' in record ? null : <div className={styles.languageTags}>{catalogLanguages
        .filter((language) => Boolean(record[productNameFields[language]]))
        .map((language) => <span key={language} lang={language}>{languages[language].label}</span>)}</div> },
  ] : [
    { id: 'name', header: t('name'), cell: ({ row }) => 'type' in row.original
      ? <div><bdi>{partyName(row.original, format.language)}</bdi>
        {row.original.nameCn && format.language !== 'zh-Hans' &&
          <bdi lang="zh-Hans" className="secondary-line">{row.original.nameCn}</bdi>}</div> : null },
    { id: 'mark', header: t('shippingMark'), cell: ({ row }) =>
      <bdi>{'shippingMark' in row.original ? row.original.shippingMark || '—' : '—'}</bdi> },
    { id: 'phone', header: t('phone'), cell: ({ row }) =>
      <bdi dir="ltr">{'phone' in row.original ? row.original.phone || '—' : '—'}</bdi> },
    { id: 'address', header: t('address'), cell: ({ row }) =>
      <bdi>{'address' in row.original ? row.original.address || '—' : '—'}</bdi> },
  ];
  columns.push({ id: 'edit', header: () => <span className="sr-only">{t('edit')}</span>, cell: ({ row: { original: record } }) => (
    <button type="button" className={styles.edit} onClick={() => setEditor('type' in record
      ? { kind: record.type, record } : { kind: 'product', record })}>
      <Pencil size={14} aria-hidden="true" />{t('edit')}
    </button>
  ) });
  const items = (Object.keys(kindLabels) as Kind[]).map((item) => ({
    id: item, name: t(kindLabels[item]),
    count: item === 'product' ? catalog.data?.products.length ?? 0 :
      catalog.data?.parties.filter((party) => party.type === item).length ?? 0,
  }));
  function clear() {
    setSearch(''); setNameLanguage(''); setPhotoStatus('');
  }

  return (
    <>
      <div className="workspace-heading">
        <h1>{t('catalog')}</h1>
        <button type="button" className="button button-primary" onClick={() => setEditor({ kind })}>
          <Plus size={16} aria-hidden="true" />{t(catalogAction[kind].add)}
        </button>
      </div>
      <section className="surface workspace-panel" aria-label={t('catalog')}>
        <ListTabs items={items} selected={kind} onChange={(item) => { setKind(item); clear(); }}
          label={t('catalog')} end={t('catalogShared')} />
        <div className="table-toolbar">
          <SearchField label={t(kind === 'product' ? 'searchProducts' : 'searchParties')} value={search} onChange={setSearch} />
          {kind === 'product' && <div className="workspace-actions">
            <FilterSelect label={t('nameLanguage')} value={nameLanguage}
              onChange={(value) => setNameLanguage(value as Language | '')}
              options={[{ value: '', label: t('nameLanguage') }, ...catalogLanguages.map((language) =>
                ({ value: language, label: languages[language].label, lang: language }))]} />
            <FilterSelect label={t('photoStatus')} value={photoStatus} onChange={setPhotoStatus}
              options={[{ value: '', label: t('photoStatus') }, { value: 'with', label: t('withPhoto') },
                { value: 'without', label: t('withoutPhoto') }]} />
          </div>}
        </div>
        {catalog.isError ? <RecordState state="error" action={() => { void catalog.refetch(); }} /> :
          !catalog.data ? <RecordState state="loading" /> :
            filtered.length ? <DataTable key={kind} records={filtered} columns={columns} label={t(kindLabels[kind])} /> :
              records.length ? <RecordState state="noResults" action={clear} /> : <RecordState state="empty" />}
      </section>
      {editor && <CatalogEditor editor={editor} queryKey={catalog.queryKey} onClose={() => setEditor(undefined)} />}
    </>
  );
}
