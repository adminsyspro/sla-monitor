import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

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

export async function GET(request: NextRequest) {
  const db = getDb();
  const status = request.nextUrl.searchParams.get('status');
  const search = request.nextUrl.searchParams.get('search');

  let sql = 'SELECT * FROM maintenance_windows WHERE 1=1';
  const params: unknown[] = [];

  if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY scheduled_start DESC';

  const rows = db.prepare(sql).all(...params) as MaintRow[];
  return NextResponse.json(rows.map(toResponse));
}

export async function POST(request: NextRequest) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { title, description, affectedMonitors, scheduledStart, scheduledEnd } = body;

  if (!title || !scheduledStart || !scheduledEnd) {
    return NextResponse.json({ error: 'Title, start and end are required' }, { status: 400 });
  }

  const db = getDb();
  const id = crypto.randomUUID();

  const start = Math.floor(new Date(scheduledStart).getTime() / 1000);
  const end = Math.floor(new Date(scheduledEnd).getTime() / 1000);

  db.prepare(
    `INSERT INTO maintenance_windows (id, title, description, affected_monitors, scheduled_start, scheduled_end, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, description || '', JSON.stringify(affectedMonitors || []), start, end, auth.username || 'admin');

  const row = db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintRow;
  return NextResponse.json(toResponse(row), { status: 201 });
}
