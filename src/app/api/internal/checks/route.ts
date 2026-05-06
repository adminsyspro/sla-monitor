import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { validateProberToken } from '@/lib/auth/prober-token';

const PROTECTED_STATUSES = new Set(['maintenance', 'partial']);
const INCIDENT_TRIGGER_STATUSES = new Set(['degraded', 'major']);

function getStatusLabel(status: string): string {
  switch (status) {
    case 'degraded': return 'degraded performance';
    case 'major': return 'a major outage';
    default: return status;
  }
}

function getSeverity(status: string): 'minor' | 'major' {
  return status === 'major' ? 'major' : 'minor';
}

function getCheckMessage(status: string, error: string | null, responseTime: number | null, statusCode: number | null): string {
  const details = [
    error ? `Error: ${error}` : null,
    statusCode ? `HTTP status: ${statusCode}` : null,
    responseTime ? `Response time: ${responseTime}ms` : null,
  ].filter(Boolean).join(' · ');

  return `Automated monitor check reported ${getStatusLabel(status)}.${details ? ` ${details}` : ''}`;
}

function getActiveSystemIncident(db: ReturnType<typeof getDb>, monitorId: string) {
  return db.prepare(`
    SELECT id, severity FROM incidents
    WHERE created_by = 'system'
      AND status != 'resolved'
      AND affected_monitors = ?
    ORDER BY started_at DESC
    LIMIT 1
  `).get(JSON.stringify([monitorId])) as { id: string; severity: string } | undefined;
}

function createSystemIncident(
  db: ReturnType<typeof getDb>,
  monitor: { id: string; name: string },
  check: z.infer<typeof CheckSchema>
) {
  const incidentId = crypto.randomUUID();
  const severity = getSeverity(check.status);
  db.prepare(`
    INSERT INTO incidents (
      id, title, status, severity, affected_monitors, started_at,
      impact, owner, tags, created_by, created_at, updated_at
    )
    VALUES (?, ?, 'investigating', ?, ?, ?, ?, '', ?, 'system', ?, ?)
  `).run(
    incidentId,
    `${monitor.name} is experiencing ${getStatusLabel(check.status)}`,
    severity,
    JSON.stringify([monitor.id]),
    check.timestamp,
    `Automated detection from ${check.region} monitor checks.`,
    JSON.stringify(['auto-detected', `monitor:${monitor.id}`, check.status]),
    check.timestamp,
    check.timestamp
  );

  db.prepare(`
    INSERT INTO incident_updates (id, incident_id, status, message, created_by, created_at)
    VALUES (?, ?, 'investigating', ?, 'system', ?)
  `).run(
    crypto.randomUUID(),
    incidentId,
    getCheckMessage(check.status, check.error, check.response_time_ms, check.status_code),
    check.timestamp
  );
}

function updateSystemIncident(
  db: ReturnType<typeof getDb>,
  incident: { id: string; severity: string },
  check: z.infer<typeof CheckSchema>
) {
  const nextSeverity = getSeverity(check.status);
  if (incident.severity !== nextSeverity) {
    db.prepare('UPDATE incidents SET severity = ?, updated_at = ? WHERE id = ?')
      .run(nextSeverity, check.timestamp, incident.id);
  } else {
    db.prepare('UPDATE incidents SET updated_at = ? WHERE id = ?')
      .run(check.timestamp, incident.id);
  }

  db.prepare(`
    INSERT INTO incident_updates (id, incident_id, status, message, created_by, created_at)
    VALUES (?, ?, 'investigating', ?, 'system', ?)
  `).run(
    crypto.randomUUID(),
    incident.id,
    getCheckMessage(check.status, check.error, check.response_time_ms, check.status_code),
    check.timestamp
  );
}

function resolveSystemIncident(
  db: ReturnType<typeof getDb>,
  incident: { id: string },
  monitorName: string,
  checkTimestamp: number
) {
  db.prepare(`
    UPDATE incidents
    SET status = 'resolved', resolved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(checkTimestamp, checkTimestamp, incident.id);

  db.prepare(`
    INSERT INTO incident_updates (id, incident_id, status, message, created_by, created_at)
    VALUES (?, ?, 'resolved', ?, 'system', ?)
  `).run(
    crypto.randomUUID(),
    incident.id,
    `${monitorName} recovered. Automated monitor checks are operational again.`,
    checkTimestamp
  );
}

const CheckSchema = z.object({
  monitor_id: z.string().min(1),
  timestamp: z.number().int().positive(),
  status: z.enum(['operational', 'degraded', 'major', 'unknown']),
  response_time_ms: z.number().int().nullable(),
  status_code: z.number().int().nullable(),
  error: z.string().nullable(),
  region: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

export async function POST(request: NextRequest) {
  const db = getDb();
  if (!validateProberToken(request.headers.get('authorization'), db)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = CheckSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }
  const c = parsed.data;

  const monitor = db
    .prepare('SELECT id, name, status, enabled FROM monitors WHERE id = ?')
    .get(c.monitor_id) as { id: string; name: string; status: string; enabled: number } | undefined;
  if (!monitor) return NextResponse.json({ error: 'monitor_not_found' }, { status: 404 });
  if (monitor.enabled === 0) return NextResponse.json({ error: 'monitor_disabled' }, { status: 410 });

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time, status_code, error, region, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      c.monitor_id,
      c.timestamp,
      c.status,
      c.response_time_ms,
      c.status_code,
      c.error,
      c.region,
      JSON.stringify(c.metadata)
    );

    const activeSystemIncident = getActiveSystemIncident(db, c.monitor_id);
    const isProtectedMaintenance = monitor.status === 'maintenance';
    const shouldCreateOrUpdateIncident = INCIDENT_TRIGGER_STATUSES.has(c.status) && !isProtectedMaintenance;
    const statusChanged = monitor.status !== c.status;

    if (shouldCreateOrUpdateIncident) {
      if (!activeSystemIncident) {
        createSystemIncident(db, monitor, c);
      } else if (statusChanged) {
        updateSystemIncident(db, activeSystemIncident, c);
      }
    } else if (c.status === 'operational' && activeSystemIncident) {
      resolveSystemIncident(db, activeSystemIncident, monitor.name, c.timestamp);
    }

    if (PROTECTED_STATUSES.has(monitor.status)) {
      db.prepare(`UPDATE monitors SET last_check_at = ?, updated_at = unixepoch() WHERE id = ?`)
        .run(c.timestamp, c.monitor_id);
    } else {
      db.prepare(`UPDATE monitors SET last_check_at = ?, status = ?, updated_at = unixepoch() WHERE id = ?`)
        .run(c.timestamp, c.status, c.monitor_id);
    }
  });
  tx();

  return new NextResponse(null, { status: 201 });
}
