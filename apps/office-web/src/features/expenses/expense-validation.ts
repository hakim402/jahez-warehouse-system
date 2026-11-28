import { normalizeNumericInput } from '../../shared/number-input';

export function expenseAmount(value: string): string | null {
  const normalized = normalizeNumericInput(value).trim();
  return /^\d+(\.\d{1,2})?$/.test(normalized) && Number(normalized) > 0 && Number(normalized) < 1_000_000_000_000 ? normalized : null;
}
export function validExpenseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
