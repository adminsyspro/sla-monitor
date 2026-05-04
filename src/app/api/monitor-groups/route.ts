import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, fromEpoch } from '@/lib/api-helpers';

interface GroupRow {
  id: string; name: string; description: string;
  sort_order: number; created_at: number; updated_at: number;
}

function toResponse(row: GroupRow) {
  return {
    id: row.id, name: row.name, description: row.description,
    order: row.sort_order,
    createdAt: fromEpoch(row.created_at), updatedAt: fromEpoch(row.updated_at),
  };
}

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM monitor_groups ORDER BY sort_order ASC').all() as GroupRow[];
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
    `INSERT INTO monitor_groups (id, name, description, sort_order) VALUES (?, ?, ?, ?)`
  ).run(id, body.name, body.description || '', body.order || 0);

  const row = db.prepare('SELECT * FROM monitor_groups WHERE id = ?').get(id) as GroupRow;
  return NextResponse.json(toResponse(row), { status: 201 });
}
