import { useTranslation } from 'react-i18next';
import type { OrderStatus } from '../order-api';
import styles from './OrderWorkspace.module.css';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <span className={styles.status} data-order-status={status}>{t(status)}</span>;
}
