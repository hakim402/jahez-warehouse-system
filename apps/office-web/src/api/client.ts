const apiBase = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1').replace(/\/+$/, '');

export type ApiShortage = { line: number; available: number; requested: number; shortage: number };
export type ApiErrorDetails = Record<string, unknown>;

function isRecord(value: unknown): value is ApiErrorDetails {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationMessages(details: ApiErrorDetails): string[] {
  const message = details.message;
  const values = Array.isArray(message) ? message : [message];
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function shortages(details: ApiErrorDetails): ApiShortage[] {
  if (!Array.isArray(details.shortages)) return [];
  return details.shortages.flatMap((value) => {
    if (!isRecord(value)) return [];
    const { line, available, requested, shortage } = value;
    if (typeof line !== 'number' || !Number.isFinite(line) ||
      typeof available !== 'number' || !Number.isFinite(available) ||
      typeof requested !== 'number' || !Number.isFinite(requested) ||
      typeof shortage !== 'number' || !Number.isFinite(shortage)) return [];
    return [{ line, available, requested, shortage }];
  });
}

function reviewFields(details: ApiErrorDetails): string[] {
  return Array.isArray(details.fields)
    ? details.fields.filter((value): value is string => typeof value === 'string')
    : [];
}

export class ApiError extends Error {
  readonly validationMessages: string[];
  readonly shortages: ApiShortage[];
  readonly fields: string[];
  readonly available: number | null;
  readonly requested: number | null;
  readonly shortage: number | null;

  constructor(readonly status: number, readonly details: ApiErrorDetails = {}) {
    const messages = validationMessages(details);
    super(messages[0] ?? 'The API returned HTTP ' + status);
    this.name = 'ApiError';
    this.validationMessages = messages;
    this.shortages = shortages(details);
    this.fields = reviewFields(details);
    this.available = finiteNumber(details.available);
    this.requested = finiteNumber(details.requested);
    this.shortage = finiteNumber(details.shortage);
  }

  get validationMessage(): string | undefined {
    return this.validationMessages[0];
  }
}

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  json?: unknown;
  form?: FormData;
  token?: string;
};

async function requestResponse(
  path: string,
  { json, form, token, signal, ...options }: RequestOptions = {},
): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(apiBase + path, {
    ...options,
    method: options.method ?? (form !== undefined || json !== undefined ? 'POST' : undefined),
    headers,
    body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, isRecord(body) ? body : {});
  }
  return response;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestResponse(path, options);
  return response.json() as Promise<T>;
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await requestResponse(path, options);
  return response.blob();
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
