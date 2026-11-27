import { Check, ChevronDown } from 'lucide-react';
import { Select } from 'radix-ui';
import { useTranslation } from 'react-i18next';

const emptyValue = '__filter_all__';

export function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; lang?: string }[];
}) {
  const { i18n } = useTranslation();
  return <Select.Root value={value || emptyValue} onValueChange={(next) => onChange(next === emptyValue ? '' : next)}
    dir={i18n.dir()}>
    <Select.Trigger className="text-input filter-select" aria-label={label}>
      <Select.Value /><Select.Icon><ChevronDown size={15} aria-hidden="true" /></Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content className="menu-content filter-options" position="popper" sideOffset={6} collisionPadding={12}>
        <Select.Viewport>
          {options.map((option) => <Select.Item className="menu-item filter-option" key={option.value}
            value={option.value || emptyValue} lang={option.lang}>
            <Select.ItemText>{option.label}</Select.ItemText>
            <Select.ItemIndicator className="filter-check"><Check size={15} aria-hidden="true" /></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
