import type { Language } from '../app/i18n';

export type ProductNames = { nameEn: string | null; nameAr: string | null; nameCn: string | null };
export const productNameFields = { en: 'nameEn', ar: 'nameAr', 'zh-Hans': 'nameCn' } as const;

export function productName(product: ProductNames | undefined, language: Language) {
  return product?.[productNameFields[language]] || product?.nameEn || product?.nameCn || product?.nameAr || '';
}
