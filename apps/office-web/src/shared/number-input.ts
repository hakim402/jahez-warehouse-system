export function normalizeNumericInput(value: string): string {
  return value.trim().replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15)).replace(/٫/g, '.');
}
