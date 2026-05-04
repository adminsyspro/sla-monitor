import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since24h = now - 86400;

  // Monitor counts by status
  const monitorStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM monitors WHERE enabled = 1 GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  const totalMonitors = monitorStats.reduce((s, r) => s + r.count, 0);
  const statusCounts: Record<string, number> = {};
  for (const r of monitorStats) statusCounts[r.status] = r.count;

  // Overall uptime (24h)
  const uptimeStats = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok
    FROM monitor_checks WHERE timestamp >= ?
  `).get(since24h) as { total: number; ok: number };
  const overallUptime = uptimeStats.total > 0
    ? Math.round((uptimeStats.ok / uptimeStats.total) * 100 * 1000) / 1000
    : 100;

  // Active incidents
  const activeIncidents = db.prepare(`
    SELECT COUNT(*) as cnt FROM incidents WHERE status != 'resolved'
  `).get() as { cnt: number };

  // MTTR (average of resolved incidents in last 30 days)
  const mttrResult = db.prepare(`
    SELECT AVG(resolved_at - started_at) as avg_seconds FROM incidents
    WHERE resolved_at IS NOT NULL AND started_at >= ?
  `).get(now - 30 * 86400) as { avg_seconds: number | null };
  const mttr = mttrResult.avg_seconds ? Math.round(mttrResult.avg_seconds / 60 * 10) / 10 : 0;

  // Error budget (based on 99.9% SLA over 30 days)
  const thirtyDayChecks = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok
    FROM monitor_checks WHERE timestamp >= ?
  `).get(now - 30 * 86400) as { total: number; ok: number };
  const actualUptime30d = thirtyDayChecks.total > 0 ? (thirtyDayChecks.ok / thirtyDayChecks.total) * 100 : 100;
  const targetUptime = 99.9;
  const totalMinutes30d = 30 * 24 * 60;
  const allowedDowntime = totalMinutes30d * (1 - targetUptime / 100);
  const actualDowntime = totalMinutes30d * (1 - actualUptime30d / 100);
  const errorBudgetRemaining = allowedDowntime > 0
    ? Math.max(0, Math.round((1 - actualDowntime / allowedDowntime) * 100))
    : 100;

  // Checks per minute (last hour)
  const checksLastHour = db.prepare(`
    SELECT COUNT(*) as cnt FROM monitor_checks WHERE timestamp >= ?
  `).get(now - 3600) as { cnt: number };
  const checksPerMinute = Math.round(checksLastHour.cnt / 60);

  // Avg response time (24h)
  const avgRt = db.prepare(`
    SELECT ROUND(AVG(response_time), 0) as avg FROM monitor_checks WHERE timestamp >= ? AND response_time IS NOT NULL
  `).get(since24h) as { avg: number | null };

  return NextResponse.json({
    totalMonitors,
    statusCounts,
    overallUptime,
    activeIncidents: activeIncidents.cnt,
    mttr,
    errorBudgetRemaining,
    checksPerMinute,
    avgResponseTime: avgRt.avg || 0,
  });
}
