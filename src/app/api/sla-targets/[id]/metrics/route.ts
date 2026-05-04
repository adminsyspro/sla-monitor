import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseJsonArray } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();

  const target = db.prepare('SELECT * FROM sla_targets WHERE id = ?').get(id) as {
    id: string; monitor_ids: string; target_uptime: number; period: string;
    exclude_maintenance_windows: number;
  } | undefined;
  if (!target) return NextResponse.json({ error: 'Objectif SLA non trouvé' }, { status: 404 });

  const monitorIds = parseJsonArray(target.monitor_ids);
  if (monitorIds.length === 0) {
    return NextResponse.json({
      targetId: id, currentUptime: 100, targetUptime: target.target_uptime,
      isMet: true, downtimeMinutes: 0, allowedDowntimeMinutes: 0,
      errorBudgetUsed: 0, errorBudgetRemaining: 100, trend: 'stable', status: 'healthy',
    });
  }

  // Period calculation
  const now = Math.floor(Date.now() / 1000);
  const periodSeconds: Record<string, number> = { monthly: 30 * 86400, quarterly: 90 * 86400, yearly: 365 * 86400 };
  const since = now - (periodSeconds[target.period] || 30 * 86400);
  const totalMinutes = (now - since) / 60;

  // Aggregate checks across all monitors
  const placeholders = monitorIds.map(() => '?').join(',');
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_checks,
      SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok_checks
    FROM monitor_checks
    WHERE monitor_id IN (${placeholders}) AND timestamp >= ?
  `).get(...monitorIds, since) as { total_checks: number; ok_checks: number };

  const currentUptime = stats.total_checks > 0
    ? Math.round((stats.ok_checks / stats.total_checks) * 100 * 1000) / 1000
    : 100;

  const isMet = currentUptime >= target.target_uptime;
  const downtimeMinutes = Math.round(totalMinutes * (1 - currentUptime / 100));
  const allowedDowntimeMinutes = Math.round(totalMinutes * (1 - target.target_uptime / 100));
  const errorBudgetUsed = allowedDowntimeMinutes > 0
    ? Math.min(100, Math.round((downtimeMinutes / allowedDowntimeMinutes) * 100 * 10) / 10)
    : 0;

  let status: string;
  if (errorBudgetUsed <= 50) status = 'healthy';
  else if (errorBudgetUsed <= 80) status = 'warning';
  else status = 'critical';

  return NextResponse.json({
    targetId: id,
    currentUptime,
    targetUptime: target.target_uptime,
    isMet,
    downtimeMinutes,
    allowedDowntimeMinutes,
    errorBudgetUsed,
    errorBudgetRemaining: Math.max(0, 100 - errorBudgetUsed),
    trend: currentUptime >= target.target_uptime ? 'up' : 'down',
    status,
  });
}
