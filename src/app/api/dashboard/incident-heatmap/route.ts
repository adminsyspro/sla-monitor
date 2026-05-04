import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const WEEKS = 12;

export async function GET() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - WEEKS * 7 * 86400;

  // SQLite strftime with 'unixepoch' modifier gives UTC day-of-week (0=Sunday) and hour
  const rows = db.prepare(`
    SELECT
      CAST(strftime('%w', started_at, 'unixepoch') AS INTEGER) AS day,
      CAST(strftime('%H', started_at, 'unixepoch') AS INTEGER) AS hour,
      COUNT(*) AS count
    FROM incidents
    WHERE started_at >= ?
    GROUP BY day, hour
    ORDER BY day, hour
  `).all(since) as Array<{ day: number; hour: number; count: number }>;

  const totalIncidents = rows.reduce((sum, r) => sum + r.count, 0);

  return NextResponse.json({
    weeks: WEEKS,
    totalIncidents,
    cells: rows,
  });
}
