import {
  Boxes, ClipboardList, FileUp, LayoutDashboard, Package, PackageCheck, ReceiptText,
  Settings, Truck, ChartNoAxesCombined,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import icon from '../assets/jahez-icon.png';
import styles from './OfficeShell.module.css';

const navigationGroups = [
  [
    { label: 'purchaseOrders', icon: ClipboardList },
    { label: 'receiving', icon: PackageCheck },
    { label: 'inventory', icon: Boxes },
    { label: 'dispatch', icon: Truck },
  ],
  [
    { label: 'catalog', icon: Package },
    { label: 'expenses', icon: ReceiptText },
    { label: 'invoiceImports', icon: FileUp },
    { label: 'reportsExports', icon: ChartNoAxesCombined },
  ],
] as const;

export function OfficeNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <NavLink to="/" className={styles.brand} onClick={onNavigate}>
        <span className={styles.brandIcon}><img src={icon} alt="" width="24" height="17" /></span>
        {t('office')}
      </NavLink>
      <nav className={styles.navigation} aria-label={t('navigation')}>
        <div className={styles.navGroup}>
          <NavLink to="/" end className={styles.navItem} onClick={onNavigate}>
            <LayoutDashboard size={17} aria-hidden="true" />{t('dashboard')}
          </NavLink>
          {navigationGroups[0].map(({ label, icon: Icon }) => (
            <span key={label} className={styles.navItem} aria-disabled="true">
              <Icon size={17} aria-hidden="true" />{t(label)}
            </span>
          ))}
        </div>
        <div className={styles.navGroup}>
          {navigationGroups[1].map(({ label, icon: Icon }) => (
            <span key={label} className={styles.navItem} aria-disabled="true">
              <Icon size={17} aria-hidden="true" />{t(label)}
            </span>
          ))}
        </div>
        <span className={styles.navItem + ' ' + styles.settings} aria-disabled="true">
          <Settings size={17} aria-hidden="true" />{t('settings')}
        </span>
      </nav>
    </>
  );
}
