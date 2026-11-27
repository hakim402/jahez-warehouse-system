import { requestJson } from './client';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  user: {
    id: string;
    tenantId: string;
    role: 'owner' | 'trader' | 'worker';
    name: string;
  };
};

export function isOfficeRole(role: AuthSession['user']['role'] | undefined) {
  return role === 'owner' || role === 'trader';
}

export function logIn(phone: string, password: string) {
  const tenantId = import.meta.env.VITE_TENANT_ID?.trim() || undefined;
  return requestJson<AuthSession>('/auth/login', {
    method: 'POST',
    json: { phone, password, tenantId, deviceId: 'Jahez Office Web' },
  });
}

export function refreshAuth(refreshToken: string) {
  return requestJson<AuthSession>('/auth/refresh', {
    method: 'POST',
    json: { refreshToken },
  });
}

export function logOut(token: string) {
  return requestJson<{ status: string }>('/auth/logout', { method: 'POST', token });
}
