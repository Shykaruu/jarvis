import { getDb } from './schema.ts';

export type DashboardSession = {
  id: string;
  created_at: number;
  expires_at: number;
};

export function createDashboardSession(id: string, expiresAt: number): DashboardSession {
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO dashboard_sessions (id, created_at, expires_at)
    VALUES (?, ?, ?)
  `).run(id, now, expiresAt);
  return { id, created_at: now, expires_at: expiresAt };
}

export function getDashboardSession(id: string): DashboardSession | null {
  const row = getDb().prepare(`
    SELECT id, created_at, expires_at
    FROM dashboard_sessions
    WHERE id = ?
  `).get(id) as DashboardSession | null;
  return row ?? null;
}

export function deleteDashboardSession(id: string): void {
  getDb().prepare('DELETE FROM dashboard_sessions WHERE id = ?').run(id);
}

export function deleteExpiredDashboardSessions(now = Date.now()): void {
  getDb().prepare('DELETE FROM dashboard_sessions WHERE expires_at <= ?').run(now);
}

export function validateDashboardSession(id: string, now = Date.now()): DashboardSession | null {
  deleteExpiredDashboardSessions(now);
  const session = getDashboardSession(id);
  if (!session) return null;
  if (session.expires_at <= now) {
    deleteDashboardSession(id);
    return null;
  }
  return session;
}
