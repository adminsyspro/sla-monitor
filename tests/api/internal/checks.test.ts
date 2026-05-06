import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockDb: { current: Database.Database | null } = { current: null };
vi.mock('@/lib/db', () => ({ getDb: () => mockDb.current! }));

import { POST } from '@/app/api/internal/checks/route';
import { getOrCreateProberToken } from '@/lib/auth/prober-token';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE monitors (
      id TEXT PRIMARY KEY, name TEXT, url TEXT, type TEXT, interval_seconds INTEGER,
      timeout_ms INTEGER, status TEXT, enabled INTEGER, last_check_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE monitor_checks (
      id TEXT PRIMARY KEY, monitor_id TEXT, timestamp INTEGER, status TEXT,
      response_time INTEGER, status_code INTEGER, error TEXT, region TEXT, metadata TEXT
    );
    CREATE TABLE incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'investigating',
      severity TEXT NOT NULL DEFAULT 'minor',
      affected_monitors TEXT DEFAULT '[]',
      started_at INTEGER NOT NULL,
      resolved_at INTEGER DEFAULT NULL,
      root_cause TEXT DEFAULT NULL,
      postmortem TEXT DEFAULT NULL,
      impact TEXT DEFAULT '',
      resolution TEXT DEFAULT '',
      preventive_actions TEXT DEFAULT '',
      owner TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE incident_updates (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/internal/checks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const validBody = {
  monitor_id: 'm1',
  timestamp: 1714831200,
  status: 'operational' as const,
  response_time_ms: 142,
  status_code: 200,
  error: null,
  region: 'local',
  metadata: {},
};

describe('POST /api/internal/checks', () => {
  let token: string;
  beforeEach(() => {
    mockDb.current = makeDb();
    token = getOrCreateProberToken(mockDb.current);
    mockDb.current.prepare(`
      INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, last_check_at)
      VALUES ('m1', 'X', 'https://x', 'http', 60, 10000, 'unknown', 1, NULL)
    `).run();
  });

  it('returns 401 without Authorization header', async () => {
    const res = await POST(postReq(validBody) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid payload', async () => {
    const res = await POST(postReq({ bogus: true }, { Authorization: `Bearer ${token}` }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when monitor_id does not exist', async () => {
    const res = await POST(postReq(
      { ...validBody, monitor_id: 'unknown' },
      { Authorization: `Bearer ${token}` }
    ) as any);
    expect(res.status).toBe(404);
  });

  it('returns 410 when monitor has enabled = 0', async () => {
    mockDb.current!.prepare(`UPDATE monitors SET enabled = 0 WHERE id = 'm1'`).run();
    const res = await POST(postReq(validBody, { Authorization: `Bearer ${token}` }) as any);
    expect(res.status).toBe(410);
  });

  it('returns 201 on success and persists the row in monitor_checks', async () => {
    const res = await POST(postReq(validBody, { Authorization: `Bearer ${token}` }) as any);
    expect(res.status).toBe(201);
    const row = mockDb.current!.prepare(
      `SELECT * FROM monitor_checks WHERE monitor_id = 'm1'`
    ).get() as any;
    expect(row).toBeTruthy();
    expect(row.response_time).toBe(142);
    expect(row.status_code).toBe(200);
    expect(row.metadata).toBe('{}');
  });

  it('updates monitors.last_check_at and monitors.status after success', async () => {
    await POST(postReq(validBody, { Authorization: `Bearer ${token}` }) as any);
    const monitor = mockDb.current!.prepare(
      `SELECT last_check_at, status FROM monitors WHERE id = 'm1'`
    ).get() as any;
    expect(monitor.last_check_at).toBe(1714831200);
    expect(monitor.status).toBe('operational');
  });

  it('persists metadata field as JSON and round-trips correctly', async () => {
    const body = { ...validBody, metadata: { ssl_expires_at: 1730000000 } };
    await POST(postReq(body, { Authorization: `Bearer ${token}` }) as any);
    const row = mockDb.current!.prepare(
      `SELECT metadata FROM monitor_checks WHERE monitor_id = 'm1'`
    ).get() as any;
    expect(JSON.parse(row.metadata)).toEqual({ ssl_expires_at: 1730000000 });
  });

  it('does not overwrite monitors.status when current is maintenance, but does update last_check_at', async () => {
    mockDb.current!.prepare(`UPDATE monitors SET status = 'maintenance' WHERE id = 'm1'`).run();
    const body = { ...validBody, status: 'major' as const };
    await POST(postReq(body, { Authorization: `Bearer ${token}` }) as any);
    const monitor = mockDb.current!.prepare(
      `SELECT last_check_at, status FROM monitors WHERE id = 'm1'`
    ).get() as any;
    expect(monitor.status).toBe('maintenance');
    expect(monitor.last_check_at).toBe(1714831200);
  });

  it('does not overwrite monitors.status when current is partial, but does update last_check_at', async () => {
    mockDb.current!.prepare(`UPDATE monitors SET status = 'partial' WHERE id = 'm1'`).run();
    const body = { ...validBody, status: 'major' as const };
    await POST(postReq(body, { Authorization: `Bearer ${token}` }) as any);
    const monitor = mockDb.current!.prepare(
      `SELECT last_check_at, status FROM monitors WHERE id = 'm1'`
    ).get() as any;
    expect(monitor.status).toBe('partial');
    expect(monitor.last_check_at).toBe(1714831200);
  });

  it('freely overwrites status when current is operational/degraded/major/unknown', async () => {
    mockDb.current!.prepare(`UPDATE monitors SET status = 'operational' WHERE id = 'm1'`).run();
    const body = { ...validBody, status: 'major' as const };
    await POST(postReq(body, { Authorization: `Bearer ${token}` }) as any);
    const monitor = mockDb.current!.prepare(
      `SELECT status FROM monitors WHERE id = 'm1'`
    ).get() as any;
    expect(monitor.status).toBe('major');
  });

  it('creates one active system incident for a failing monitor', async () => {
    const body = {
      ...validBody,
      status: 'major' as const,
      error: 'connection refused',
      response_time_ms: null,
      status_code: null,
    };
    const res = await POST(postReq(body, { Authorization: `Bearer ${token}` }) as any);
    expect(res.status).toBe(201);

    const incident = mockDb.current!.prepare(
      `SELECT * FROM incidents WHERE created_by = 'system'`
    ).get() as any;
    expect(incident).toBeTruthy();
    expect(incident.severity).toBe('major');
    expect(incident.affected_monitors).toBe(JSON.stringify(['m1']));

    const update = mockDb.current!.prepare(
      `SELECT * FROM incident_updates WHERE incident_id = ?`
    ).get(incident.id) as any;
    expect(update.message).toContain('connection refused');
  });

  it('does not create duplicate incidents for repeated failures on the same monitor', async () => {
    const body = { ...validBody, status: 'major' as const };
    await POST(postReq(body, { Authorization: `Bearer ${token}` }) as any);
    await POST(postReq({ ...body, timestamp: validBody.timestamp + 60 }, { Authorization: `Bearer ${token}` }) as any);

    const count = mockDb.current!.prepare(`SELECT COUNT(*) as count FROM incidents`).get() as any;
    const updates = mockDb.current!.prepare(`SELECT COUNT(*) as count FROM incident_updates`).get() as any;
    expect(count.count).toBe(1);
    expect(updates.count).toBe(1);
  });

  it('resolves the active system incident when the monitor recovers', async () => {
    const failingBody = { ...validBody, status: 'major' as const };
    await POST(postReq(failingBody, { Authorization: `Bearer ${token}` }) as any);
    await POST(postReq({ ...validBody, timestamp: validBody.timestamp + 60 }, { Authorization: `Bearer ${token}` }) as any);

    const incident = mockDb.current!.prepare(`SELECT * FROM incidents`).get() as any;
    expect(incident.status).toBe('resolved');
    expect(incident.resolved_at).toBe(validBody.timestamp + 60);

    const resolvedUpdate = mockDb.current!.prepare(
      `SELECT * FROM incident_updates WHERE status = 'resolved'`
    ).get() as any;
    expect(resolvedUpdate.message).toContain('recovered');
  });
});
