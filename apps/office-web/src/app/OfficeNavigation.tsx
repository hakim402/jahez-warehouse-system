import {
  Boxes, ClipboardList, FileUp, LayoutDashboard, Package, PackageCheck, ReceiptText,
  Settings, Truck, ChartNoAxesCombined,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import icon from '../assets/jahez-icon.png';
import styles from './OfficeShell.module.css';

type NavigationItem = { label: string; icon: LucideIcon; to?: string };
const navigationGroups: NavigationItem[][] = [
  [
    { label: 'dashboard', icon: LayoutDashboard, to: '/' },
    { label: 'purchaseOrders', icon: ClipboardList, to: '/orders' },
    { label: 'receiving', icon: PackageCheck },
    { label: 'inventory', icon: Boxes },
    { label: 'dispatch', icon: Truck },
  ],
  [
    { label: 'catalog', icon: Package, to: '/catalog' },
    { label: 'expenses', icon: ReceiptText },
    { label: 'invoiceImports', icon: FileUp },
    { label: 'reportsExports', icon: ChartNoAxesCombined },
  ],
];

export function OfficeNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <NavLink to="/" className={styles.brand} onClick={onNavigate}>
        <span className={styles.brandIcon}><img src={icon} alt="" width="24" height="17" /></span>
        {t('office')}
      </NavLink>
      <nav className={styles.navigation} aria-label={t('navigation')}>
        {navigationGroups.map((group) => (
          <div className={styles.navGroup} key={group[0].label}>
            {group.map(({ label, icon: Icon, to }) => to
              ? <NavLink key={label} to={to} end={to === '/'} className={styles.navItem} onClick={onNavigate}>
                <Icon size={17} aria-hidden="true" />{t(label)}
              </NavLink>
              : <span key={label} className={styles.navItem} aria-disabled="true">
                <Icon size={17} aria-hidden="true" />{t(label)}
              </span>)}
          </div>
        ))}
        <span className={styles.navItem + ' ' + styles.settings} aria-disabled="true">
          <Settings size={17} aria-hidden="true" />{t('settings')}
        </span>
      </nav>
    </>
  );
}
