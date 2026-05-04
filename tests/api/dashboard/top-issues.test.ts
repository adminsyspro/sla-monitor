import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockDb: { current: Database.Database | null } = { current: null };
vi.mock('@/lib/db', () => ({ getDb: () => mockDb.current! }));

import { GET } from '@/app/api/dashboard/top-issues/route';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE monitors (
      id TEXT PRIMARY KEY, name TEXT, url TEXT, type TEXT, interval_seconds INTEGER,
      timeout_ms INTEGER, status TEXT, enabled INTEGER, last_check_at INTEGER
    );
    CREATE TABLE monitor_checks (
      id TEXT PRIMARY KEY, monitor_id TEXT, timestamp INTEGER, status TEXT,
      response_time INTEGER, status_code INTEGER, error TEXT, region TEXT, metadata TEXT
    );
  `);
  return db;
}

function makeReq(params?: string): Request {
  const url = params
    ? 'http://x/api/dashboard/top-issues?' + params
    : 'http://x/api/dashboard/top-issues';
  return new Request(url);
}

describe('GET /api/dashboard/top-issues', () => {
  beforeEach(() => {
    mockDb.current = makeDb();
  });

  it('returns empty array when no monitors exist', async () => {
    const res = await GET(makeReq() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issues).toEqual([]);
  });

  it('correctly aggregates failures and surfaces last error strings', async () => {
    const db = mockDb.current!;
    const now = Math.floor(Date.now() / 1000);

    db.prepare('INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('m1', 'API Production', 'https://api', 'http', 60, 5000, 'operational', 1);

    // 8 operational + 2 failures with errors
    for (let i = 0; i < 8; i++) {
      db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time) VALUES (?, ?, ?, ?, ?)')
        .run('ok-' + i, 'm1', now - i * 60, 'operational', 100);
    }
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time, error) VALUES (?, ?, ?, ?, ?, ?)')
      .run('f1', 'm1', now - 500, 'major', null, 'timeout');
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time, error) VALUES (?, ?, ?, ?, ?, ?)')
      .run('f2', 'm1', now - 600, 'major', null, 'expected 200, got 503');

    const res = await GET(makeReq('limit=5') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.issues.length).toBe(1);
    const issue = body.issues[0];
    expect(issue.id).toBe('m1');
    expect(issue.name).toBe('API Production');
    expect(issue.failuresCount).toBe(2);
    expect(issue.uptime).toBe(80);
    expect(issue.lastErrors.length).toBeGreaterThan(0);
    expect(issue.lastErrors).toContain('timeout');
    expect(issue.lastErrors).toContain('expected 200, got 503');
  });
});
