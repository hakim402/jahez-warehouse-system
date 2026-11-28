import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

export function SearchField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="record-search">
      <Search size={16} aria-hidden="true" />
      <input type="search" className="text-input" aria-label={label} placeholder={label} value={value}
        onChange={(event) => onChange(event.currentTarget.value)} />
    </div>
  );
}

export function ListTabs<T extends string>({ items, selected, onChange, label, end }: {
  items: readonly { id: T; name: string; count?: number; partial?: boolean }[];
  selected: T;
  onChange: (id: T) => void;
  label: string;
  end?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.resolvedLanguage);
  return (
    <div className="list-tabs">
      <div className="list-tab-group" role="group" aria-label={label}>
        {items.map((item) => (
          <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => onChange(item.id)}>
            {item.name} {item.count !== undefined && <span>{number.format(item.count)}{item.partial ? "+" : ""}</span>}
          </button>
        ))}
      </div>
      {end && <p className="muted-text">{end}</p>}
    </div>
  );
}

export function ClearFilters({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return <button type="button" className="clear-filters" onClick={onClear}>{t('clearFilters')}</button>;
}
