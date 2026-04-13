import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { closeDb, initDatabase } from '../vault/schema.ts';
import { resolveSidecarEndpoints, SidecarManager } from './manager.ts';

function createFakeServerWebSocket() {
  return {
    send() {},
    ping() {},
    close() {},
    data: {},
  } as any;
}

describe('resolveSidecarEndpoints', () => {
  test('preserves configured websocket URL and derives JWKS URL', () => {
    const endpoints = resolveSidecarEndpoints('wss://axiom-er.ddns.net/sidecar');
    expect(endpoints.brainWs).toBe('wss://axiom-er.ddns.net/sidecar');
    expect(endpoints.jwksUrl).toBe('https://axiom-er.ddns.net/api/sidecars/.well-known/jwks.json');
  });

  test('derives localhost fallback from host:port', () => {
    const endpoints = resolveSidecarEndpoints('localhost:3142');
    expect(endpoints.brainWs).toBe('ws://localhost:3142/sidecar/connect');
    expect(endpoints.jwksUrl).toBe('http://localhost:3142/api/sidecars/.well-known/jwks.json');
  });

  test('defaults a bare websocket host to /sidecar/connect', () => {
    const endpoints = resolveSidecarEndpoints('wss://axiom-er.ddns.net');
    expect(endpoints.brainWs).toBe('wss://axiom-er.ddns.net/sidecar/connect');
    expect(endpoints.jwksUrl).toBe('https://axiom-er.ddns.net/api/sidecars/.well-known/jwks.json');
  });
});

describe('SidecarManager enrollment', () => {
  let dataDir: string;

  beforeEach(() => {
    initDatabase(':memory:');
    dataDir = path.join(os.tmpdir(), `jarvis-sidecar-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    closeDb();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('embeds configured brain_url into enrollment tokens', async () => {
    const manager = new SidecarManager(dataDir);
    manager.setBrainUrl('wss://axiom-er.ddns.net/sidecar');
    await manager.start();

    const result = await manager.enrollSidecar('remote-laptop');

    expect(result.brain_url).toBe('wss://axiom-er.ddns.net/sidecar');

    const payload = JSON.parse(Buffer.from(result.token.split('.')[1]!, 'base64url').toString('utf8')) as {
      brain: string;
      jwks: string;
    };

    expect(payload.brain).toBe('wss://axiom-er.ddns.net/sidecar');
    expect(payload.jwks).toBe('https://axiom-er.ddns.net/api/sidecars/.well-known/jwks.json');

    await manager.stop();
  });

  test('keeps sidecar websocket open when touchSidecar persistence fails', async () => {
    const manager = new SidecarManager(dataDir);
    manager.setBrainUrl('wss://axiom-er.ddns.net/sidecar/connect');
    await manager.start();

    const result = await manager.enrollSidecar('resilient-touch');
    const claims = JSON.parse(Buffer.from(result.token.split('.')[1]!, 'base64url').toString('utf8')) as {
      sid: string;
    };

    closeDb();

    expect(() => manager.handleSidecarConnect(createFakeServerWebSocket(), claims.sid)).not.toThrow();
    expect((manager as any).sidecarConnections.has(claims.sid)).toBe(true);

    await manager.stop();
  });

  test('keeps registered sidecar connected when metadata persistence fails', async () => {
    const manager = new SidecarManager(dataDir);
    manager.setBrainUrl('wss://axiom-er.ddns.net/sidecar/connect');
    await manager.start();

    const result = await manager.enrollSidecar('resilient-register');
    const claims = JSON.parse(Buffer.from(result.token.split('.')[1]!, 'base64url').toString('utf8')) as {
      sid: string;
    };

    closeDb();

    expect(() => manager.registerConnection({
      id: claims.sid,
      name: 'resilient-register',
      hostname: 'probe-host',
      os: 'windows',
      platform: 'amd64',
      capabilities: ['terminal'],
      unavailableCapabilities: [],
      connectedAt: new Date(),
    })).not.toThrow();
    expect(manager.isConnected(claims.sid)).toBe(true);

    await manager.stop();
  });
});
