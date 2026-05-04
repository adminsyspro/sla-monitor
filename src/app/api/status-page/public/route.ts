import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseJsonArray, fromEpoch } from '@/lib/api-helpers';

export async function GET() {
  const db = getDb();

  const config = db.prepare("SELECT * FROM status_page_config WHERE id = 'default'").get() as {
    enabled: number; title: string; description: string; theme: string;
    accent_color: string; show_uptime: number; show_incidents: number;
    monitor_ids: string;
  } | undefined;

  if (!config || !config.enabled) {
    return NextResponse.json({ error: 'Page de statut désactivée' }, { status: 404 });
  }

  const monitorIds = parseJsonArray(config.monitor_ids);
  const now = Math.floor(Date.now() / 1000);

  // Get monitors with groups
  let monitors: Array<{ id: string; name: string; status: string; group_id: string | null }> = [];
  if (monitorIds.length > 0) {
    const placeholders = monitorIds.map(() => '?').join(',');
    monitors = db.prepare(
      `SELECT id, name, status, group_id FROM monitors WHERE id IN (${placeholders}) AND enabled = 1`
    ).all(...monitorIds) as typeof monitors;
  } else {
    monitors = db.prepare('SELECT id, name, status, group_id FROM monitors WHERE enabled = 1').all() as typeof monitors;
  }

  // Get groups
  const groups = db.prepare('SELECT id, name, sort_order FROM monitor_groups ORDER BY sort_order ASC').all() as Array<{
    id: string; name: string; sort_order: number;
  }>;

  // Compute uptime for each monitor (30d)
  const monitorData = monitors.map(m => {
    const stats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok
      FROM monitor_checks WHERE monitor_id = ? AND timestamp >= ?
    `).get(m.id, now - 30 * 86400) as { total: number; ok: number };

    return {
      id: m.id, name: m.name, status: m.status, groupId: m.group_id,
      uptime: stats.total > 0 ? Math.round((stats.ok / stats.total) * 100 * 100) / 100 : 100,
    };
  });

  // Recent incidents
  const incidents = db.prepare(`
    SELECT id, title, status, severity, started_at, resolved_at FROM incidents
    WHERE started_at >= ? ORDER BY started_at DESC LIMIT 10
  `).all(now - 7 * 86400) as Array<{
    id: string; title: string; status: string; severity: string;
    started_at: number; resolved_at: number | null;
  }>;

  // Overall status
  const hasIncident = monitors.some(m => m.status === 'major' || m.status === 'partial');
  const hasDegraded = monitors.some(m => m.status === 'degraded');
  const hasMaintenance = monitors.some(m => m.status === 'maintenance');
  let overallStatus = 'operational';
  if (hasIncident) overallStatus = 'major';
  else if (hasDegraded) overallStatus = 'degraded';
  else if (hasMaintenance) overallStatus = 'maintenance';

  return NextResponse.json({
    title: config.title,
    description: config.description,
    theme: config.theme,
    accentColor: config.accent_color,
    overallStatus,
    groups: groups.map(g => ({
      id: g.id, name: g.name,
      monitors: monitorData.filter(m => m.groupId === g.id),
    })),
    ungroupedMonitors: monitorData.filter(m => !m.groupId),
    incidents: incidents.map(i => ({
      id: i.id, title: i.title, status: i.status, severity: i.severity,
      startedAt: fromEpoch(i.started_at),
      resolvedAt: i.resolved_at ? fromEpoch(i.resolved_at) : undefined,
    })),
  });
}
