import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM sla_targets WHERE id = ?').get(id) as SlaRow | undefined;
  if (!row) return NextResponse.json({ error: 'SLA target not found' }, { status: 404 });
  return NextResponse.json(toResponse(row));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.prepare('SELECT id FROM sla_targets WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'SLA target not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.monitorIds !== undefined) { fields.push('monitor_ids = ?'); values.push(JSON.stringify(body.monitorIds)); }
  if (body.targetUptime !== undefined) { fields.push('target_uptime = ?'); values.push(body.targetUptime); }
  if (body.period !== undefined) { fields.push('period = ?'); values.push(body.period); }
  if (body.excludeMaintenanceWindows !== undefined) { fields.push('exclude_maintenance_windows = ?'); values.push(body.excludeMaintenanceWindows ? 1 : 0); }
  fields.push('updated_at = unixepoch()');

  db.prepare(`UPDATE sla_targets SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  const row = db.prepare('SELECT * FROM sla_targets WHERE id = ?').get(id) as SlaRow;
  return NextResponse.json(toResponse(row));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM sla_targets WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
