import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import type { ActiveWarehouse } from '../../../../app/use-active-warehouse';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { t } = useTranslation();
  const active = useOutletContext<ActiveWarehouse>();

  return (
    <>
      <h1 className={styles.title}>{t('dashboard')}</h1>
      <section className={styles.warehouse + ' surface'} aria-labelledby="active-warehouse">
        <h2 id="active-warehouse">{t('activeWarehouse')}</h2>
        <div aria-live="polite">
          {active.warehouse
            ? <p><bdi>{active.warehouse.name}</bdi> · <bdi>{active.warehouse.code}</bdi></p>
            : <p>{t(active.title)}</p>}
          {active.message && <p className={styles.details}>{t(active.message)}</p>}
        </div>
        {active.retry && <button type="button" className="button" onClick={active.retry}>{t('retry')}</button>}
      </section>
    </>
  );
}
