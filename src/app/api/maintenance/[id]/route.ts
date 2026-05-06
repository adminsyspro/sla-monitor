import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';
import {
  applyMaintenanceTransitions,
  completeMaintenanceWindow,
  startMaintenanceWindow,
  syncInProgressMaintenanceMonitors,
} from '@/lib/maintenance';

type RouteContext = { params: Promise<{ id: string }> };

interface MaintRow {
  id: string; title: string; description: string; affected_monitors: string;
  scheduled_start: number; scheduled_end: number;
  actual_start: number | null; actual_end: number | null;
  status: string; created_by: string; created_at: number; updated_at: number;
}

function toResponse(row: MaintRow) {
  return {
    id: row.id, title: row.title, description: row.description,
    affectedMonitors: parseJsonArray(row.affected_monitors),
    scheduledStart: fromEpoch(row.scheduled_start),
    scheduledEnd: fromEpoch(row.scheduled_end),
    actualStart: row.actual_start ? fromEpoch(row.actual_start) : undefined,
    actualEnd: row.actual_end ? fromEpoch(row.actual_end) : undefined,
    status: row.status, createdBy: row.created_by,
    createdAt: fromEpoch(row.created_at), updatedAt: fromEpoch(row.updated_at),
  };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  applyMaintenanceTransitions(db);

  const row = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow | undefined;
  if (!row) return NextResponse.json({ error: 'Maintenance not found' }, { status: 404 });
  return NextResponse.json(toResponse(row));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow | undefined;
  if (!existing) return NextResponse.json({ error: 'Maintenance not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.affectedMonitors !== undefined) {
    fields.push('affected_monitors = ?');
    values.push(JSON.stringify(Array.isArray(body.affectedMonitors) ? body.affectedMonitors : []));
  }
  const nextStart = body.scheduledStart !== undefined
    ? Math.floor(new Date(body.scheduledStart).getTime() / 1000)
    : existing.scheduled_start;
  const nextEnd = body.scheduledEnd !== undefined
    ? Math.floor(new Date(body.scheduledEnd).getTime() / 1000)
    : existing.scheduled_end;

  if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd) || nextEnd <= nextStart) {
    return NextResponse.json({ error: 'Scheduled end must be after scheduled start' }, { status: 400 });
  }

  if (body.scheduledStart !== undefined) { fields.push('scheduled_start = ?'); values.push(nextStart); }
  if (body.scheduledEnd !== undefined) { fields.push('scheduled_end = ?'); values.push(nextEnd); }
  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }

  fields.push('updated_at = unixepoch()');
  db.prepare(`UPDATE maintenance_windows SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);

  const row = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow;
  syncInProgressMaintenanceMonitors(db, existing, row);
  applyMaintenanceTransitions(db);

  const updatedRow = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow;
  return NextResponse.json(toResponse(updatedRow));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();
  applyMaintenanceTransitions(db);

  const existing = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow | undefined;
  if (existing?.status === 'in_progress') {
    completeMaintenanceWindow(db, existing, Math.floor(Date.now() / 1000));
  }

  db.prepare('DELETE FROM maintenance_windows WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}

// PATCH /api/maintenance/[id]?action=start|complete
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const action = request.nextUrl.searchParams.get('action');
  const db = getDb();

  const existing = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow | undefined;
  if (!existing) return NextResponse.json({ error: 'Maintenance not found' }, { status: 404 });
  const now = Math.floor(Date.now() / 1000);

  if (action === 'start') {
    startMaintenanceWindow(db, existing, now);
  } else if (action === 'complete') {
    completeMaintenanceWindow(db, existing, now);
  } else {
    return NextResponse.json({ error: 'Invalid action (start or complete)' }, { status: 400 });
  }

  const row = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow;
  return NextResponse.json(toResponse(row));
}
