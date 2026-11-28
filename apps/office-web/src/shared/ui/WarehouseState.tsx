import { useTranslation } from 'react-i18next';
import type { ActiveWarehouse } from '../../app/use-active-warehouse';
import { RecordState } from './RecordState';

export function WarehouseState({ active }: { active: ActiveWarehouse }) {
  const { t } = useTranslation();
  return <RecordState
    state={active.title === 'loadingWarehouse' ? 'loading' : 'error'}
    message={t(active.message ?? active.title)}
    action={active.retry}
  />;
}
