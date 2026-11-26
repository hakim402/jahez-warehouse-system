export type ImportKind = 'purchase' | 'expense';

/** A single extracted field: the value, how confident the extractor is (0..1), and where it came from. */
export interface DraftField<T = unknown> {
  value: T | null;
  confidence: number;
  source: string | null;
}

export interface DraftLine {
  description: DraftField<string>;
  brand: DraftField<string>;
  size: DraftField<string>;
  cartons: DraftField<number>;
  qtyPerCarton: DraftField<number>;
  unitPrice: DraftField<number>;
  amount: DraftField<number>;
  cbm: DraftField<number>;
  productId?: string | null;
}

export interface DraftHeader {
  supplierName: DraftField<string>;
  customerName: DraftField<string>;
  orderDate: DraftField<string>;
  currency: DraftField<string>;
  totalAmount: DraftField<number>;
  deposit: DraftField<number>;
  freight: DraftField<number>;
  // Expense-specific
  amount: DraftField<number>;
  expenseDate: DraftField<string>;
  categoryName: DraftField<string>;
}

export interface DraftReview {
  supplierId?: string | null;
  customerId?: string | null;
  categoryId?: string | null;
  reviewedFields?: string[];
}

export interface InvoiceDraft {
  header: DraftHeader;
  lines: DraftLine[];
  review: DraftReview;
}

/** Fields below this confidence must be reviewed (or corrected) before commit. */
export const CONFIDENCE_THRESHOLD = 0.75;

export function field<T>(value: T | null, confidence: number, source: string | null = null): DraftField<T> {
  return { value, confidence: clampConfidence(confidence), source };
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** An empty draft with every field present at zero confidence; extractors fill what they find. */
export function emptyDraft(): InvoiceDraft {
  const none = () => field<string>(null, 0);
  const noneNum = () => field<number>(null, 0);
  return {
    header: {
      supplierName: none(), customerName: none(), orderDate: none(), currency: none(),
      totalAmount: noneNum(), deposit: noneNum(), freight: noneNum(),
      amount: noneNum(), expenseDate: none(), categoryName: none(),
    },
    lines: [],
    review: { reviewedFields: [] },
  };
}

const HEADER_KEYS = Object.keys(emptyDraft().header) as (keyof DraftHeader)[];
const LINE_KEYS: (keyof Omit<DraftLine, 'productId'>)[] = [
  'description', 'brand', 'size', 'cartons', 'qtyPerCarton', 'unitPrice', 'amount', 'cbm',
];

/**
 * Returns dotted paths of every field that was extracted with a value but below the confidence
 * threshold, e.g. `header.totalAmount` or `lines[1].cartons`. Absent/null fields are not gated here —
 * required fields are enforced separately at commit — so optional missing data doesn't block review.
 */
export function lowConfidencePaths(draft: InvoiceDraft): string[] {
  const paths: string[] = [];
  const low = (f: DraftField<unknown> | undefined) =>
    !!f && f.value !== null && f.value !== undefined && f.confidence < CONFIDENCE_THRESHOLD;
  for (const key of HEADER_KEYS) {
    if (low(draft.header?.[key])) paths.push(`header.${key}`);
  }
  (draft.lines ?? []).forEach((line, index) => {
    for (const key of LINE_KEYS) {
      if (low(line[key] as DraftField<unknown>)) paths.push(`lines[${index}].${key}`);
    }
  });
  return paths;
}

/** Paths that are still below threshold and not yet in review.reviewedFields. */
export function unreviewedLowConfidencePaths(draft: InvoiceDraft): string[] {
  const reviewed = new Set(draft.review?.reviewedFields ?? []);
  return lowConfidencePaths(draft).filter((path) => !reviewed.has(path));
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).trim() || null);

/**
 * Maps a loose JSON object returned by an AI provider into a typed InvoiceDraft. The provider is
 * asked for `{header, lines}` with plain values plus optional per-field `confidence`; anything absent
 * stays low-confidence so the trader must review it.
 */
export function draftFromAiJson(raw: unknown, sourceLabel: string): InvoiceDraft {
  const draft = emptyDraft();
  if (typeof raw !== 'object' || raw === null) return draft;
  const obj = raw as Record<string, any>;
  const h = (obj.header ?? {}) as Record<string, any>;

  const readHeader = (key: keyof DraftHeader, aiKey: string, isNumber: boolean) => {
    const conf = num(h[`${aiKey}Confidence`]) ?? (h[aiKey] === undefined || h[aiKey] === null ? 0 : 0.6);
    const value = isNumber ? num(h[aiKey]) : str(h[aiKey]);
    (draft.header[key] as DraftField<unknown>) = field(value, value === null ? Math.min(conf, 0.4) : conf, sourceLabel);
  };
  readHeader('supplierName', 'supplier', false);
  readHeader('customerName', 'customer', false);
  readHeader('orderDate', 'orderDate', false);
  readHeader('currency', 'currency', false);
  readHeader('totalAmount', 'total', true);
  readHeader('deposit', 'deposit', true);
  readHeader('freight', 'freight', true);
  readHeader('amount', 'amount', true);
  readHeader('expenseDate', 'expenseDate', false);
  readHeader('categoryName', 'category', false);

  const lines = Array.isArray(obj.lines) ? obj.lines : [];
  draft.lines = lines.map((l: any) => {
    const conf = (k: string) => num(l[`${k}Confidence`]) ?? (l[k] === undefined || l[k] === null ? 0 : 0.6);
    const line: DraftLine = {
      description: field(str(l.description ?? l.product), conf('description'), sourceLabel),
      brand: field(str(l.brand), conf('brand'), sourceLabel),
      size: field(str(l.size), conf('size'), sourceLabel),
      cartons: field(num(l.cartons), conf('cartons'), sourceLabel),
      qtyPerCarton: field(num(l.qtyPerCarton ?? l.qty_per_carton), conf('qtyPerCarton'), sourceLabel),
      unitPrice: field(num(l.unitPrice ?? l.unit_price), conf('unitPrice'), sourceLabel),
      amount: field(num(l.amount), conf('amount'), sourceLabel),
      cbm: field(num(l.cbm), conf('cbm'), sourceLabel),
      productId: null,
    };
    return line;
  });
  return draft;
}
