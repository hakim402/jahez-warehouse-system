import type { DraftInput, FullOrder } from '../../order-api';

const maximumQuantity = 2_147_483_647;
const maximumCents = 99_999_999_999_999n;

export type DraftLine = {
  key: string;
  productId: string;
  cartons: string;
  qtyPerCarton: string;
  unitPrice: string;
  originalAmount: string | null;
  brand: string | null;
  size: string | null;
  cbm: number | null;
  weight: number | null;
};

export type DraftForm = {
  supplierId: string;
  customerId: string;
  currency: string;
  orderDate: string;
  expectedDate: string;
  orderNo: string;
  deposit: string;
  lines: DraftLine[];
};

export function emptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(), productId: '', cartons: '', qtyPerCarton: '', unitPrice: '',
    originalAmount: null, brand: null, size: null, cbm: null, weight: null,
  };
}

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function initialDraft(order?: FullOrder): DraftForm {
  if (!order) return {
    supplierId: '', customerId: '', currency: 'USD', orderDate: localToday(),
    expectedDate: '', orderNo: '', deposit: '', lines: [emptyLine()],
  };

  return {
    supplierId: order.supplierId,
    customerId: order.customerId,
    currency: order.currency ?? '',
    orderDate: order.orderDate ?? '',
    expectedDate: order.expectedDate ?? '',
    orderNo: order.orderNo,
    deposit: order.deposit?.toFixed(2) ?? '',
    lines: order.lines.map((line) => ({
      key: line.id,
      productId: line.productId,
      cartons: String(line.cartons),
      qtyPerCarton: String(line.qtyPerCarton),
      unitPrice: line.unitPrice?.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') ?? '',
      originalAmount: line.unitPrice === null ? line.amount?.toFixed(2) ?? null : null,
      brand: line.brand, size: line.size, cbm: line.cbm, weight: line.weight,
    })),
  };
}

function normalizedNumber(value: string) {
  return value.trim().replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15)).replace('٫', '.');
}

function wholeQuantity(value: string) {
  const normalized = normalizedNumber(value);
  const quantity = Number(normalized);
  return /^\d+$/.test(normalized) && quantity > 0 && quantity <= maximumQuantity ? quantity : null;
}

function moneyUnits(value: string, scale: 2 | 4): bigint | null | undefined {
  const normalized = normalizedNumber(value);
  if (!normalized) return null;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const [whole, fraction = ''] = normalized.split('.');
  const digits = whole.replace(/^0+(?=\d)/, '');
  if (digits.length > 14 - scale || fraction.length > scale) return undefined;
  return BigInt(digits + fraction.padEnd(scale, '0'));
}

function serializeMoney(value: bigint | null, scale: 2 | 4) {
  if (value === null) return null;
  const digits = value.toString().padStart(scale + 1, '0');
  return digits.slice(0, -scale) + '.' + digits.slice(-scale);
}

export type LineErrors = Partial<Record<'productId' | 'cartons' | 'qtyPerCarton' | 'unitPrice' | 'amount', string>>;

function validateLine(line: DraftLine) {
  const errors: LineErrors = {};
  if (!line.productId) errors.productId = 'invalidSelection';
  const cartons = wholeQuantity(line.cartons);
  if (cartons === null) errors.cartons = 'invalidQuantity';
  const qtyPerCarton = wholeQuantity(line.qtyPerCarton);
  if (qtyPerCarton === null) errors.qtyPerCarton = 'invalidQuantity';
  const qty = cartons !== null && qtyPerCarton !== null ? cartons * qtyPerCarton : null;
  if (qty !== null && qty > maximumQuantity) errors.qtyPerCarton = 'invalidQuantity';
  const unitPrice = moneyUnits(line.unitPrice, 4);
  if (unitPrice === undefined) errors.unitPrice = 'invalidPrice';
  // The API rounds half up when it converts ten-thousandths to cents.
  const amount = unitPrice == null
    ? unitPrice === null ? moneyUnits(line.originalAmount ?? '', 2) ?? null : null
    : qty !== null && qty <= maximumQuantity ? (BigInt(qty) * unitPrice + 50n) / 100n : null;
  if (amount !== null && amount > maximumCents) errors.amount = 'totalTooLarge';
  const input = Object.keys(errors).length ? null : {
    productId: line.productId,
    cartons: cartons!,
    qtyPerCarton: qtyPerCarton!,
    unitPrice: serializeMoney(unitPrice ?? null, 4),
    amount: serializeMoney(amount, 2),
    brand: line.brand, size: line.size, cbm: line.cbm, weight: line.weight,
  };
  return {
    errors, input, cartons, qty: qty !== null && qty <= maximumQuantity ? qty : null, amount,
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type DraftErrors = Partial<Record<'supplierId' | 'customerId' | 'currency' | 'orderDate' | 'expectedDate' | 'deposit' | 'lines' | 'total', string>>;

export function validateDraft(form: DraftForm) {
  const errors: DraftErrors = {};
  if (!form.supplierId) errors.supplierId = 'invalidSelection';
  if (!form.customerId) errors.customerId = 'invalidSelection';
  const currency = form.currency.trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.currency = 'invalidCurrency';
  if (form.orderDate && !validDate(form.orderDate)) errors.orderDate = 'invalidDate';
  if (form.expectedDate && !validDate(form.expectedDate)) errors.expectedDate = 'invalidDate';
  const deposit = moneyUnits(form.deposit, 2);
  if (deposit === undefined) errors.deposit = 'invalidMoney';
  const lines = form.lines.map(validateLine);
  const inputs = lines.flatMap((line) => line.input ? [line.input] : []);
  if (!lines.length || inputs.length !== lines.length) errors.lines = 'linesInvalid';
  const total = inputs.length > 0 && inputs.length === lines.length && lines.every((line) => line.amount !== null)
    ? lines.reduce((sum, line) => sum + (line.amount ?? 0n), 0n)
    : null;
  if (total !== null && total > maximumCents) errors.total = 'totalTooLarge';

  const input: DraftInput | null = Object.keys(errors).length ? null : {
    currency: currency || null,
    orderDate: form.orderDate || null,
    expectedDate: form.expectedDate || null,
    deposit: serializeMoney(deposit ?? null, 2),
    lines: inputs,
  };
  return {
    errors, lines, input,
    total: total === null ? null : Number(total) / 100,
    totalCartons: lines.reduce((sum, line) => sum + (line.cartons ?? 0), 0),
    totalQuantity: lines.reduce((sum, line) => sum + (line.qty ?? 0), 0),
  };
}
