import { useState, type FormEvent } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../api/client';
import { useSession } from '../../../app/session';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { saveExpenseCategory, useExpenseCategories, type ExpenseCategory } from '../../expenses/expenses-api';
import styles from './SettingsPage.module.css';

export function CategorySettings() {
  const { t } = useTranslation();
  const { session } = useSession();
  const categories = useExpenseCategories();
  const [editing, setEditing] = useState<ExpenseCategory | 'new'>();
  if (session?.user.role !== 'owner') return <RecordState state="error" message={t('restricted')} />;
  const columns: RecordColumn<ExpenseCategory>[] = [
    { id: 'name', header: t('name'), cell: ({ row }) => <bdi>{row.original.name}</bdi> },
    { id: 'nameCn', header: t('nameCn'), cell: ({ row }) => <bdi>{row.original.nameCn || '—'}</bdi> },
    { id: 'status', header: t('status'), cell: ({ row }) => <span className={styles.categoryStatus} data-active={row.original.active}>{t(row.original.active ? 'active' : 'inactive')}</span> },
    { id: 'edit', header: t('actions'), cell: ({ row }) => <button className="button" onClick={() => setEditing(row.original)}><Pencil size={14} aria-hidden="true" />{t('edit')}</button> },
  ];
  return <section className="surface workspace-panel"><div className={styles.panelHeading}><h2>{t('expenseCategories')}</h2><button className="button button-primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" />{t('addCategory')}</button></div>
    <QueryState query={categories}>{categories.data?.length ? <DataTable records={categories.data} columns={columns} label={t('expenseCategories')} /> : <RecordState state="empty" />}</QueryState>
    {editing && <CategoryDialog category={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
  </section>;
}
function CategoryDialog({ category, onClose }: { category?: ExpenseCategory; onClose: () => void }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const categories = useExpenseCategories();
  const [name, setName] = useState(category?.name ?? '');
  const [nameCn, setNameCn] = useState(category?.nameCn ?? '');
  const [active, setActive] = useState(category?.active ?? true);
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError(t('nameRequired')); event.currentTarget.querySelector('input')?.focus(); return; }
    setBusy(true); setFailure(undefined);
    try {
      await saveExpenseCategory({ name: name.trim(), nameCn: nameCn.trim() || null, ...(category ? { active } : {}) }, category?.id);
      await cache.invalidateQueries({ queryKey: categories.queryKey }); onClose();
    } catch (error) { setFailure(error instanceof ApiError && error.status === 403 ? t('restricted') : error instanceof ApiError && error.validationMessage || t('saveFailed')); }
    finally { setBusy(false); }
  }
  return <OfficeDialog title={t(category ? 'editCategory' : 'addCategory')} onClose={onClose} busy={busy}>
    <form onSubmit={save} noValidate><fieldset className={'office-dialog-body ' + styles.categoryFields} disabled={busy}>
      <LabeledField label={t('name')} error={error}>{(attributes) => <input {...attributes} maxLength={200} value={name} onChange={(event) => { setName(event.target.value); setError(undefined); }} />}</LabeledField>
      <LabeledField label={t('nameCn')} hint={t('optional')}>{(attributes) => <input {...attributes} maxLength={2000} value={nameCn} onChange={(event) => setNameCn(event.target.value)} />}</LabeledField>
      {category && <label className={styles.activeToggle}><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{t('active')}</label>}
      {failure && <p className="field-error" role="alert">{failure}</p>}
    </fieldset><div className="office-dialog-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button button-primary" disabled={busy}>{t(busy ? 'saving' : 'save')}</button></div></form>
  </OfficeDialog>;
}
