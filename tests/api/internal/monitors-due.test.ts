import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockDb: { current: Database.Database | null } = { current: null };
vi.mock('@/lib/db', () => ({ getDb: () => mockDb.current! }));

import { GET } from '@/app/api/internal/monitors-due/route';
import { getOrCreateProberToken } from '@/lib/auth/prober-token';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE monitors (
      id TEXT PRIMARY KEY, name TEXT, url TEXT, type TEXT, interval_seconds INTEGER,
      timeout_ms INTEGER, status TEXT, enabled INTEGER, group_id TEXT, tags TEXT,
      expected_status_code INTEGER, port INTEGER, check_certificate INTEGER,
      certificate_expiry_warning INTEGER, created_by TEXT, created_at INTEGER,
      updated_at INTEGER, last_check_at INTEGER
    );
  `);
  return db;
}

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe('GET /api/internal/monitors-due', () => {
  let token: string;
  beforeEach(() => {
    mockDb.current = makeDb();
    token = getOrCreateProberToken(mockDb.current);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await GET(req('http://x/api/internal/monitors-due') as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 with a non-matching Bearer token', async () => {
    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: 'Bearer wrongtoken123456789012345678901234567890123456789012345678',
    }) as any);
    expect(res.status).toBe(401);
  });

  it('returns empty monitors array when table is empty', async () => {
    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ monitors: [] });
  });

  it('returns a monitor with last_check_at IS NULL', async () => {
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, expected_status_code, last_check_at)
       VALUES ('m1', 'API', 'https://api.example.com', 'http', 60, 10000, 'unknown', 1, 200, NULL)`
    ).run();

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monitors).toHaveLength(1);
    expect(body.monitors[0]).toEqual({
      id: 'm1',
      type: 'http',
      url: 'https://api.example.com',
      timeout_ms: 10000,
      config: { expected_status_code: 200 },
    });
  });

  it('skips monitors with enabled = 0', async () => {
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, last_check_at)
       VALUES ('m1', 'Disabled', 'https://example.com', 'http', 60, 5000, 'unknown', 0, NULL)`
    ).run();

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monitors).toHaveLength(0);
  });

  it('skips monitors checked recently', async () => {
    const nowMinus10 = Math.floor(Date.now() / 1000) - 10;
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, last_check_at)
       VALUES ('m1', 'Recent', 'https://example.com', 'http', 60, 5000, 'operational', 1, ?)`
    ).run(nowMinus10);

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monitors).toHaveLength(0);
  });

  it('returns monitors past their interval', async () => {
    const nowMinus120 = Math.floor(Date.now() / 1000) - 120;
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, last_check_at)
       VALUES ('m1', 'Overdue', 'https://example.com', 'http', 60, 5000, 'operational', 1, ?)`
    ).run(nowMinus120);

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monitors).toHaveLength(1);
    expect(body.monitors[0].id).toBe('m1');
  });

  it('shapes config for HTTP with expected_status_code', async () => {
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, expected_status_code, last_check_at)
       VALUES ('m1', 'HTTP Monitor', 'https://example.com', 'http', 60, 5000, 'unknown', 1, 201, NULL)`
    ).run();

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    const body = await res.json();
    expect(body.monitors[0].config).toEqual({ expected_status_code: 201 });
  });

  it('shapes config for TCP with port', async () => {
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, port, last_check_at)
       VALUES ('m1', 'TCP Monitor', 'db.example.com', 'tcp', 60, 5000, 'unknown', 1, 5432, NULL)`
    ).run();

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    const body = await res.json();
    expect(body.monitors[0].config).toEqual({ port: 5432 });
  });

  it('shapes config for SSL with certificate_expiry_warning', async () => {
    mockDb.current!.prepare(
      `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, certificate_expiry_warning, last_check_at)
       VALUES ('m1', 'SSL Monitor', 'https://example.com', 'ssl', 60, 5000, 'unknown', 1, 14, NULL)`
    ).run();

    const res = await GET(req('http://x/api/internal/monitors-due', {
      Authorization: `Bearer ${token}`,
    }) as any);
    const body = await res.json();
    expect(body.monitors[0].config).toEqual({ expiry_warning_days: 14 });
  });

  it('respects ?limit=2 query param', async () => {
    for (let i = 1; i <= 5; i++) {
      mockDb.current!.prepare(
        `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, last_check_at)
         VALUES (?, ?, ?, 'http', 60, 5000, 'unknown', 1, NULL)`
      ).run(`m${i}`, `Monitor ${i}`, `https://example${i}.com`);
    }

    const res = await GET(req('http://x/api/internal/monitors-due?limit=2', {
      Authorization: `Bearer ${token}`,
    }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monitors).toHaveLength(2);
  });
});
