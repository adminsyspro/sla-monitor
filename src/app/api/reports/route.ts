import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseJsonArray, fromEpoch } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  const db = getDb();
  const period = request.nextUrl.searchParams.get('period') || 'monthly';
  const startParam = request.nextUrl.searchParams.get('start');
  const endParam = request.nextUrl.searchParams.get('end');

  const targets = db.prepare('SELECT * FROM sla_targets ORDER BY created_at ASC').all() as Array<{
    id: string; name: string; monitor_ids: string; target_uptime: number;
    period: string; exclude_maintenance_windows: number;
  }>;

  const now = Math.floor(Date.now() / 1000);
  const periodSeconds: Record<string, number> = { monthly: 30 * 86400, quarterly: 90 * 86400, yearly: 365 * 86400 };
  const customStart = startParam ? Math.floor(new Date(`${startParam}T00:00:00.000Z`).getTime() / 1000) : null;
  const customEnd = endParam ? Math.floor(new Date(`${endParam}T23:59:59.999Z`).getTime() / 1000) : null;
  const hasValidCustomRange = customStart !== null && customEnd !== null && Number.isFinite(customStart) && Number.isFinite(customEnd) && customEnd >= customStart;
  const since = hasValidCustomRange ? customStart : now - (periodSeconds[period] || 30 * 86400);
  const until = hasValidCustomRange ? customEnd : now;
  const totalMinutes = (until - since) / 60;

  const reports = targets.map(target => {
    const monitorIds = parseJsonArray(target.monitor_ids);
    if (monitorIds.length === 0) {
      return {
        id: target.id, targetName: target.name, targetUptime: target.target_uptime,
        period, startDate: fromEpoch(since), endDate: fromEpoch(until),
        actualUptime: 100, isMet: true, totalDowntimeMinutes: 0,
        incidents: 0, mttr: 0,
      };
    }

    const placeholders = monitorIds.map(() => '?').join(',');
    const stats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok
      FROM monitor_checks WHERE monitor_id IN (${placeholders}) AND timestamp >= ? AND timestamp <= ?
    `).get(...monitorIds, since, until) as { total: number; ok: number };

    const actualUptime = stats.total > 0 ? Math.round((stats.ok / stats.total) * 100 * 1000) / 1000 : 100;
    const downtime = Math.round(totalMinutes * (1 - actualUptime / 100));

    // Count incidents affecting these monitors
    const incidentCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM incidents WHERE started_at >= ? AND started_at <= ?
    `).get(since, until) as { cnt: number };

    // MTTR: average resolution time of resolved incidents
    const mttrResult = db.prepare(`
      SELECT AVG(resolved_at - started_at) as avg_seconds FROM incidents
      WHERE resolved_at IS NOT NULL AND started_at >= ? AND started_at <= ?
    `).get(since, until) as { avg_seconds: number | null };
    const mttr = mttrResult.avg_seconds ? Math.round(mttrResult.avg_seconds / 60) : 0;

    return {
      id: target.id, targetName: target.name, targetUptime: target.target_uptime,
      period, startDate: fromEpoch(since), endDate: fromEpoch(until),
      actualUptime, isMet: actualUptime >= target.target_uptime,
      totalDowntimeMinutes: downtime, incidents: incidentCount.cnt, mttr,
    };
  });

  return NextResponse.json(reports);
}
