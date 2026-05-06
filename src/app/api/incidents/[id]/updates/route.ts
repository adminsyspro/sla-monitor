import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC'
  ).all(id) as Array<{ id: string; incident_id: string; status: string; message: string; created_by: string; created_at: number }>;

  return NextResponse.json(rows.map(u => ({
    id: u.id, incidentId: u.incident_id, status: u.status,
    message: u.message, createdBy: u.created_by,
    createdAt: fromEpoch(u.created_at),
  })));
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id: incidentId } = await params;
  const body = await request.json();
  const { status, message } = body;

  if (!status || !message) {
    return NextResponse.json({ error: 'Status and message are required' }, { status: 400 });
  }

  const db = getDb();

  const incident = db.prepare('SELECT id FROM incidents WHERE id = ?').get(incidentId);
  if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  const updateId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_by) VALUES (?, ?, ?, ?, ?)`
  ).run(updateId, incidentId, status, message, auth.username || 'admin');

  // Sync parent incident status
  const updateFields = ['status = ?', 'updated_at = unixepoch()'];
  const updateValues: unknown[] = [status];
  if (status === 'resolved') {
    updateFields.push('resolved_at = unixepoch()');
  }
  db.prepare(`UPDATE incidents SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues, incidentId);

  const row = db.prepare('SELECT * FROM incident_updates WHERE id = ?').get(updateId) as {
    id: string; incident_id: string; status: string; message: string; created_by: string; created_at: number;
  };

  return NextResponse.json({
    id: row.id, incidentId: row.incident_id, status: row.status,
    message: row.message, createdBy: row.created_by,
    createdAt: fromEpoch(row.created_at),
  }, { status: 201 });
}
