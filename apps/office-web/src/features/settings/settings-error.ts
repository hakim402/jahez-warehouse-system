import type { TFunction } from 'i18next';
import { ApiError } from '../../api/client';
export function settingsFailure(error: unknown, t: TFunction) {
  const code = error instanceof ApiError ? error.details.code : undefined;
  const keys: Record<string, string> = { STALE_VERSION: 'staleSettings', PHONE_CONFLICT: 'phoneConflict', INVALID_WAREHOUSE: 'warehouseConflict', LAST_OWNER: 'lastOwnerNote', SELF_DISABLE: 'selfDisableNote' };
  return { message: t(typeof code === 'string' && keys[code] ? keys[code] : error instanceof ApiError && error.status === 403 ? 'restricted' : 'saveFailed'), stale: code === 'STALE_VERSION' };
}
