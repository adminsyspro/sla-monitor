import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockDb: { current: Database.Database | null } = { current: null };
vi.mock('@/lib/db', () => ({ getDb: () => mockDb.current! }));

import { GET } from '@/app/api/dashboard/response-time/route';

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

function makeReq(period?: string): Request {
  const url = period
    ? 'http://x/api/dashboard/response-time?period=' + period
    : 'http://x/api/dashboard/response-time';
  return new Request(url);
}

describe('GET /api/dashboard/response-time', () => {
  beforeEach(() => {
    mockDb.current = makeDb();
  });

  it('returns empty buckets array when no checks exist', async () => {
    const res = await GET(makeReq('24h') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('24h');
    expect(Array.isArray(body.buckets)).toBe(true);
    const withData = body.buckets.filter((b: any) => b.avg !== null);
    expect(withData.length).toBe(0);
    expect(body.stats.avg).toBe(0);
  });

  it('returns correctly-bucketed averages with seeded data', async () => {
    const db = mockDb.current!;
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time) VALUES (?, ?, ?, ?, ?)')
      .run('c1', 'm1', now - 300, 'operational', 100);
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time) VALUES (?, ?, ?, ?, ?)')
      .run('c2', 'm1', now - 200, 'operational', 200);

    const res = await GET(makeReq('1h') as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('1h');
    const bucketsWithData = body.buckets.filter((b: any) => b.avg !== null);
    expect(bucketsWithData.length).toBeGreaterThan(0);
    expect(body.stats.avg).toBe(150);
    expect(body.stats.min).toBe(100);
    expect(body.stats.max).toBe(200);
  });

  it('respects the period param: 1h yields 60 buckets', async () => {
    const res = await GET(makeReq('1h') as any);
    const body = await res.json();
    expect(body.period).toBe('1h');
    expect(body.buckets.length).toBe(60);
  });

  it('respects the period param: 30d yields 30 buckets', async () => {
    const res = await GET(makeReq('30d') as any);
    const body = await res.json();
    expect(body.period).toBe('30d');
    expect(body.buckets.length).toBe(30);
  });

  it('falls back to 24h for unknown period', async () => {
    const res = await GET(makeReq('bogus') as any);
    const body = await res.json();
    expect(body.period).toBe('24h');
    expect(body.buckets.length).toBe(48);
  });
});
