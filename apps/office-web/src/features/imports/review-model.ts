import { normalizeNumericInput } from '../../shared/number-input';
import { expenseAmount, validExpenseDate } from '../expenses/expense-validation';
import { validateDraft } from '../orders/pages/order-editor/order-draft';
import type { Field, InvoiceImport, InvoiceReview, LineKey, ReviewPatch } from './imports-api';

export const purchaseFields = ['supplierName', 'customerName', 'orderDate', 'currency', 'deposit', 'totalAmount', 'freight'] as const;
export const expenseFields = ['expenseDate', 'currency', 'amount', 'categoryName', 'customerName'] as const;
export const lineKeys = ['description', 'brand', 'size', 'cartons', 'qtyPerCarton', 'unitPrice', 'amount', 'cbm'] as const;
const scale: Partial<Record<string, number>> = {
  cartons: 0, qtyPerCarton: 0, unitPrice: 4, amount: 2, cbm: 6, deposit: 2, totalAmount: 2, freight: 2,
};

export const valueText = (field?: Field) => String(field?.value ?? '');
export const linePath = (index: number, key: string) => `lines[${index}].${key}`;
export const numericField = (key: string) => scale[key] !== undefined;

export type ReviewForm = {
  edits: Record<string, string>;
  products: Record<number, string>;
  matches: InvoiceReview;
  reviewed: string[];
};

export function prepareReview(item: InvoiceImport, form: ReviewForm) {
  const header = item.draft.header ?? {};
  const originalLines = item.draft.lines ?? [];
  const lineCount = Math.max(originalLines.length, item.kind === 'purchase' ? 1 : 0);
  const errors: Record<string, string> = {};
  const consumed = new Set<string>();
  const headerPatch: NonNullable<ReviewPatch['header']> = {};
  const linePatches: NonNullable<ReviewPatch['lines']> = Array.from({ length: lineCount }, () => ({}));

  function read(path: string, key: string, original: Field | undefined, target: Record<string, string | number | null>) {
    const edited = form.edits[path];
    const raw = edited ?? valueText(original);
    const places = scale[key];
    let value = places === undefined ? raw.trim() : normalizeNumericInput(raw);
    if (key === 'currency') value = value.toUpperCase();
    if (value) {
      if (places !== undefined && (!/^\d+(\.\d+)?$/.test(value) || (value.split('.')[1]?.length ?? 0) > places || value.length > 22)) {
        errors[path] = 'importNumberInvalid';
      } else if ((key === 'orderDate' || key === 'expenseDate') && !validExpenseDate(value)) {
        errors[path] = 'invalidDate';
      } else if (key === 'currency' && !/^[A-Z]{3}$/.test(value)) {
        errors[path] = 'invalidCurrency';
      }
    }
    if (edited !== undefined && value !== valueText(original) && !errors[path]) {
      target[key] = places === 0 && value ? Number(value) : value || null;
      consumed.add(path);
    }
    return value;
  }

  const values: Record<string, string> = {};
  const headerKeys = item.kind === 'purchase' ? purchaseFields : expenseFields;
  for (const key of headerKeys) values[key] = read('header.' + key, key, header[key], headerPatch);
  const matches = { ...item.draft.review, ...form.matches };
  const patch: ReviewPatch = { header: headerPatch, review: { ...form.matches, reviewedFields: form.reviewed } };
  const pendingFields = () => item.unreviewedFields.filter(path => !form.reviewed.includes(path) && !consumed.has(path));
  let total: number | null = null;
  let ready: boolean;
  if (item.kind === 'purchase') {
    const lines = linePatches.map((linePatch, index) => {
      const original = originalLines[index];
      const edited = Object.fromEntries(lineKeys.map(key => [key,
        read(linePath(index, key), key, original?.[key], linePatch)]));
      const productId = form.products[index] ?? original?.productId ?? '';
      if (form.products[index] !== undefined) linePatch.productId = productId || null;
      return {
        key: String(index), productId, cartons: edited.cartons, qtyPerCarton: edited.qtyPerCarton,
        unitPrice: edited.unitPrice, originalAmount: edited.amount || null, brand: edited.brand || null,
        size: edited.size || null, cbm: edited.cbm ? Number(edited.cbm) : null, weight: null,
      };
    });
    const validation = validateDraft({
      supplierId: matches.supplierId ?? '', customerId: matches.customerId ?? '', currency: values.currency,
      orderDate: values.orderDate, deposit: values.deposit, expectedDate: '', orderNo: '', lines,
    });
    validation.lines.forEach((line, index) => {
      for (const [key, message] of Object.entries(line.errors)) errors[linePath(index, key)] ??= message;
    });
    total = validation.total;
    ready = Boolean(validation.input);
    if (linePatches.some(line => Object.keys(line).length)) patch.lines = linePatches;
    const commitLines = validation.input?.lines.map((line, index) => ({
      ...linePatches[index], amount: line.amount,
    }));
    const commitPatch = {
      ...patch, lines: commitLines,
      header: { ...headerPatch, totalAmount: total === null ? null : total.toFixed(2) },
    };
    const unreviewed = pendingFields();
    return { patch, commitPatch, errors, unreviewed, total, ready: ready && !unreviewed.length && !Object.keys(errors).length };
  }
  ready = Boolean(matches.categoryId && expenseAmount(values.amount) && validExpenseDate(values.expenseDate) && /^[A-Z]{3}$/.test(values.currency));
  const unreviewed = pendingFields();
  return { patch, commitPatch: patch, errors, unreviewed, total, ready: ready && !unreviewed.length && !Object.keys(errors).length };
}
