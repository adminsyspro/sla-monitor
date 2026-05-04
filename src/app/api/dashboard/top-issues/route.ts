import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Period = '24h' | '7d' | '30d';

function periodSeconds(period: Period): number {
  switch (period) {
    case '24h': return 86400;
    case '7d':  return 604800;
    case '30d': return 2592000;
    default:    return 2592000;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPeriod = searchParams.get('period') ?? '30d';
  const period = (['24h', '7d', '30d'].includes(rawPeriod) ? rawPeriod : '30d') as Period;
  const limitParam = parseInt(searchParams.get('limit') ?? '5', 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 5 : limitParam), 20);

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - periodSeconds(period);

  // Per-monitor aggregated stats
  const rows = db.prepare(`
    SELECT
      m.id,
      m.name,
      COUNT(mc.id) AS total,
      SUM(CASE WHEN mc.status != 'operational' THEN 1 ELSE 0 END) AS failures,
      ROUND(AVG(CASE WHEN mc.response_time IS NOT NULL THEN mc.response_time END), 0) AS avg_rt
    FROM monitors m
    LEFT JOIN monitor_checks mc ON mc.monitor_id = m.id AND mc.timestamp >= ?
    WHERE m.enabled = 1
    GROUP BY m.id, m.name
    ORDER BY failures DESC, avg_rt DESC
    LIMIT ?
  `).all(since, limit) as Array<{
    id: string; name: string; total: number; failures: number; avg_rt: number | null;
  }>;

  const issues = await Promise.all(rows.map(async (r) => {
    const total = r.total ?? 0;
    const failures = r.failures ?? 0;
    const ok = total - failures;
    const uptime = total > 0 ? Math.round((ok / total) * 100 * 10000) / 10000 : 100;

    // Fetch up to 3 most recent distinct error strings for this monitor
    const errorRows = db.prepare(`
      SELECT DISTINCT error
      FROM monitor_checks
      WHERE monitor_id = ? AND timestamp >= ? AND error IS NOT NULL AND error != ''
      ORDER BY timestamp DESC
      LIMIT 3
    `).all(r.id, since) as Array<{ error: string }>;

    return {
      id: r.id,
      name: r.name,
      uptime,
      avgResponseTime: r.avg_rt ?? 0,
      failuresCount: failures,
      lastErrors: errorRows.map(e => e.error),
    };
  }));

  // Sort by uptime ascending (worst first)
  issues.sort((a, b) => a.uptime - b.uptime);

  return NextResponse.json({ period, issues });
}
