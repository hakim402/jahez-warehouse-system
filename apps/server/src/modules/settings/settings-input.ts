import { BadRequestException } from '@nestjs/common';
import { isUserRole, isUuid } from '../tenancy/types';
export type SettingsInput = Record<string, unknown>;
export function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/u.test(value)) throw new BadRequestException(`Invalid ${field}`);
  return value.trim();
}
export function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new BadRequestException('Password must contain 12–128 characters');
  return value;
}
export function role(value: unknown) {
  if (!isUserRole(value)) throw new BadRequestException('Invalid role');
  return value;
}
export function uuid(value: unknown): string {
  if (!isUuid(value)) throw new BadRequestException('Malformed id');
  return value;
}
export function version(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new BadRequestException('Expected version is required');
  return value;
}
export function warehouses(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 1000) throw new BadRequestException('Invalid warehouse assignments');
  return [...new Set(value.map(uuid))].sort();
}
export function percent(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,3}(\.\d{1,2})?$/.test(String(value)) || Number(value) > 100) throw new BadRequestException('Tolerance must be 0–100 with at most two decimals');
  return Number(value).toFixed(2);
}
