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

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const since = now - periodSeconds(period);

  // Get all enabled monitors
  const monitors = db.prepare(`
    SELECT id, name FROM monitors WHERE enabled = 1 ORDER BY name ASC
  `).all() as Array<{ id: string; name: string }>;

  if (monitors.length === 0) {
    return NextResponse.json({ period, services: [] });
  }

  // Per-monitor check stats over the period
  const checkStats = db.prepare(`
    SELECT
      monitor_id,
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) AS ok
    FROM monitor_checks
    WHERE timestamp >= ?
    GROUP BY monitor_id
  `).all(since) as Array<{ monitor_id: string; total: number; ok: number }>;

  const statsMap = new Map<string, { total: number; ok: number }>();
  for (const s of checkStats) {
    statsMap.set(s.monitor_id, { total: s.total, ok: s.ok });
  }

  // Look up SLA targets — monitor_ids column is a JSON array
  // We pick the first matching target for each monitor (if any)
  const slaTargets = db.prepare(`
    SELECT id, monitor_ids, target_uptime FROM sla_targets
  `).all() as Array<{ id: string; monitor_ids: string; target_uptime: number }>;

  function getTarget(monitorId: string): number {
    for (const t of slaTargets) {
      let ids: string[] = [];
      try { ids = JSON.parse(t.monitor_ids); } catch { ids = []; }
      if (ids.includes(monitorId)) return t.target_uptime;
    }
    return 99.9;
  }

  const services = monitors.map(m => {
    const s = statsMap.get(m.id);
    const total = s?.total ?? 0;
    const ok = s?.ok ?? 0;
    const failures = total - ok;
    const uptime = total > 0 ? Math.round((ok / total) * 100 * 10000) / 10000 : 100;
    return {
      id: m.id,
      name: m.name,
      uptime,
      target: getTarget(m.id),
      checks: total,
      failures,
    };
  });

  // Sort by uptime ascending (worst first)
  services.sort((a, b) => a.uptime - b.uptime);

  return NextResponse.json({ period, services });
}
