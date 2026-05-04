import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockDb: { current: Database.Database | null } = { current: null };
vi.mock('@/lib/db', () => ({ getDb: () => mockDb.current! }));

import { GET } from '@/app/api/dashboard/services-uptime/route';

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
    CREATE TABLE sla_targets (
      id TEXT PRIMARY KEY, name TEXT, monitor_ids TEXT, target_uptime REAL,
      period TEXT, exclude_maintenance_windows INTEGER,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  return db;
}

function makeReq(period?: string): Request {
  const url = period
    ? 'http://x/api/dashboard/services-uptime?period=' + period
    : 'http://x/api/dashboard/services-uptime';
  return new Request(url);
}

describe('GET /api/dashboard/services-uptime', () => {
  beforeEach(() => {
    mockDb.current = makeDb();
  });

  it('returns empty array when no monitors exist', async () => {
    const res = await GET(makeReq() as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services).toEqual([]);
    expect(body.period).toBe('30d');
  });

  it('correctly computes uptime per monitor with mixed operational and major checks', async () => {
    const db = mockDb.current!;
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('m1', 'API Production', 'https://api', 'http', 60, 5000, 'operational', 1);
    db.prepare('INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('m2', 'Web', 'https://web', 'http', 60, 5000, 'operational', 1);

    // m1: 9 operational + 1 major = 90% uptime
    for (let i = 0; i < 9; i++) {
      db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
        .run('c1-' + i, 'm1', now - i * 60, 'operational');
    }
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
      .run('c1-fail', 'm1', now - 3600, 'major');

    // m2: 10 operational = 100% uptime
    for (let i = 0; i < 10; i++) {
      db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
        .run('c2-' + i, 'm2', now - i * 60, 'operational');
    }

    const res = await GET(makeReq('30d') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.services.length).toBe(2);
    // Worst first
    const s1 = body.services[0];
    expect(s1.name).toBe('API Production');
    expect(s1.uptime).toBe(90);
    expect(s1.failures).toBe(1);
    expect(s1.checks).toBe(10);
  });

  it('sorts by uptime ascending (worst first)', async () => {
    const db = mockDb.current!;
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('m1', 'Good', 'https://g', 'http', 60, 5000, 'operational', 1);
    db.prepare('INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('m2', 'Bad', 'https://b', 'http', 60, 5000, 'operational', 1);

    // m1: 100% uptime (10 operational)
    for (let i = 0; i < 10; i++) {
      db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
        .run('g-' + i, 'm1', now - i * 60, 'operational');
    }
    // m2: 80% uptime (8 operational, 2 major)
    for (let i = 0; i < 8; i++) {
      db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
        .run('b-' + i, 'm2', now - i * 60, 'operational');
    }
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
      .run('b-f1', 'm2', now - 7200, 'major');
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
      .run('b-f2', 'm2', now - 7260, 'major');

    const res = await GET(makeReq('30d') as any);
    const body = await res.json();
    expect(body.services[0].name).toBe('Bad');
    expect(body.services[1].name).toBe('Good');
  });
});
