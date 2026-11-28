import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { authenticatedJson, useSession } from '../../app/session';

export type OfficeSession = { id: string; deviceId: string | null; createdAt: string; lastUsedAt: string; expiresAt: string };
export function useOfficeSessions() {
  const { session } = useSession();
  return useQuery({
    queryKey: ['sessions', session?.user.tenantId, session?.user.id], refetchInterval: 30_000,
    queryFn: ({ signal }) => authenticatedJson<OfficeSession[]>('/auth/sessions', { signal }),
  });
}
export function revokeOfficeSession(id: string) {
  return authenticatedJson('/auth/sessions/' + encodeURIComponent(id), { method: 'DELETE' });
}

export type ManagedRole = 'owner' | 'trader' | 'worker';
export type ManagedUser = { id: string; name: string; phone: string; role: ManagedRole; active: boolean; warehouseIds: string[]; version: number };
export type AssignmentWarehouse = { id: string; name: string; code: string };
export type ReceivingTolerances = { cbmTolerancePercent: string; weightTolerancePercent: string; version: number };
export type UserMutation = { user: ManagedUser; sessionsRevoked: boolean };
export function useSettingsKeys() {
  const { session } = useSession();
  const identity = [session?.user.tenantId, session?.user.id];
  return { users: ['settings-users', ...identity], warehouses: ['settings-warehouses', ...identity], tolerances: ['settings-tolerances', ...identity], enabled: session?.user.role === 'owner' };
}
export function useAssignmentWarehouses() {
  const keys = useSettingsKeys();
  return useQuery({ queryKey: keys.warehouses, enabled: keys.enabled, queryFn: ({ signal }) => authenticatedJson<{ warehouses: AssignmentWarehouse[] }>('/settings/warehouses', { signal }) });
}
export function useReceivingTolerances() {
  const keys = useSettingsKeys();
  return useQuery({ queryKey: keys.tolerances, enabled: keys.enabled, queryFn: ({ signal }) => authenticatedJson<ReceivingTolerances>('/settings/receiving-tolerances', { signal }) });
}
export function saveTolerances(value: ReceivingTolerances) {
  return authenticatedJson<ReceivingTolerances>('/settings/receiving-tolerances', { method: 'PATCH', json: { cbmTolerancePercent: value.cbmTolerancePercent, weightTolerancePercent: value.weightTolerancePercent, expectedVersion: value.version } });
}
export function getManagedUser(id: string) { return authenticatedJson<ManagedUser>('/users/' + encodeURIComponent(id)); }
export function saveManagedUser(value: Record<string, unknown>, id?: string) {
  return authenticatedJson<UserMutation>(id ? '/users/' + encodeURIComponent(id) : '/users', { method: id ? 'PATCH' : 'POST', json: value });
}
export function resetManagedPassword(id: string, newPassword: string, expectedVersion: number) {
  return authenticatedJson<UserMutation>('/users/' + encodeURIComponent(id) + '/password-reset', { json: { newPassword, expectedVersion } });
}

export function useManagedUsers(filters: { search: string; role: string; active: string }) {
  const keys = useSettingsKeys();
  return useInfiniteQuery({
    queryKey: [...keys.users, filters], enabled: keys.enabled, initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ ...filters, limit: '50', ...(pageParam ? { cursor: pageParam } : {}) });
      return authenticatedJson<{ users: ManagedUser[]; nextCursor: string | null }>('/users?' + params, { signal });
    },
    getNextPageParam: (last, _pages, _lastParam, params) => last.nextCursor && !params.includes(last.nextCursor) ? last.nextCursor : undefined,
  });
}
