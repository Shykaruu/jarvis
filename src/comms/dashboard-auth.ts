import { timingSafeEqual } from 'node:crypto';
import type { JarvisConfig } from '../config/types.ts';
import {
  createDashboardSession,
  deleteDashboardSession,
  validateDashboardSession,
  type DashboardSession,
} from '../vault/dashboard-sessions.ts';

export const DASHBOARD_SESSION_COOKIE = 'jarvis_dashboard_session';
export const DASHBOARD_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const DASHBOARD_SESSION_MAX_AGE_SECONDS = Math.floor(DASHBOARD_SESSION_MAX_AGE_MS / 1000);

export function getCookie(req: Request, name: string): string | null {
  const cookies = req.headers.get('Cookie');
  if (!cookies) return null;
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function isDashboardPasswordEnabled(config: Pick<JarvisConfig, 'dashboard'> | { dashboard?: { password_hash?: string } } | null | undefined): boolean {
  return Boolean(config?.dashboard?.password_hash?.trim());
}

export function shouldUseSecureCookies(req: Request): boolean {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0]!.trim().toLowerCase() === 'https';
  }
  return new URL(req.url).protocol === 'https:';
}

export function buildCookieAttributes(req: Request, expiresAt?: number): string {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (shouldUseSecureCookies(req)) parts.push('Secure');
  if (expiresAt) {
    parts.push(`Max-Age=${DASHBOARD_SESSION_MAX_AGE_SECONDS}`);
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  }
  return parts.join('; ');
}

export function buildDashboardSessionCookie(req: Request, sessionId: string, expiresAt: number): string {
  return `${DASHBOARD_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ${buildCookieAttributes(req, expiresAt)}`;
}

export function buildClearedDashboardSessionCookie(req: Request): string {
  const epoch = new Date(0).toUTCString();
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', `Expires=${epoch}`];
  if (shouldUseSecureCookies(req)) parts.push('Secure');
  return `${DASHBOARD_SESSION_COOKIE}=; ${parts.join('; ')}`;
}

export function createAuthenticatedDashboardSession(): DashboardSession {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + DASHBOARD_SESSION_MAX_AGE_MS;
  return createDashboardSession(sessionId, expiresAt);
}

export function getDashboardSessionFromRequest(req: Request): DashboardSession | null {
  const sessionId = getCookie(req, DASHBOARD_SESSION_COOKIE);
  if (!sessionId) return null;
  return validateDashboardSession(sessionId);
}

export function revokeDashboardSessionFromRequest(req: Request): void {
  const sessionId = getCookie(req, DASHBOARD_SESSION_COOKIE);
  if (!sessionId) return;
  deleteDashboardSession(sessionId);
}
