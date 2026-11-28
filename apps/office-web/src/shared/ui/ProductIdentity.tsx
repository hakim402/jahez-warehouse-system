import { Package } from 'lucide-react';
import { useState } from 'react';
import { photoSource } from '../photo-source';
import { useRecordFormat } from '../format-record';
import { productName, type ProductNames } from '../product-name';

export function ProductIdentity({ product, showModel = true }: { showModel?: boolean; product: ProductNames & { modelNo?: string | null; photoUrl?: string | null } }) {
  const format = useRecordFormat();
  const [failed, setFailed] = useState<string>();
  const src = photoSource(product.photoUrl ?? null);
  return <span className="product-identity">
    <span className="product-thumbnail">{src && src !== failed ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : <Package size={18} aria-hidden="true" />}</span>
    <span><bdi>{productName(product, format.language) || product.modelNo || '—'}</bdi>{showModel && product.modelNo && <bdi className="secondary-line">{product.modelNo}</bdi>}</span>
  </span>;
}
