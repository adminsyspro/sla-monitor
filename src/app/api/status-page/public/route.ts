import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseJsonArray, fromEpoch } from '@/lib/api-helpers';
import { parseWindow, windowToDays } from '@/lib/window';
import { applyMaintenanceTransitions } from '@/lib/maintenance';

function mapUptimeHistory(days: Array<{
  date: string; total: number; ok: number | null; avg_response_time: number | null;
}>) {
  return days.map(day => {
    const uptime = day.total > 0 ? Math.round(((day.ok || 0) / day.total) * 100 * 100) / 100 : 0;
    return {
      date: day.date,
      uptime,
      responseTime: day.avg_response_time ? Math.round(day.avg_response_time) : undefined,
      status:
        day.total === 0 ? 'unknown' :
        uptime >= 99.9 ? 'operational' :
        uptime >= 99 ? 'degraded' :
        uptime > 0 ? 'partial' : 'major',
    };
  });
}

export async function GET(request: NextRequest) {
  const db = getDb();
  applyMaintenanceTransitions(db);

  const preview = request.nextUrl.searchParams.get('preview') === '1';
  const period = parseWindow(request.nextUrl.searchParams.get('period') || '90d');
  const days = windowToDays(period);

  const config = db.prepare("SELECT * FROM status_page_config WHERE id = 'default'").get() as {
    enabled: number; title: string; description: string; theme: string;
    accent_color: string; show_uptime: number; show_incidents: number;
    logo_url: string; background_color: string; header_background: string;
    header_text_color: string; card_background: string; border_radius: string;
    operational_message: string; degraded_message: string; major_message: string;
    maintenance_message: string; footer_text: string;
    monitor_ids: string;
  } | undefined;

  if (!config || (!config.enabled && !preview)) {
    return NextResponse.json({ error: 'Status page disabled' }, { status: 404 });
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

  // Compute uptime for each monitor (30d summary + selected-period history)
  const monitorData = monitors.map(m => {
    const stats = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok
      FROM monitor_checks WHERE monitor_id = ? AND timestamp >= ?
    `).get(m.id, now - 30 * 86400) as { total: number; ok: number };

    const history = db.prepare(`
      SELECT
        date(timestamp, 'unixepoch') as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok,
        AVG(response_time) as avg_response_time
      FROM monitor_checks
      WHERE monitor_id = ? AND timestamp >= ?
      GROUP BY date(timestamp, 'unixepoch')
      ORDER BY date ASC
    `).all(m.id, now - days * 86400) as Array<{
      date: string; total: number; ok: number | null; avg_response_time: number | null;
    }>;

    return {
      id: m.id, name: m.name, status: m.status, groupId: m.group_id,
      uptime: stats.total > 0 ? Math.round((stats.ok / stats.total) * 100 * 100) / 100 : 100,
      uptimeHistory: mapUptimeHistory(history),
    };
  });

  // Aggregated uptime history for the public status page
  const historyMonitorIds = monitors.map(m => m.id);
  const uptimeHistory = historyMonitorIds.length > 0
    ? db.prepare(`
      SELECT
        date(timestamp, 'unixepoch') as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as ok,
        AVG(response_time) as avg_response_time
      FROM monitor_checks
      WHERE monitor_id IN (${historyMonitorIds.map(() => '?').join(',')})
        AND timestamp >= ?
      GROUP BY date(timestamp, 'unixepoch')
      ORDER BY date ASC
    `).all(...historyMonitorIds, now - days * 86400) as Array<{
      date: string; total: number; ok: number | null; avg_response_time: number | null;
    }>
    : [];

  // Recent incidents
  const incidents = db.prepare(`
    SELECT id, title, status, severity, started_at, resolved_at, root_cause, impact, resolution, preventive_actions FROM incidents
    WHERE started_at >= ? ORDER BY started_at DESC LIMIT 10
  `).all(now - days * 86400) as Array<{
    id: string; title: string; status: string; severity: string;
    started_at: number; resolved_at: number | null;
    root_cause: string | null; impact: string | null; resolution: string | null; preventive_actions: string | null;
  }>;

  const maintenanceWindows = db.prepare(`
    SELECT id, title, description, affected_monitors, scheduled_start, scheduled_end, actual_start, actual_end, status, created_by, created_at, updated_at
    FROM maintenance_windows
    WHERE status IN ('scheduled', 'in_progress') AND scheduled_end >= ?
    ORDER BY scheduled_start ASC
    LIMIT 10
  `).all(now) as Array<{
    id: string; title: string; description: string; affected_monitors: string;
    scheduled_start: number; scheduled_end: number; actual_start: number | null; actual_end: number | null;
    status: string; created_by: string; created_at: number; updated_at: number;
  }>;
  const visibleMonitorIds = new Set(monitors.map(m => m.id));
  const visibleMaintenanceWindows = maintenanceWindows.filter(m => {
    const affected = parseJsonArray(m.affected_monitors);
    return affected.length === 0 || affected.some(id => visibleMonitorIds.has(id));
  });

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
    logoUrl: config.logo_url,
    backgroundColor: config.background_color,
    headerBackground: config.header_background,
    headerTextColor: config.header_text_color,
    cardBackground: config.card_background,
    borderRadius: config.border_radius,
    operationalMessage: config.operational_message,
    degradedMessage: config.degraded_message,
    majorMessage: config.major_message,
    maintenanceMessage: config.maintenance_message,
    footerText: config.footer_text,
    period,
    days,
    overallStatus,
    groups: groups
      .map(g => ({
        id: g.id, name: g.name,
        monitors: monitorData.filter(m => m.groupId === g.id),
      }))
      .filter(g => g.monitors.length > 0),
    ungroupedMonitors: monitorData.filter(m => !m.groupId),
    uptimeHistory: mapUptimeHistory(uptimeHistory),
    incidents: incidents.map(i => {
      const updates = db.prepare(`
        SELECT id, status, message, created_by, created_at
        FROM incident_updates
        WHERE incident_id = ?
        ORDER BY created_at ASC
      `).all(i.id) as Array<{ id: string; status: string; message: string; created_by: string; created_at: number }>;

      return {
        id: i.id, title: i.title, status: i.status, severity: i.severity,
        startedAt: fromEpoch(i.started_at),
        resolvedAt: i.resolved_at ? fromEpoch(i.resolved_at) : undefined,
        rootCause: i.root_cause || '',
        impact: i.impact || '',
        resolution: i.resolution || '',
        preventiveActions: i.preventive_actions || '',
        updates: updates.map(update => ({
          id: update.id,
          status: update.status,
          message: update.message,
          createdBy: update.created_by,
          createdAt: fromEpoch(update.created_at),
        })),
      };
    }),
    maintenanceWindows: visibleMaintenanceWindows.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      affectedMonitors: parseJsonArray(m.affected_monitors),
      scheduledStart: fromEpoch(m.scheduled_start),
      scheduledEnd: fromEpoch(m.scheduled_end),
      actualStart: m.actual_start ? fromEpoch(m.actual_start) : undefined,
      actualEnd: m.actual_end ? fromEpoch(m.actual_end) : undefined,
      status: m.status,
      createdBy: m.created_by,
      createdAt: fromEpoch(m.created_at),
      updatedAt: fromEpoch(m.updated_at),
    })),
  });
}
