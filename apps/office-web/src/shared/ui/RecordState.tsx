import { CircleAlert, PackageOpen, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function RecordState({ state, message, action }: {
  state: 'loading' | 'error' | 'empty' | 'noResults';
  message?: string;
  action?: () => void;
}) {
  const { t } = useTranslation();
  const Icon = state === 'error' ? CircleAlert : state === 'noResults' ? Search : PackageOpen;
  const labels = { loading: 'loadingRecords', error: 'loadFailed', empty: 'noRecords', noResults: 'noResults' } as const;
  return (
    <div className="record-state" role={state === 'error' ? 'alert' : 'status'}>
      {state === 'loading'
        ? <div className="record-skeleton" aria-hidden="true"><span /><span /><span /></div>
        : <span className="record-state-icon"><Icon size={21} aria-hidden="true" /></span>}
      <p>{message ?? t(labels[state])}</p>
      {action && <button type="button" className="button" onClick={action}>
        {t(state === 'noResults' ? 'clearFilters' : 'retry')}
      </button>}
    </div>
  );
}
