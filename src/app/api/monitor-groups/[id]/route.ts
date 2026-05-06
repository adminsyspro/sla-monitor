import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.prepare('SELECT id FROM monitor_groups WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];
  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.order !== undefined) { fields.push('sort_order = ?'); values.push(body.order); }
  fields.push('updated_at = unixepoch()');

  db.prepare(`UPDATE monitor_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  const row = db.prepare('SELECT * FROM monitor_groups WHERE id = ?').get(id) as GroupRow;
  return NextResponse.json(toResponse(row));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM monitor_groups WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
