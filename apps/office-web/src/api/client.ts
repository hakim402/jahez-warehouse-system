const apiBase = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(readonly status: number) {
    super('The API returned HTTP ' + status);
  }
}

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  json?: unknown;
  token?: string;
};

export async function requestJson<T>(
  path: string,
  { json, token, signal, ...options }: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', 'Bearer ' + token);

  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(apiBase + path, {
    ...options,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
