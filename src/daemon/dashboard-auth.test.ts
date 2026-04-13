import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { closeDb, getDb, initDatabase } from '../vault/schema.ts';
import { WebSocketServer } from '../comms/websocket.ts';
import { createApiRoutes, type ApiContext } from './api-routes.ts';
import { DASHBOARD_SESSION_COOKIE } from '../comms/dashboard-auth.ts';

const PASSWORD = 'shielded-panel';

type TestServer = {
  port: number;
  server: WebSocketServer;
};

function createContext(passwordHash: string): ApiContext {
  return {
    healthMonitor: {
      getHealth: () => ({ status: 'ok' }),
    } as any,
    agentService: {} as any,
    config: {
      daemon: {
        port: 3142,
        data_dir: '~/.jarvis',
        db_path: '~/.jarvis/jarvis.db',
      },
      llm: {
        primary: 'anthropic',
        fallback: ['openai', 'ollama'],
        anthropic: { api_key: '', model: 'claude-sonnet-4-6' },
        openai: { api_key: '', model: 'gpt-5.4' },
        gemini: { api_key: '', model: 'gemini-3-flash-preview' },
        ollama: { base_url: 'http://localhost:11434', model: 'llama3' },
      },
      personality: {
        assistant_name: 'Jarvis',
        core_traits: ['loyal'],
      },
      authority: {
        default_level: 3,
        governed_categories: ['send_email'],
      },
      active_role: 'personal-assistant',
      dashboard: {
        password_hash: passwordHash,
      },
    } as any,
  };
}

async function startTestServer(port: number, passwordHash: string): Promise<TestServer> {
  const server = new WebSocketServer(port);
  server.setDashboardPasswordHash(passwordHash);
  server.setApiRoutes({
    ...(createApiRoutes(createContext(passwordHash)) as Record<string, any>),
    '/api/protected': {
      GET: () => Response.json({ ok: true }),
    },
  });
  server.start();
  return { port, server };
}

function extractCookie(setCookie: string | null): string {
  expect(setCookie).toBeTruthy();
  return setCookie!.split(';')[0]!;
}

describe('dashboard password auth', () => {
  let currentPort = 3160;
  let passwordHash: string;
  const activeServers: WebSocketServer[] = [];

  beforeEach(async () => {
    initDatabase(':memory:');
    passwordHash = await Bun.password.hash(PASSWORD);
  });

  afterEach(() => {
    for (const server of activeServers.splice(0)) {
      if (server.isRunning()) server.stop();
    }
    closeDb();
  });

  test('login succeeds with correct password and grants access to protected API', async () => {
    const { port, server } = await startTestServer(currentPort++, passwordHash);
    activeServers.push(server);

    const login = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(login.status).toBe(200);

    const cookie = extractCookie(login.headers.get('set-cookie'));
    const session = await login.json() as any;
    expect(session.authenticated).toBe(true);
    expect(typeof session.expires_at).toBe('number');

    const protectedRes = await fetch(`http://localhost:${port}/api/protected`, {
      headers: { Cookie: cookie },
    });
    expect(protectedRes.status).toBe(200);
    expect(await protectedRes.json()).toEqual({ ok: true });
  });

  test('login fails with incorrect password', async () => {
    const { port, server } = await startTestServer(currentPort++, passwordHash);
    activeServers.push(server);

    const login = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    expect(login.status).toBe(401);
    const body = await login.json() as any;
    expect(body.error).toBe('Invalid password');
  });

  test('protected endpoint rejects unauthenticated requests', async () => {
    const { port, server } = await startTestServer(currentPort++, passwordHash);
    activeServers.push(server);

    const res = await fetch(`http://localhost:${port}/api/protected`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  test('expired sessions are rejected', async () => {
    const { port, server } = await startTestServer(currentPort++, passwordHash);
    activeServers.push(server);

    getDb().prepare(`
      INSERT INTO dashboard_sessions (id, created_at, expires_at)
      VALUES (?, ?, ?)
    `).run('expired-session', Date.now() - 10_000, Date.now() - 1_000);

    const res = await fetch(`http://localhost:${port}/api/protected`, {
      headers: { Cookie: `${DASHBOARD_SESSION_COOKIE}=expired-session` },
    });
    expect(res.status).toBe(401);
  });

  test('logout invalidates the session and clears the cookie', async () => {
    const { port, server } = await startTestServer(currentPort++, passwordHash);
    activeServers.push(server);

    const login = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const cookie = extractCookie(login.headers.get('set-cookie'));

    const logout = await fetch(`http://localhost:${port}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain(`${DASHBOARD_SESSION_COOKIE}=`);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');

    const protectedRes = await fetch(`http://localhost:${port}/api/protected`, {
      headers: { Cookie: cookie },
    });
    expect(protectedRes.status).toBe(401);
  });
});
