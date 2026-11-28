export type StockCountValue = string | number | null;

type ExactStockCount = { units: bigint; scale: number };

function parseStockCount(value: StockCountValue): ExactStockCount | null {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) return null;
    value = value.toString();
  }
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value.trim());
  if (!match) return null;
  const whole = match[2] ?? '0';
  const fraction = (match[3] ?? match[4] ?? '').replace(/0+$/, '');
  const units = BigInt(whole + fraction) * (match[1] === '-' ? -1n : 1n);
  return { units, scale: fraction.length };
}

function decimalString({ units, scale }: ExactStockCount): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? '' : digits.slice(-scale).replace(/0+$/, '');
  return (negative ? '-' : '') + whole + (fraction ? '.' + fraction : '');
}

export function formatStockCount(value: StockCountValue, language: string): string {
  const exact = parseStockCount(value);
  if (!exact) return '—';
  const text = decimalString(exact);
  try {
    // Intl formats decimal strings exactly at runtime, although its types accept only number or bigint.
    return new Intl.NumberFormat(language, { maximumFractionDigits: exact.scale }).format(text as unknown as number);
  } catch {
    return text;
  }
}

export function sumStockCounts(values: readonly StockCountValue[]): string | null {
  let total = 0n;
  let scale = 0;
  for (const value of values) {
    const exact = parseStockCount(value);
    if (!exact) return null;
    if (exact.scale > scale) {
      total = total * 10n ** BigInt(exact.scale - scale) + exact.units;
      scale = exact.scale;
    } else {
      total += exact.units * 10n ** BigInt(scale - exact.scale);
    }
  }
  return decimalString({ units: total, scale });
}

export function subtractStockCounts(left: StockCountValue, right: StockCountValue): string | null {
  const a = parseStockCount(left);
  const b = parseStockCount(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const units = a.units * 10n ** BigInt(scale - a.scale) - b.units * 10n ** BigInt(scale - b.scale);
  return decimalString({ units, scale });
}

export function stockCountSign(value: StockCountValue): number | null {
  const exact = parseStockCount(value);
  if (!exact) return null;
  return exact.units === 0n ? 0 : exact.units > 0n ? 1 : -1;
}

export function compareStockCounts(left: StockCountValue, right: StockCountValue): number | null {
  const a = parseStockCount(left);
  const b = parseStockCount(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const aUnits = a.units * 10n ** BigInt(scale - a.scale);
  const bUnits = b.units * 10n ** BigInt(scale - b.scale);
  return aUnits === bUnits ? 0 : aUnits > bUnits ? 1 : -1;
}

export function shareStockCount(value: StockCountValue, taken: StockCountValue, total: StockCountValue, scale: number): string | null {
  const amount = parseStockCount(value);
  const portion = parseStockCount(taken);
  const whole = parseStockCount(total);
  if (!amount || !portion || !whole || amount.units <= 0n || portion.units <= 0n || whole.units <= 0n) return null;
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) return null;
  const commonScale = Math.max(amount.scale, portion.scale, whole.scale);
  const amountUnits = amount.units * 10n ** BigInt(commonScale - amount.scale);
  const portionUnits = portion.units * 10n ** BigInt(commonScale - portion.scale);
  const wholeUnits = whole.units * 10n ** BigInt(commonScale - whole.scale);
  const numerator = amountUnits * portionUnits * 10n ** BigInt(scale);
  const denominator = wholeUnits * 10n ** BigInt(commonScale);
  const units = (numerator + denominator / 2n) / denominator;
  return decimalString({ units, scale });
}
