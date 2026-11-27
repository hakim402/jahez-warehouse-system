import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function OrderBackLink() {
  const { t } = useTranslation();
  return <Link to="/orders" className="back-link">
    <ChevronLeft className="rtl-icon" size={16} aria-hidden="true" />{t('purchaseOrders')}
  </Link>;
}
