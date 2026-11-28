import { useQuery } from '@tanstack/react-query';
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
