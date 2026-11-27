import { Suspense, useState } from 'react';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { Dialog, DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { LanguageMenu } from '../shared/ui/LanguageMenu';
import { RecordState } from '../shared/ui/RecordState';
import { OfficeNavigation } from './OfficeNavigation';
import { signOut, useSession } from './session';
import { useActiveWarehouse } from './use-active-warehouse';
import styles from './OfficeShell.module.css';

export function OfficeShell() {
  const { t } = useTranslation();
  const { session } = useSession();
  const warehouse = useActiveWarehouse();
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (!session) return null;

  const { name, role } = session.user;
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((word) => Array.from(word)[0]).join('').toUpperCase();

  return (
    <div className={styles.shell + ' office-background'}>
      <a className="skip-link" href="#office-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('office-content')?.focus();
        }}>{t('skipToContent')}</a>
      <aside className={styles.sidebar}><OfficeNavigation /></aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Dialog.Trigger className={styles.mobileTrigger + ' icon-button'} aria-label={t('openNavigation')}>
              <Menu size={22} aria-hidden="true" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className={styles.overlay} />
              <Dialog.Content className={styles.drawer} aria-describedby={undefined}>
                <Dialog.Title className="sr-only">{t('navigation')}</Dialog.Title>
                <Dialog.Close className={styles.closeDrawer + ' icon-button'} aria-label={t('closeNavigation')}>
                  <X size={20} aria-hidden="true" />
                </Dialog.Close>
                <OfficeNavigation onNavigate={() => setDrawerOpen(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <div className={styles.warehouse} aria-live="polite">
            {warehouse.warehouse ? <bdi>{warehouse.warehouse.name}</bdi> : t(warehouse.title)}
          </div>
          <div className={styles.accountControls}>
            <LanguageMenu />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="menu-trigger" aria-label={t('accountMenu')}>
                <span className={styles.avatar} aria-hidden="true">{initials}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="menu-content" align="end" sideOffset={8}>
                  <DropdownMenu.Label className="menu-label">
                    <bdi>{name}</bdi> · {t(role)}
                  </DropdownMenu.Label>
                  <DropdownMenu.Item className="menu-item" onSelect={() => void signOut()}>
                    <LogOut size={16} aria-hidden="true" />{t('signOut')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        <main id="office-content" className={styles.content} tabIndex={-1}>
          <Suspense fallback={<RecordState state="loading" />}>
            <Outlet context={warehouse} />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
