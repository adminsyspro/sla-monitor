import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

interface IncidentRow {
  id: string; title: string; status: string; severity: string;
  affected_monitors: string; started_at: number; resolved_at: number | null;
  root_cause: string | null; postmortem: string | null;
  created_by: string; created_at: number; updated_at: number;
}

interface UpdateRow {
  id: string; incident_id: string; status: string; message: string;
  created_by: string; created_at: number;
}

function toResponse(row: IncidentRow, updates: UpdateRow[] = []) {
  return {
    id: row.id, title: row.title, status: row.status, severity: row.severity,
    affectedMonitors: parseJsonArray(row.affected_monitors),
    startedAt: fromEpoch(row.started_at),
    resolvedAt: row.resolved_at ? fromEpoch(row.resolved_at) : undefined,
    rootCause: row.root_cause, postmortem: row.postmortem,
    createdBy: row.created_by,
    updates: updates.map(u => ({
      id: u.id, incidentId: u.incident_id, status: u.status,
      message: u.message, createdBy: u.created_by,
      createdAt: fromEpoch(u.created_at),
    })),
  };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow | undefined;
  if (!row) return NextResponse.json({ error: 'Incident non trouvé' }, { status: 404 });
  const updates = db.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC').all(id) as UpdateRow[];
  return NextResponse.json(toResponse(row, updates));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow | undefined;
  if (!existing) return NextResponse.json({ error: 'Incident non trouvé' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.severity !== undefined) { fields.push('severity = ?'); values.push(body.severity); }
  if (body.affectedMonitors !== undefined) { fields.push('affected_monitors = ?'); values.push(JSON.stringify(body.affectedMonitors)); }
  if (body.rootCause !== undefined) { fields.push('root_cause = ?'); values.push(body.rootCause); }
  if (body.postmortem !== undefined) { fields.push('postmortem = ?'); values.push(body.postmortem); }

  if (body.status !== undefined) {
    fields.push('status = ?'); values.push(body.status);
    if (body.status === 'resolved' && !existing.resolved_at) {
      fields.push('resolved_at = unixepoch()');
    }
  }

  fields.push('updated_at = unixepoch()');

  if (fields.length > 1) {
    db.prepare(`UPDATE incidents SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  }

  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow;
  const updates = db.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC').all(id) as UpdateRow[];
  return NextResponse.json(toResponse(row, updates));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
