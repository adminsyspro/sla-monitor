import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

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

  const existing = db.prepare('SELECT id FROM maintenance_windows WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Maintenance not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.affectedMonitors !== undefined) { fields.push('affected_monitors = ?'); values.push(JSON.stringify(body.affectedMonitors)); }
  if (body.scheduledStart !== undefined) { fields.push('scheduled_start = ?'); values.push(Math.floor(new Date(body.scheduledStart).getTime() / 1000)); }
  if (body.scheduledEnd !== undefined) { fields.push('scheduled_end = ?'); values.push(Math.floor(new Date(body.scheduledEnd).getTime() / 1000)); }
  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }

  fields.push('updated_at = unixepoch()');
  db.prepare(`UPDATE maintenance_windows SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);

  const row = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow;
  return NextResponse.json(toResponse(row));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();
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

  if (action === 'start') {
    db.prepare(
      `UPDATE maintenance_windows SET actual_start = unixepoch(), status = 'in_progress', updated_at = unixepoch() WHERE id = ?`
    ).run(id);
  } else if (action === 'complete') {
    db.prepare(
      `UPDATE maintenance_windows SET actual_end = unixepoch(), status = 'completed', updated_at = unixepoch() WHERE id = ?`
    ).run(id);
  } else {
    return NextResponse.json({ error: 'Action invalide (start ou complete)' }, { status: 400 });
  }

  const row = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow;
  return NextResponse.json(toResponse(row));
}
