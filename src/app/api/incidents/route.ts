import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

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

export async function GET(request: NextRequest) {
  const db = getDb();
  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');
  const search = url.searchParams.get('search');

  let sql = 'SELECT * FROM incidents WHERE 1=1';
  const params: unknown[] = [];

  if (status === 'active') { sql += " AND status != 'resolved'"; }
  else if (status === 'resolved') { sql += " AND status = 'resolved'"; }
  else if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }

  if (severity) { sql += ' AND severity = ?'; params.push(severity); }
  if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }

  sql += ' ORDER BY started_at DESC';

  const rows = db.prepare(sql).all(...params) as IncidentRow[];

  const result = rows.map(row => {
    const updates = db.prepare(
      'SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC'
    ).all(row.id) as UpdateRow[];
    return toResponse(row, updates);
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { title, severity, affectedMonitors, message } = body;

  if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO incidents (id, title, status, severity, affected_monitors, created_by)
     VALUES (?, ?, 'investigating', ?, ?, ?)`
  ).run(id, title, severity || 'minor', JSON.stringify(affectedMonitors || []), auth.username || 'admin');

  // Create first update automatically
  if (message) {
    db.prepare(
      `INSERT INTO incident_updates (id, incident_id, status, message, created_by)
       VALUES (?, ?, 'investigating', ?, ?)`
    ).run(crypto.randomUUID(), id, message, auth.username || 'admin');
  }

  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow;
  const updates = db.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC').all(id) as UpdateRow[];
  return NextResponse.json(toResponse(row, updates), { status: 201 });
}
