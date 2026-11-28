import { useSyncExternalStore } from 'react';
import { isOfficeRole, logIn, logOut, refreshAuth, type AuthSession } from '../api/auth';
import { ApiError, requestBlob, requestJson, type RequestOptions } from '../api/client';
import { queryClient } from './query-client';

const storageKey = 'jahez.office.session';
const idleLimit = 30 * 60 * 1_000;
type OfficeSession = AuthSession & { expiresAt: number };
let lastActivity = Date.now();

function readSession(): OfficeSession | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as {
      session?: OfficeSession;
      lastActivity?: number;
    } | null;
    const session = stored?.session;
    if (
      typeof session?.accessToken === 'string' && typeof session.refreshToken === 'string' &&
      typeof session.sessionId === 'string' && isOfficeRole(session.user?.role) &&
      typeof session.user.name === 'string' && typeof session.user.tenantId === 'string' &&
      typeof session.user.id === 'string' && Number.isFinite(session.expiresAt) &&
      typeof stored?.lastActivity === 'number' &&
      Date.now() - stored.lastActivity < idleLimit
    ) {
      lastActivity = stored.lastActivity;
      return session;
    }
    sessionStorage.removeItem(storageKey);
  } catch {
    // An unavailable or invalid browser store cannot restore a session.
  }
  return null;
}

const initialSession = readSession();
let snapshot = { session: initialSession, restoring: Boolean(initialSession) };
let pendingRefresh: { sessionId: string; request: Promise<AuthSession> } | undefined;
const listeners = new Set<() => void>();

function saveActivity() {
  try {
    if (snapshot.session) {
      sessionStorage.setItem(storageKey, JSON.stringify({
        session: snapshot.session,
        lastActivity,
      }));
    } else {
      sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Sign-in still works within the page when browser storage is disabled.
  }
}

function publish(session: OfficeSession | null) {
  if (snapshot.session?.sessionId !== session?.sessionId) queryClient.clear();
  snapshot = { session, restoring: false };
  saveActivity();
  listeners.forEach((listener) => listener());
}

function withExpiry(session: AuthSession): OfficeSession {
  return { ...session, expiresAt: Date.now() + session.expiresIn * 1_000 };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export class OfficeAccessError extends Error {}

export async function signIn(phone: string, password: string) {
  const session = await logIn(phone, password);
  if (!isOfficeRole(session.user.role)) {
    void logOut(session.accessToken).catch(() => undefined);
    throw new OfficeAccessError();
  }
  lastActivity = Date.now();
  publish(withExpiry(session));
}

async function refresh(session: OfficeSession) {
  if (snapshot.session !== session) {
    return snapshot.session?.sessionId === session.sessionId ? snapshot.session : null;
  }

  // A refresh token can only be used once even when several requests get a 401.
  const activeRefresh = pendingRefresh?.sessionId === session.sessionId
    ? pendingRefresh
    : { sessionId: session.sessionId, request: refreshAuth(session.refreshToken) };
  pendingRefresh = activeRefresh;
  try {
    const renewed = await activeRefresh.request;
    if (snapshot.session === session) {
      const officeRole = isOfficeRole(renewed.user.role);
      publish(officeRole ? withExpiry(renewed) : null);
      if (!officeRole) void logOut(renewed.accessToken).catch(() => undefined);
    }
  } catch (error) {
    if (snapshot.session === session) {
      const rejected = error instanceof ApiError && [400, 401, 403].includes(error.status);
      // A transient refresh failure does not invalidate an access token that is still valid.
      publish(!rejected && Date.now() < session.expiresAt ? session : null);
    }
  } finally {
    if (pendingRefresh === activeRefresh) pendingRefresh = undefined;
  }
  return snapshot.session?.sessionId === session.sessionId ? snapshot.session : null;
}

export function refreshCurrentSession() {
  const session = snapshot.session;
  return session ? refresh(session) : Promise.resolve(null);
}

export function restoreSession() {
  if (!initialSession) return Promise.resolve(null);
  if (initialSession.expiresAt - Date.now() > 5_000) {
    publish(initialSession);
    return Promise.resolve(initialSession);
  }
  return refresh(initialSession);
}

export async function signOut() {
  const session = snapshot.session;
  const activeRefresh = pendingRefresh?.sessionId === session?.sessionId ? pendingRefresh : undefined;
  publish(null);
  if (!session) return;

  try {
    let token = session.accessToken;
    if (activeRefresh) token = (await activeRefresh.request).accessToken;
    else if (Date.now() >= session.expiresAt) token = (await refreshAuth(session.refreshToken)).accessToken;
    await logOut(token);
  } catch {
    // Local credentials are cleared even if session revocation cannot be reached.
  }
}

export function watchIdleSession() {
  let lastSaved = lastActivity;
  const checkIdle = () => {
    if (Date.now() - lastActivity >= idleLimit) void signOut();
  };
  const recordActivity = () => {
    checkIdle();
    if (!snapshot.session) return;
    lastActivity = Date.now();
    if (lastActivity - lastSaved >= 15_000) {
      saveActivity();
      lastSaved = lastActivity;
    }
  };

  window.addEventListener('pointerdown', recordActivity);
  window.addEventListener('keydown', recordActivity);
  window.addEventListener('scroll', recordActivity, true);
  document.addEventListener('visibilitychange', checkIdle);
  const timer = window.setInterval(checkIdle, 15_000);
  return () => {
    window.removeEventListener('pointerdown', recordActivity);
    window.removeEventListener('keydown', recordActivity);
    window.removeEventListener('scroll', recordActivity, true);
    document.removeEventListener('visibilitychange', checkIdle);
    window.clearInterval(timer);
  };
}

type AuthenticatedOptions = Omit<RequestOptions, 'token'>;

async function authenticatedRequest<T>(
  path: string,
  options: AuthenticatedOptions,
  send: (path: string, options: RequestOptions) => Promise<T>,
): Promise<T> {
  const current = snapshot.session;
  if (!current) throw new ApiError(401);

  const needsRefresh = current.expiresAt - Date.now() <= 5_000;
  const session = needsRefresh ? await refresh(current) : current;
  options.signal?.throwIfAborted();
  if (!session) throw new ApiError(401);

  try {
    return await send(path, { ...options, token: session.accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || options.signal?.aborted) throw error;
    if (needsRefresh) {
      if (snapshot.session === session) publish(null);
      throw error;
    }
    const renewed = await refresh(session);
    options.signal?.throwIfAborted();
    if (!renewed) throw error;
    try {
      return await send(path, { ...options, token: renewed.accessToken });
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401 && snapshot.session === renewed) {
        publish(null);
      }
      throw retryError;
    }
  }
}

export function authenticatedJson<T>(path: string, options: AuthenticatedOptions = {}): Promise<T> {
  return authenticatedRequest(path, options, requestJson<T>);
}

export function authenticatedForm<T>(path: string, form: FormData, options: AuthenticatedOptions = {}): Promise<T> {
  return authenticatedRequest(path, { ...options, form }, requestJson<T>);
}

export function authenticatedBlob(path: string, options: AuthenticatedOptions = {}): Promise<Blob> {
  return authenticatedRequest(path, options, requestBlob);
}
