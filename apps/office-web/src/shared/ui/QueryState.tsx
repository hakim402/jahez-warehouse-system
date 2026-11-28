import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RecordState } from './RecordState';

export function QueryState({ query, children }: {
  query: { data: unknown; isError: boolean; isFetching: boolean; refetch: () => Promise<unknown> };
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (query.data === undefined) {
    return query.isError ? <RecordState state="error" action={() => { void query.refetch(); }} /> : <RecordState state="loading" />;
  }
  return <>
    {query.isError ? <p className="query-warning" role="alert">{t('refreshFailed')} <button className="button" onClick={() => { void query.refetch(); }}>{t('retry')}</button></p> :
      query.isFetching && <span className="sr-only" role="status">{t('loadingRecords')}</span>}
    {children}
  </>;
}
