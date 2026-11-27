import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function OfficeDialog({ title, children, onClose, busy = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const trigger = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="office-dialog-overlay" />
        <Dialog.Content className="office-dialog" aria-describedby={undefined} aria-busy={busy}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}>
          <div className="office-dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close aria-label={t('close')} className="icon-button" disabled={busy}>
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
