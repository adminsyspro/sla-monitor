import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { POST } from '@/app/api/internal/cleanup/route';
import { setRetentionDays } from '@/lib/settings';

vi.mock('@/lib/db', () => {
  let db: Database.Database;
  return {
    getDb: () => db,
    __setDb: (d: Database.Database) => { db = d; },
  };
});
vi.mock('@/lib/auth/prober-token', () => ({
  validateProberToken: (header: string | null) => header === 'Bearer test-token',
}));

import * as dbMod from '@/lib/db';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.prepare('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  db.prepare(`CREATE TABLE monitor_checks (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    status TEXT NOT NULL,
    response_time INTEGER,
    status_code INTEGER,
    error TEXT,
    region TEXT,
    metadata TEXT
  )`).run();
  return db;
}

function seedChecks(db: Database.Database, count: number, ageDays: number) {
  const stmt = db.prepare(
    `INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)`
  );
  const cutoff = Math.floor(Date.now() / 1000) - ageDays * 86400;
  for (let i = 0; i < count; i++) stmt.run(`c${ageDays}-${i}`, 'm1', cutoff + i, 'operational');
}

function makeReq(token = 'test-token'): Request {
  return new Request('http://x/api/internal/cleanup', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('POST /api/internal/cleanup', () => {
  beforeEach(() => {
    const db = makeDb();
    (dbMod as unknown as { __setDb: (d: Database.Database) => void }).__setDb(db);
  });

  it('rejects unauthorized callers', async () => {
    const res = await POST(makeReq('wrong'));
    expect(res.status).toBe(401);
  });

  it('returns skipped:"unlimited" when retention is null', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, null);
    seedChecks(db, 10, 100);
    const res = await POST(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ deleted: 0, retention_days: null, skipped: 'unlimited' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM monitor_checks').get()).toMatchObject({ n: 10 });
  });

  it('deletes rows older than retention, keeps recent ones', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, 30);
    seedChecks(db, 50, 100); // 100 days old → must be deleted
    seedChecks(db, 50, 5);   // 5 days old → must remain
    const res = await POST(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ deleted: 50, retention_days: 30 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM monitor_checks').get()).toMatchObject({ n: 50 });
  });

  it('caps deletions at 50000 per call', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, 30);
    seedChecks(db, 60_000, 100);
    const res1 = await POST(makeReq());
    const body1 = await res1.json();
    expect(body1.deleted).toBe(50_000);
    expect(db.prepare('SELECT COUNT(*) AS n FROM monitor_checks').get()).toMatchObject({ n: 10_000 });
    const res2 = await POST(makeReq());
    const body2 = await res2.json();
    expect(body2.deleted).toBe(10_000);
    expect(db.prepare('SELECT COUNT(*) AS n FROM monitor_checks').get()).toMatchObject({ n: 0 });
  });

  it('uses the default retention of 90 days when key is absent', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    seedChecks(db, 10, 200); // older than 90d → deleted
    seedChecks(db, 10, 30);  // within 90d → kept
    const res = await POST(makeReq());
    const body = await res.json();
    expect(body).toMatchObject({ deleted: 10, retention_days: 90 });
  });
});
