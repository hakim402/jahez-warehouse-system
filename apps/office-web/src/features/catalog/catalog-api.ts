import { useMemo } from 'react';
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

export { productName, productNameFields, type ProductNames } from '../../shared/product-name';

export function partyName(party: Party | undefined, language: Language) {
  return (language === 'zh-Hans' ? party?.nameCn : undefined) || party?.name || '';
}

export function useProducts() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['catalog', session?.user.tenantId, session?.user.id, 'products'],
    queryFn: ({ signal }) => authenticatedJson<Product[]>('/products', { signal }),
  });
}

export function useParties() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['catalog', session?.user.tenantId, session?.user.id, 'parties'],
    queryFn: ({ signal }) => authenticatedJson<Party[]>('/parties', { signal }),
  });
}

export function useCatalog() {
  const { session } = useSession();
  const queryKey = ['catalog', session?.user.tenantId, session?.user.id] as const;
  const products = useProducts();
  const parties = useParties();
  const data = useMemo<Catalog | undefined>(() => products.data && parties.data
    ? { products: products.data, parties: parties.data } : undefined, [products.data, parties.data]);
  return {
    data, queryKey, isError: products.isError || parties.isError,
    error: products.error || parties.error,
    refetch: () => Promise.all([products.refetch(), parties.refetch()]),
  };
}

type CatalogRecord = Omit<Product, 'id'> | Omit<Party, 'id'>;

export function saveCatalogRecord(record: CatalogRecord, id?: string) {
  const collection = 'type' in record ? '/parties' : '/products';
  return authenticatedJson<Party | Product>(collection + (id ? '/' + encodeURIComponent(id) : ''), {
    method: id ? 'PATCH' : 'POST', json: record,
  });
}
