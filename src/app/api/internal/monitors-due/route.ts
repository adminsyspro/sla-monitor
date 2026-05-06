import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateProberToken } from '@/lib/auth/prober-token';
import { applyMaintenanceTransitions } from '@/lib/maintenance';
import type { DueMonitor, MonitorType } from '@/lib/internal-types';

interface MonitorRow {
  id: string;
  type: string;
  url: string;
  timeout_ms: number;
  expected_status_code: number | null;
  port: number | null;
  certificate_expiry_warning: number | null;
}

function shapeConfig(row: MonitorRow): Record<string, unknown> {
  switch (row.type as MonitorType) {
    case 'http':
      return row.expected_status_code != null ? { expected_status_code: row.expected_status_code } : {};
    case 'tcp':
      return row.port != null ? { port: row.port } : {};
    case 'ssl':
      return row.certificate_expiry_warning != null
        ? { expiry_warning_days: row.certificate_expiry_warning }
        : {};
    default:
      return {};
  }
}

export async function GET(request: NextRequest) {
  const db = getDb();
  if (!validateProberToken(request.headers.get('authorization'), db)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  applyMaintenanceTransitions(db);

  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Math.max(1, Math.min(500, isNaN(rawLimit) ? 100 : rawLimit));

  const rows = db
    .prepare(
      `SELECT id, type, url, timeout_ms, expected_status_code, port, certificate_expiry_warning
         FROM monitors
        WHERE enabled = 1
          AND (last_check_at IS NULL OR last_check_at + interval_seconds <= unixepoch())
        ORDER BY last_check_at IS NULL DESC, last_check_at ASC
        LIMIT ?`
    )
    .all(limit) as MonitorRow[];

  const monitors: DueMonitor[] = rows.map(r => ({
    id: r.id,
    type: r.type as MonitorType,
    url: r.url,
    timeout_ms: r.timeout_ms,
    config: shapeConfig(r),
  }));

  return NextResponse.json({ monitors });
}
