import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { refreshCurrentSession, signOut, useSession } from '../../../app/session';
import { LabeledField } from '../../../shared/ui/LabeledField';
import { OfficeDialog } from '../../../shared/ui/OfficeDialog';
import { QueryState } from '../../../shared/ui/QueryState';
import { getManagedUser, resetManagedPassword, saveManagedUser, useAssignmentWarehouses, useSettingsKeys, type ManagedRole, type ManagedUser } from '../settings-api';
import { settingsFailure } from '../settings-error';
import styles from './AccessSettings.module.css';

export type UserAction = { mode: 'create' } | { mode: 'edit' | 'reset' | 'status'; user: ManagedUser };
export function UserAccessDialog({ action, onClose, onSaved }: { action: UserAction; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const cache = useQueryClient();
  const keys = useSettingsKeys();
  const warehouses = useAssignmentWarehouses();
  const initial = action.mode === 'create' ? undefined : action.user;
  const [user, setUser] = useState(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<ManagedRole>(initial?.role ?? 'worker');
  const [ids, setIds] = useState(initial?.warehouseIds ?? []);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<ReturnType<typeof settingsFailure>>();
  const [busy, setBusy] = useState(false);
  const identity = action.mode === 'create' || action.mode === 'edit';
  const needsPassword = action.mode === 'create' || action.mode === 'reset';
  const title = action.mode === 'create' ? 'addUser' : action.mode === 'edit' ? 'editUser' : action.mode === 'reset' ? 'resetPassword' : user?.active ? 'disableUser' : 'reactivateUser';

  async function reload() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const latest = await getManagedUser(user.id);
      setUser(latest); setName(latest.name); setPhone(latest.phone); setRole(latest.role); setIds(latest.warehouseIds);
      setPassword(''); setRepeat(''); setErrors({}); setFailure(undefined);
      await warehouses.refetch();
    } catch (error) { setFailure(settingsFailure(error, t)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid: Record<string, string> = {};
    if (identity && !name.trim()) invalid.name = t('requiredValue');
    if (identity && !phone.trim()) invalid.phone = t('requiredValue');
    if (needsPassword && (password.length < 12 || password.length > 128)) invalid.password = t('passwordLength');
    if (action.mode === 'reset' && repeat !== password) invalid.repeat = t('passwordMismatch');
    setErrors(invalid);
    if (Object.keys(invalid).length) { requestAnimationFrame(() => document.querySelector<HTMLElement>('.office-dialog [aria-invalid="true"]')?.focus()); return; }
    if (identity && !warehouses.data) return;
    setBusy(true); setFailure(undefined);
    try {
      const result = action.mode === 'reset'
        ? await resetManagedPassword(user!.id, password, user!.version)
        : await saveManagedUser(action.mode === 'status' ? { active: !user!.active, expectedVersion: user!.version } : {
          name: name.trim(), phone: phone.trim(), role, warehouseIds: ids,
          ...(user ? { expectedVersion: user.version } : { initialPassword: password }),
        }, user?.id);
      if (result.user.id === session?.user.id) {
        if (result.sessionsRevoked) { await signOut(); return; }
        await refreshCurrentSession();
      }
      await Promise.all([keys.users, keys.warehouses, keys.tolerances, ['warehouse'], ['sessions']].map(queryKey => cache.invalidateQueries({ queryKey })));
      onSaved(); onClose();
    } catch (error) { setFailure(settingsFailure(error, t)); }
    finally { setBusy(false); }
  }
  return <OfficeDialog title={t(title)} onClose={onClose} busy={busy} returnFocus={() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-user-action]')).find(button =>
      button.dataset.userAction === action.mode && (action.mode === 'create' || button.dataset.userId === initial?.id)) ?? null}>
    <form onSubmit={save} noValidate><fieldset className={'office-dialog-body ' + styles.fields} disabled={busy}>
      {user && !identity && <div><strong>{user.name}</strong><p className="muted-text"><bdi>{user.phone}</bdi></p></div>}
      {identity && <><div className={styles.twoColumns}>
        <LabeledField label={t('name')} error={errors.name}>{props => <input {...props} autoComplete="off" maxLength={200} value={name} onChange={event => setName(event.target.value)} />}</LabeledField>
        <LabeledField label={t('phone')} error={errors.phone}>{props => <input {...props} type="tel" autoComplete="off" maxLength={64} value={phone} onChange={event => setPhone(event.target.value)} />}</LabeledField>
      </div><LabeledField label={t('userRole')}>{props => <select {...props} value={role} onChange={event => setRole(event.target.value as ManagedRole)}>{(['owner', 'trader', 'worker'] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select>}</LabeledField></>}
      {needsPassword && <LabeledField label={t(action.mode === 'create' ? 'initialPassword' : 'newPassword')} error={errors.password} hint={t('passwordRules')}>{props => <input {...props} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />}</LabeledField>}
      {action.mode === 'reset' && <LabeledField label={t('repeatPassword')} error={errors.repeat}>{props => <input {...props} type="password" autoComplete="new-password" maxLength={128} value={repeat} onChange={event => setRepeat(event.target.value)} />}</LabeledField>}
      {identity && <QueryState query={warehouses}><fieldset className={styles.checks}><legend>{t('assignedWarehouses')}</legend>
        {warehouses.data?.warehouses.length ? warehouses.data.warehouses.map(warehouse => <label key={warehouse.id}><input type="checkbox" checked={ids.includes(warehouse.id)} onChange={event => setIds(current => event.target.checked ? [...current, warehouse.id] : current.filter(id => id !== warehouse.id))} /><span><bdi>{warehouse.name}</bdi> <small className="muted-text"><bdi>{warehouse.code}</bdi></small></span></label>) : <p className="muted-text">{t('noCompanyWarehouses')}</p>}
      </fieldset></QueryState>}
      <p className={styles.note}>{t(action.mode === 'reset' ? 'resetSessionNote' : action.mode === 'status' ? user?.active ? 'disableNote' : 'reactivateNote' : 'permissionSessionNote')}</p>
      {failure && <div role="alert" className={styles.failure}><p>{failure.message}</p>{failure.stale && <button type="button" className="button" onClick={() => void reload()}>{t('reloadLatest')}</button>}{!failure.stale && identity && <button type="button" className="button" onClick={() => void warehouses.refetch()}>{t('retry')}</button>}</div>}
    </fieldset><div className="office-dialog-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button button-primary" disabled={busy || Boolean(failure?.stale) || (identity && (!warehouses.data || warehouses.isError))}>{t(busy ? 'saving' : action.mode === 'status' || action.mode === 'reset' ? title : 'save')}</button></div></form>
  </OfficeDialog>;
}
