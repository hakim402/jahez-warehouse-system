import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecordFormat } from '../../../shared/format-record';
import styles from './OrderWorkspace.module.css';

export function OrderAmount({ currency, amount }: { currency: string | null; amount: number | null }) {
  const format = useRecordFormat();
  return (
    <bdi className={styles.money}>
      {currency && amount !== null && <span className={styles.moneyCode}>{currency}</span>}
      {format.amount(amount)}
    </bdi>
  );
}

export function OrderSummary({ lineCount, cartons, units, deposit, currency, total, actions }: {
  lineCount: number;
  cartons: number;
  units: number;
  deposit: ReactNode;
  currency: string | null;
  total: number | null;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  return (
    <section className={styles.summary + ' surface workspace-panel'} aria-labelledby="order-summary">
      <h2 id="order-summary">{t('orderSummary')}</h2>
      <dl className={styles.totals}>
        <div><dt>{t('lineItems')}</dt><dd>{format.quantity(lineCount)}</dd></div>
        <div><dt>{t('totalCartons')}</dt><dd>{format.quantity(cartons)}</dd></div>
        <div><dt>{t('totalUnits')}</dt><dd>{format.quantity(units)}</dd></div>
        <div className={styles.divider}><dt>{t('deposit')}</dt><dd>{deposit}</dd></div>
        <div className={styles.divider + ' ' + styles.grandTotal}>
          <dt>{t('orderTotal')}</dt><dd><OrderAmount currency={currency} amount={total} /></dd>
        </div>
      </dl>
      {actions && <div className={styles.summaryActions}>{actions}</div>}
    </section>
  );
}
