import { Search } from 'lucide-react';
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
  items: readonly { id: T; name: string; count: number }[];
  selected: T;
  onChange: (id: T) => void;
  label: string;
  end?: ReactNode;
}) {
  return (
    <div className="list-tabs">
      <div className="list-tab-group" role="group" aria-label={label}>
        {items.map((item) => (
          <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => onChange(item.id)}>
            {item.name} <span>{item.count}</span>
          </button>
        ))}
      </div>
      {end && <p className="muted-text">{end}</p>}
    </div>
  );
}
