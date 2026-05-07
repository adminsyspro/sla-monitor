import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();

  const monitor = db.prepare('SELECT id FROM monitors WHERE id = ?').get(id);
  if (!monitor) return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });

  const period = request.nextUrl.searchParams.get('period') || '30d';
  const periodMap: Record<string, number> = {
    '24h': 86400, '7d': 604800, '30d': 2592000, '90d': 7776000, '1y': 31536000,
  };
  const seconds = periodMap[period] || 2592000;
  const since = Math.floor(Date.now() / 1000) - seconds;

  // Daily aggregation
  const dailyRows = db.prepare(`
    SELECT
      date(timestamp, 'unixepoch') as date,
      COUNT(*) as checks,
      SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok,
      SUM(CASE WHEN status != 'operational' THEN 1 ELSE 0 END) as failures,
      ROUND(AVG(response_time), 0) as avg_response_time,
      CASE
        WHEN SUM(CASE WHEN status = 'major' THEN 1 ELSE 0 END) > 0 THEN 'major'
        WHEN SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) > 0 THEN 'partial'
        WHEN SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) > 0 THEN 'degraded'
        ELSE 'operational'
      END as day_status
    FROM monitor_checks
    WHERE monitor_id = ? AND timestamp >= ?
    GROUP BY date(timestamp, 'unixepoch')
    ORDER BY date ASC
  `).all(id, since) as Array<{
    date: string; checks: number; ok: number; failures: number;
    avg_response_time: number; day_status: string;
  }>;

  // Overall summary
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_checks,
      SUM(CASE WHEN status != 'operational' THEN 1 ELSE 0 END) as total_failures,
      ROUND(AVG(response_time), 0) as avg_response_time,
      MIN(response_time) as min_response_time,
      MAX(response_time) as max_response_time
    FROM monitor_checks
    WHERE monitor_id = ? AND timestamp >= ?
  `).get(id, since) as {
    total_checks: number; total_failures: number;
    avg_response_time: number; min_response_time: number; max_response_time: number;
  };

  const totalChecks = summary.total_checks || 1;
  const uptime = ((totalChecks - (summary.total_failures || 0)) / totalChecks) * 100;

  // Latency trend — fixed window of the last 60 minutes (one bucket per minute),
  // regardless of `period`.
  const BUCKET_SECONDS = 60;
  const TREND_BUCKETS = 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const nowBucket = Math.floor(nowSec / BUCKET_SECONDS) * BUCKET_SECONDS;
  const trendSince = nowBucket - (TREND_BUCKETS - 1) * BUCKET_SECONDS;

  const trendRows = db.prepare(`
    SELECT
      (timestamp / ${BUCKET_SECONDS}) * ${BUCKET_SECONDS} AS bucket_ts,
      ROUND(AVG(response_time), 0) AS avg_ms
    FROM monitor_checks
    WHERE monitor_id = ? AND timestamp >= ?
    GROUP BY bucket_ts
    ORDER BY bucket_ts ASC
  `).all(id, trendSince) as Array<{ bucket_ts: number; avg_ms: number | null }>;

  const trendMap = new Map(trendRows.map(r => [r.bucket_ts, r.avg_ms]));
  const trend = Array.from({ length: TREND_BUCKETS }, (_, i) => {
    const ts = nowBucket - (TREND_BUCKETS - 1 - i) * BUCKET_SECONDS;
    const ms = trendMap.get(ts);
    return {
      date: new Date(ts * 1000).toISOString(),
      ms: ms == null ? null : ms,
    };
  });

  return NextResponse.json({
    monitorId: id,
    period,
    uptime: Math.round(uptime * 1000) / 1000,
    totalChecks: summary.total_checks,
    totalFailures: summary.total_failures || 0,
    avgResponseTime: summary.avg_response_time || 0,
    minResponseTime: summary.min_response_time || 0,
    maxResponseTime: summary.max_response_time || 0,
    dailyData: dailyRows.map(d => ({
      date: d.date,
      status: d.day_status,
      uptime: d.checks > 0 ? Math.round((d.ok / d.checks) * 100 * 1000) / 1000 : 100,
      checks: d.checks,
      failures: d.failures,
      avgResponseTime: d.avg_response_time || 0,
    })),
    trend,
  });
}
