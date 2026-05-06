import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { GET, PUT } from '@/app/api/settings/general/route';
import { setRetentionDays } from '@/lib/settings';

vi.mock('@/lib/db', () => {
  let db: Database.Database;
  return {
    getDb: () => db,
    __setDb: (d: Database.Database) => { db = d; },
  };
});
import * as dbMod from '@/lib/db';

function makeDb() {
  const db = new Database(':memory:');
  db.prepare('CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
  return db;
}

function adminReq(method: 'GET' | 'PUT', body?: unknown): Request {
  return new Request('http://x/api/settings/general', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-user-role': 'Administrator',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET/PUT /api/settings/general retentionDays', () => {
  beforeEach(() => {
    const db = makeDb();
    (dbMod as unknown as { __setDb: (d: Database.Database) => void }).__setDb(db);
  });

  it('GET returns retentionDays default (90) when unset', async () => {
    const res = await GET(adminReq('GET') as unknown as import('next/server').NextRequest);
    const body = await res.json();
    expect(body.retentionDays).toBe(90);
  });

  it('GET returns the stored retentionDays value', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, 30);
    const res = await GET(adminReq('GET') as unknown as import('next/server').NextRequest);
    const body = await res.json();
    expect(body.retentionDays).toBe(30);
  });

  it('GET returns null retentionDays for unlimited', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, null);
    const res = await GET(adminReq('GET') as unknown as import('next/server').NextRequest);
    const body = await res.json();
    expect(body.retentionDays).toBeNull();
  });

  it('PUT accepts retentionDays=180', async () => {
    const res = await PUT(adminReq('PUT', { retentionDays: 180 }) as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(200);
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('retention_days') as { value: string };
    expect(row.value).toBe('180');
  });

  it('PUT accepts retentionDays=null (unlimited)', async () => {
    const res = await PUT(adminReq('PUT', { retentionDays: null }) as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(200);
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('retention_days') as { value: string };
    expect(row.value).toBe('unlimited');
  });

  it('PUT rejects invalid retentionDays', async () => {
    const res = await PUT(adminReq('PUT', { retentionDays: 45 }) as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(400);
  });

  it('PUT 403 for non-admin', async () => {
    const req = new Request('http://x', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-user-role': 'User' },
      body: JSON.stringify({ retentionDays: 30 }),
    });
    const res = await PUT(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(403);
  });

  it('PUT preserves existing string keys', async () => {
    await PUT(adminReq('PUT', { siteName: 'Acme', contactEmail: 'a@b', timezone: 'UTC', retentionDays: 30 }) as unknown as import('next/server').NextRequest);
    const res = await GET(adminReq('GET') as unknown as import('next/server').NextRequest);
    const body = await res.json();
    expect(body.siteName).toBe('Acme');
    expect(body.retentionDays).toBe(30);
  });
});
