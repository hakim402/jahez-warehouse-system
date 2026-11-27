import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { useRecordFormat } from '../format-record';
import { LabeledField } from './LabeledField';
import styles from './DateRangeFilter.module.css';

export function DateRangeFilter({ label, from, to, onFromChange, onToChange }: {
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const format = useRecordFormat();
  const active = Boolean(from || to);
  const range = from && to ? `${format.date(from)} – ${format.date(to)}` :
    from ? `${t('fromDate')} ${format.date(from)}` : to ? `${t('toDate')} ${format.date(to)}` : label;

  return <Popover.Root>
    <Popover.Trigger className={'text-input filter-select ' + styles.trigger} aria-label={label} data-active={active}>
      <CalendarDays size={16} aria-hidden="true" />
      <span className={styles.triggerLabel}>{range}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className={'menu-content ' + styles.panel} align="end" sideOffset={8}
        collisionPadding={12} aria-label={label} dir={i18n.dir()}>
        <div className={styles.heading}>
          <span className={styles.calendarIcon}><CalendarDays size={18} aria-hidden="true" /></span>
          <h2>{label}</h2>
          <Popover.Close className="icon-button" aria-label={t('close')}><X size={16} aria-hidden="true" /></Popover.Close>
        </div>
        <div className={styles.fields}>
          <LabeledField label={t('fromDate')}>
            {(props) => <input {...props} type="date" value={from} max={to || undefined}
              onChange={(event) => onFromChange(event.currentTarget.value)} />}
          </LabeledField>
          <LabeledField label={t('toDate')}>
            {(props) => <input {...props} type="date" value={to} min={from || undefined}
              onChange={(event) => onToChange(event.currentTarget.value)} />}
          </LabeledField>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.clear} disabled={!active}
            onClick={() => { onFromChange(''); onToChange(''); }}>{t('clearFilters')}</button>
          <Popover.Close className="button button-primary">{t('close')}</Popover.Close>
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
