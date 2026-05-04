import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

interface SlaRow {
  id: string; name: string; monitor_ids: string; target_uptime: number;
  period: string; exclude_maintenance_windows: number;
  created_at: number; updated_at: number;
}

function toResponse(row: SlaRow) {
  return {
    id: row.id, name: row.name, monitorIds: parseJsonArray(row.monitor_ids),
    targetUptime: row.target_uptime, period: row.period,
    excludeMaintenanceWindows: row.exclude_maintenance_windows === 1,
    createdAt: fromEpoch(row.created_at), updatedAt: fromEpoch(row.updated_at),
  };
}

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sla_targets ORDER BY created_at ASC').all() as SlaRow[];
  return NextResponse.json(rows.map(toResponse));
}

export async function POST(request: NextRequest) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  if (!body.name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO sla_targets (id, name, monitor_ids, target_uptime, period, exclude_maintenance_windows)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, body.name, JSON.stringify(body.monitorIds || []),
    body.targetUptime || 99.9, body.period || 'monthly',
    body.excludeMaintenanceWindows !== false ? 1 : 0);

  const row = db.prepare('SELECT * FROM sla_targets WHERE id = ?').get(id) as SlaRow;
  return NextResponse.json(toResponse(row), { status: 201 });
}
