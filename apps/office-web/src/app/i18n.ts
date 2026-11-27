import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { arabic, chinese, english } from './translations';

export const languages = {
  en: { label: 'English', direction: 'ltr' },
  ar: { label: 'العربية', direction: 'rtl' },
  'zh-Hans': { label: '简体中文', direction: 'ltr' },
} as const;
export type Language = keyof typeof languages;
const preferenceKey = 'jahez.office.language';

export function officeLanguage(value: string | undefined): Language {
  return value === 'ar' || value === 'zh-Hans' ? value : 'en';
}

function savedLanguage() {
  try {
    return officeLanguage(localStorage.getItem(preferenceKey) ?? undefined);
  } catch {
    return 'en';
  }
}

function applyLanguage(value: string) {
  const language = officeLanguage(value);
  document.documentElement.lang = language;
  document.documentElement.dir = languages[language].direction;
  try {
    localStorage.setItem(preferenceKey, language);
  } catch {
    // The language can still change when browser storage is disabled.
  }
}

export async function initLanguage() {
  const language = savedLanguage();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'en',
    supportedLngs: Object.keys(languages),
    resources: {
      en: { translation: english },
      ar: { translation: arabic },
      'zh-Hans': { translation: chinese },
    },
    interpolation: { escapeValue: false },
  });
  applyLanguage(language);
  i18n.on('languageChanged', applyLanguage);
}
