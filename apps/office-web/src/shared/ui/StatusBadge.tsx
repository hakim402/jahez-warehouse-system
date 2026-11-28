import { useTranslation } from 'react-i18next';

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return <span className="status-badge" data-status={status}>{t(status, { defaultValue: status })}</span>;
}
