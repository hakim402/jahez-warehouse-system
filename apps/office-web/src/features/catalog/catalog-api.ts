import { useQuery } from '@tanstack/react-query';
import { authenticatedJson, useSession } from '../../app/session';
import type { Language } from '../../app/i18n';

export type PartyKind = 'supplier' | 'customer';
export type Party = {
  id: string;
  type: PartyKind;
  name: string;
  nameCn: string | null;
  shippingMark: string | null;
  phone: string | null;
  address: string | null;
};
export type Product = {
  id: string;
  nameEn: string | null;
  nameAr: string | null;
  nameCn: string | null;
  modelNo: string | null;
  photoUrl: string | null;
};

export type Catalog = {
  products: Product[];
  parties: Party[];
};

export const productNameFields = { en: 'nameEn', ar: 'nameAr', 'zh-Hans': 'nameCn' } as const;

export function productName(product: Product | undefined, language: Language) {
  return product?.[productNameFields[language]] || product?.nameEn || product?.nameCn || product?.nameAr || '';
}

export function partyName(party: Party | undefined, language: Language) {
  return (language === 'zh-Hans' ? party?.nameCn : undefined) || party?.name || '';
}

export function useCatalog() {
  const { session } = useSession();
  const queryKey = ['catalog', session?.user.tenantId, session?.user.id] as const;
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<Catalog> => {
      const [products, parties] = await Promise.all([
        authenticatedJson<Product[]>('/products', { signal }),
        authenticatedJson<Party[]>('/parties', { signal }),
      ]);
      return { products, parties };
    },
  });
  return { ...query, queryKey };
}

type CatalogRecord = Omit<Product, 'id'> | Omit<Party, 'id'>;

export function saveCatalogRecord(record: CatalogRecord, id?: string) {
  const collection = 'type' in record ? '/parties' : '/products';
  return authenticatedJson<Party | Product>(collection + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST', json: record,
  });
}
