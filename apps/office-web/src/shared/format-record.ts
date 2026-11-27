import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { officeLanguage } from '../app/i18n';

export function useRecordFormat() {
  const { i18n } = useTranslation();
  const language = officeLanguage(i18n.resolvedLanguage);
  return useMemo(() => {
    const date = new Intl.DateTimeFormat(language, {
      dateStyle: 'medium', timeZone: 'UTC', calendar: 'gregory',
    });
    const number = new Intl.NumberFormat(language);
    const amount = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const unitPrice = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const currencyNames = new Intl.DisplayNames(language, { type: 'currency' });
    return {
      language,
      date: (value: string | null) => value ? date.format(new Date(value + 'T00:00:00Z')) : '—',
      quantity: (value: number | null) => value === null ? '—' : number.format(value),
      amount: (value: number | null) => value === null ? '—' : amount.format(value),
      unitPrice: (value: number | null) => value === null ? '—' : unitPrice.format(value),
      currencyName: (value: string | null) => value && /^[A-Z]{3}$/.test(value)
        ? value + ' · ' + currencyNames.of(value)
        : value || '—',
    };
  }, [language]);
}
