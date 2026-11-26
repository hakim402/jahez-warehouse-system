import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../../tenancy/types';

export interface ReportFilters {
  from?: string;
  to?: string;
  customerId?: string;
  supplierId?: string;
  orderId?: string;
}

/** Parses and validates the shared filter set into a normalized object of present values only. */
export function parseFilters(raw: unknown): ReportFilters {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Filters must be an object');
  const input = raw as Record<string, unknown>;
  const filters: ReportFilters = {};
  const from = optionalDate(input.from, 'from');
  const to = optionalDate(input.to, 'to');
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (from && to && from > to) throw new BadRequestException('from must not be after to');
  const customerId = optionalUuid(input.customerId, 'customerId');
  const supplierId = optionalUuid(input.supplierId, 'supplierId');
  const orderId = optionalUuid(input.orderId, 'orderId');
  if (customerId) filters.customerId = customerId;
  if (supplierId) filters.supplierId = supplierId;
  if (orderId) filters.orderId = orderId;
  return filters;
}

/**
 * A tiny SQL builder that keeps every report's WHERE clause consistent. Clauses accumulate against
 * a growing parameter list so builders never hard-code placeholder numbers.
 */
export class FilterQuery {
  readonly clauses: string[] = [];
  readonly params: unknown[] = [];

  constructor(warehouseColumn: string, warehouseId: string) {
    this.add(warehouseColumn, warehouseId);
  }

  add(column: string, value: unknown): this {
    this.params.push(value);
    this.clauses.push(`${column} = $${this.params.length}`);
    return this;
  }

  /** Adds an inclusive date range on `column` (a timestamptz or date) when present. */
  dateRange(column: string, filters: ReportFilters): this {
    if (filters.from) {
      this.params.push(filters.from);
      this.clauses.push(`${column} >= $${this.params.length}`);
    }
    if (filters.to) {
      this.params.push(filters.to);
      // `to` is inclusive of the whole day; compare against the following midnight.
      this.clauses.push(`${column} < ($${this.params.length}::date + interval '1 day')`);
    }
    return this;
  }

  uuid(column: string, value: string | undefined): this {
    if (value) this.add(column, value);
    return this;
  }

  where(): string {
    return this.clauses.length > 0 ? `WHERE ${this.clauses.join(' AND ')}` : '';
  }
}

function optionalDate(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${label} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} must be a valid calendar date`);
  }
  return value;
}

function optionalUuid(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isUuid(value)) throw new BadRequestException(`${label} must be a UUID`);
  return value.toLowerCase();
}
