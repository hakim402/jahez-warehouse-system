import { Check, ChevronDown, Globe } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useTranslation } from 'react-i18next';
import { languages, officeLanguage, type Language } from '../../app/i18n';

export function LanguageMenu({ showIcon = true }: { showIcon?: boolean }) {
  const { t, i18n } = useTranslation();
  const selected = officeLanguage(i18n.resolvedLanguage);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="menu-trigger" aria-label={t('language')}>
        {showIcon && <Globe size={15} aria-hidden="true" />}
        <span lang={selected} dir={languages[selected].direction}>{languages[selected].label}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="end" sideOffset={8}>
          <DropdownMenu.Label className="menu-label">{t('language')}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={selected} onValueChange={(language) => void i18n.changeLanguage(language)}>
            {(Object.keys(languages) as Language[]).map((language) => (
              <DropdownMenu.RadioItem key={language} value={language} className="menu-item">
                <span lang={language} dir={languages[language].direction}>{languages[language].label}</span>
                <DropdownMenu.ItemIndicator><Check size={15} aria-hidden="true" /></DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
