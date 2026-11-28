import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, UserRound, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../../app/session';
import { DataTable, type RecordColumn } from '../../../shared/ui/DataTable';
import { FilterSelect } from '../../../shared/ui/FilterSelect';
import { SearchField, ClearFilters } from '../../../shared/ui/ListControls';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { useAssignmentWarehouses, useManagedUsers, type ManagedUser } from '../settings-api';
import { UserAccessDialog, type UserAction } from './UserAccessDialog';
import styles from './AccessSettings.module.css';

export function UsersAccessSettings() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [action, setAction] = useState<UserAction>();
  const [saved, setSaved] = useState(false);
  const query = useManagedUsers({ search: deferredSearch, role, active });
  const warehouses = useAssignmentWarehouses();
  const records = useMemo(() => [...new Map(query.data?.pages.flatMap(page => page.users).map(user => [user.id, user]) ?? []).values()], [query.data]);
  const names = useMemo(() => new Map(warehouses.data?.warehouses.map(warehouse => [warehouse.id, warehouse.name])), [warehouses.data]);
  const filtered = Boolean(search || role || active);
  const clear = () => { setSearch(''); setRole(''); setActive(''); };
  const open = useCallback((action: UserAction) => { setSaved(false); setAction(action); }, []);
  const columns = useMemo<RecordColumn<ManagedUser>[]>(() => [
    { id: 'user', header: t('name'), cell: ({ row: { original: user } }) => <div className={styles.identity}><span className={styles.avatar}><UserRound size={18} aria-hidden="true" /></span><span><strong><bdi>{user.name}</bdi></strong><small><bdi>{user.phone}</bdi></small></span></div> },
    { id: 'role', header: t('userRole'), cell: ({ row }) => <span className={styles.badge}>{t(row.original.role)}</span> },
    { id: 'warehouses', header: t('assignedWarehouses'), cell: ({ row }) => <div className={styles.warehouses}>{row.original.warehouseIds.length ? row.original.warehouseIds.map(id => <span className={styles.badge} key={id}><bdi>{names.get(id) ?? t('warehouseUnavailable')}</bdi></span>) : <span className="muted-text">{t('noWarehouseAccess')}</span>}</div> },
    { id: 'status', header: t('status'), cell: ({ row }) => <span className={styles.status} data-active={row.original.active}>{t(row.original.active ? 'active' : 'inactive')}</span> },
    { id: 'actions', header: t('actions'), cell: ({ row: { original: user } }) => <div className={styles.actions}>
      <button className="button" data-user-action="edit" data-user-id={user.id} aria-label={t('editUser') + ': ' + user.name} title={t('editUser')} onClick={() => open({ mode: 'edit', user })}><Pencil size={15} aria-hidden="true" /></button>
      <button className="button" data-user-action="reset" data-user-id={user.id} aria-label={t('resetPassword') + ': ' + user.name} title={t('resetPassword')} onClick={() => open({ mode: 'reset', user })}><KeyRound size={15} aria-hidden="true" /></button>
      <button className="button" data-user-action="status" data-user-id={user.id} disabled={user.id === session?.user.id && user.active} aria-label={t(user.active ? 'disableUser' : 'reactivateUser') + ': ' + user.name} title={t(user.id === session?.user.id && user.active ? 'selfDisableNote' : user.active ? 'disableUser' : 'reactivateUser')} onClick={() => open({ mode: 'status', user })}>{user.active ? <UserRoundX size={15} aria-hidden="true" /> : <UserRoundCheck size={15} aria-hidden="true" />}</button>
    </div> },
  ], [names, open, session?.user.id, t]);
  return <section className={'surface ' + styles.usersCard}>
    <div className={styles.heading}><div><h2>{t('usersAccess')}</h2><p className="muted-text">{t('usersAccessHint')}</p></div><button className="button button-primary" data-user-action="create" onClick={() => open({ mode: 'create' })}><Plus size={16} aria-hidden="true" />{t('addUser')}</button></div>
    <div className={styles.filters}><SearchField label={t('userSearch')} value={search} onChange={setSearch} /><FilterSelect label={t('userRole')} value={role} onChange={setRole} options={[{ value: '', label: t('allRoles') }, ...['owner', 'trader', 'worker'].map(value => ({ value, label: t(value) }))]} /><FilterSelect label={t('status')} value={active} onChange={setActive} options={[{ value: '', label: t('allStatuses') }, { value: 'true', label: t('active') }, { value: 'false', label: t('inactive') }]} />{filtered && <ClearFilters onClear={clear} />}</div>
    {saved && <p role="status" className={styles.feedback}>{t('userSaved')}</p>}
    {warehouses.isError && <p className="query-warning" role="alert">{t('warehouseUnavailable')} <button className="button" onClick={() => void warehouses.refetch()}>{t('retry')}</button></p>}
    <div className={styles.table}><QueryState query={query}>{records.length ? <DataTable key={[deferredSearch, role, active].join('|')} records={records} columns={columns} label={t('usersAccess')} /> : <RecordState state={filtered ? 'noResults' : 'empty'} action={filtered ? clear : undefined} />}</QueryState></div>
    {query.hasNextPage && <div className="table-footer"><span>{t('loadedUsers', { value: new Intl.NumberFormat(i18n.resolvedLanguage).format(records.length) })}</span><button className="button" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t(query.isFetchingNextPage ? 'loadingRecords' : 'loadMoreUsers')}</button></div>}
    {action && <UserAccessDialog action={action} onClose={() => setAction(undefined)} onSaved={() => setSaved(true)} />}
  </section>;
}
