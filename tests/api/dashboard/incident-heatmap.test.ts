import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

const mockDb: { current: Database.Database | null } = { current: null };
vi.mock('@/lib/db', () => ({ getDb: () => mockDb.current! }));

import { GET } from '@/app/api/dashboard/incident-heatmap/route';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE incidents (
      id TEXT PRIMARY KEY, title TEXT, status TEXT, severity TEXT,
      affected_monitors TEXT, started_at INTEGER, resolved_at INTEGER,
      root_cause TEXT, postmortem TEXT, created_by TEXT,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  return db;
}

const makeReq = () => new Request('http://x/api/dashboard/incident-heatmap');

describe('GET /api/dashboard/incident-heatmap', () => {
  beforeEach(() => {
    mockDb.current = makeDb();
  });

  it('returns empty cells when no incidents exist', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalIncidents).toBe(0);
    expect(body.cells).toEqual([]);
    expect(body.weeks).toBe(12);
  });

  it('correctly groups multiple incidents by day and hour', async () => {
    const db = mockDb.current!;
    // Use a known timestamp: 2024-01-01 10:00:00 UTC = 1704103200
    // strftime('%w') for 2024-01-01 = 1 (Monday), strftime('%H') = 10
    const ts1 = 1704103200; // Mon Jan 01 2024 10:00:00 UTC
    // Same day/hour: another incident at 10:30
    const ts2 = ts1 + 1800; // 10:30
    // Different slot: Wed Jan 03 2024 14:00:00 UTC = 1704276000
    const ts3 = 1704276000; // Wed Jan 03 2024 14:00:00 UTC

    // These are within the last 12 weeks relative to now? Use recent timestamps
    const now = Math.floor(Date.now() / 1000);
    // Use timestamps 1 week ago to guarantee they're within 12 weeks
    const base = now - 7 * 86400;
    // Calculate a Monday 10:00 UTC within range
    const baseDate = new Date(base * 1000);
    const dayOfWeek = baseDate.getUTCDay(); // 0=Sun
    const daysToMon = (1 - dayOfWeek + 7) % 7 || 7;
    const monTs = base - (dayOfWeek === 1 ? 0 : (dayOfWeek === 0 ? 6 : dayOfWeek - 1)) * 86400;
    const mon10 = Math.floor(monTs / 86400) * 86400 + 10 * 3600;
    const mon10b = mon10 + 1800;
    const wed14 = mon10 + 2 * 86400 + 4 * 3600;

    db.prepare('INSERT INTO incidents (id, title, status, severity, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('i1', 'Inc 1', 'resolved', 'minor', mon10, mon10, mon10);
    db.prepare('INSERT INTO incidents (id, title, status, severity, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('i2', 'Inc 2', 'resolved', 'minor', mon10b, mon10b, mon10b);
    db.prepare('INSERT INTO incidents (id, title, status, severity, started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('i3', 'Inc 3', 'resolved', 'minor', wed14, wed14, wed14);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalIncidents).toBe(3);
    // There should be exactly 2 cells (one with count=2, one with count=1)
    expect(body.cells.length).toBe(2);
    const counts = body.cells.map((c: any) => c.count).sort((a: number, b: number) => b - a);
    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(1);
  });
});
