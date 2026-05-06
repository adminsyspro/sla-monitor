import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/settings/retention/route';
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

function req(): NextRequest {
  return new Request('http://x/api/settings/retention') as unknown as NextRequest;
}

describe('GET /api/settings/retention', () => {
  beforeEach(() => {
    const db = makeDb();
    (dbMod as unknown as { __setDb: (d: Database.Database) => void }).__setDb(db);
  });

  it('returns default 90 when unset', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ retentionDays: 90 });
  });

  it('returns null for unlimited', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, null);
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual({ retentionDays: null });
  });

  it('returns stored numeric value', async () => {
    const db = (dbMod as unknown as { getDb: () => Database.Database }).getDb();
    setRetentionDays(db, 30);
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual({ retentionDays: 30 });
  });
});
