import { Monitor, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { signOut, useSession } from '../../../app/session';
import { useRecordFormat } from '../../../shared/format-record';
import { LanguageMenu } from '../../../shared/ui/LanguageMenu';
import { ListTabs } from '../../../shared/ui/ListControls';
import { QueryState } from '../../../shared/ui/QueryState';
import { RecordState } from '../../../shared/ui/RecordState';
import { revokeOfficeSession, useOfficeSessions } from '../settings-api';
import { CategorySettings } from './CategorySettings';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { session } = useSession();
  const format = useRecordFormat();
  const query = useOfficeSessions();
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const owner = session?.user.role === 'owner';
  const tab = owner && params.get('tab') === 'categories' ? 'categories' : 'account';
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState(false);
  async function revoke(id: string) {
    if (pending) return;
    setPending(id); setError(false);
    try {
      await revokeOfficeSession(id);
      if (id === session?.sessionId) { await signOut(); return; }
      await cache.invalidateQueries({ queryKey: ['sessions'] });
    } catch { setError(true); } finally { setPending(undefined); }
  }
  if (!session) return null;
  return <>
    <div className="workspace-heading"><h1>{t('settings')}</h1></div>
    <section className={'surface ' + styles.tabs}><ListTabs label={t('settings')} selected={tab} onChange={(value) => setParams(value === 'account' ? {} : { tab: value })}
      items={[{ id: 'account', name: t('account') }, ...(owner ? [{ id: 'categories', name: t('expenseCategories') }] : [])]} /></section>
    {tab === 'categories' ? <CategorySettings /> : <div className={styles.layout}>
      <section className={'surface ' + styles.account}><h2>{t('myAccount')}</h2><div className={styles.identity}><span className={styles.avatar}><UserRound size={24} aria-hidden="true" /></span><div><strong>{session.user.name}</strong><p className="muted-text">{t(session.user.role)}</p></div></div><div className={styles.language}><span>{t('language')}</span><LanguageMenu /></div></section>
      <section className="surface workspace-panel"><h2 className="panel-heading">{t('activeSessions')}</h2>
        {error && <p className={'field-error ' + styles.error} role="alert">{t('sessionRevokeFailed')}</p>}
        <QueryState query={query}>{query.data?.some((item) => Date.parse(item.expiresAt) > Date.now()) ? <div className="table-scroll" tabIndex={0} role="region" aria-label={t('activeSessions')}><table className="records-table"><thead><tr>{['device', 'signedIn', 'lastActive', 'actions'].map((key) => <th key={key} scope="col">{t(key)}</th>)}</tr></thead><tbody>
          {query.data.filter((item) => Date.parse(item.expiresAt) > Date.now()).map((item) => <tr key={item.id}><td><div className={styles.device}><Monitor size={18} aria-hidden="true" /><span><bdi>{item.deviceId || t('unknownDevice')}</bdi>{item.id === session.sessionId && <span className={styles.current}>{t('currentSession')}</span>}</span></div></td><td>{format.dateTime(item.createdAt)}</td><td>{format.dateTime(item.lastUsedAt)}</td><td><button className={styles.signOut} disabled={Boolean(pending)} onClick={() => void revoke(item.id)}>{t(pending === item.id ? 'saving' : 'signOut')}</button></td></tr>)}
        </tbody></table></div> : <RecordState state="empty" />}</QueryState>
      </section>
    </div>}
  </>;
}
