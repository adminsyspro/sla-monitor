import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

interface MonitorRow {
  id: string; name: string; url: string; type: string;
  interval_seconds: number; timeout_ms: number; status: string;
  enabled: number; group_id: string | null; tags: string;
  expected_status_code: number | null; port: number | null;
  check_certificate: number | null; certificate_expiry_warning: number | null;
  created_by: string; created_at: number; updated_at: number;
}

function toResponse(row: MonitorRow) {
  return {
    id: row.id, name: row.name, url: row.url, type: row.type,
    interval: row.interval_seconds, timeout: row.timeout_ms,
    status: row.status, enabled: row.enabled === 1,
    groupId: row.group_id, tags: parseJsonArray(row.tags),
    expectedStatusCode: row.expected_status_code, port: row.port,
    checkCertificate: row.check_certificate === 1,
    certificateExpiryWarning: row.certificate_expiry_warning,
    createdAt: fromEpoch(row.created_at), updatedAt: fromEpoch(row.updated_at),
  };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as MonitorRow | undefined;
  if (!row) return NextResponse.json({ error: 'Monitor non trouvé' }, { status: 404 });
  return NextResponse.json(toResponse(row));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.prepare('SELECT id FROM monitors WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Monitor non trouvé' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.url !== undefined) { fields.push('url = ?'); values.push(body.url); }
  if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type); }
  if (body.interval !== undefined) { fields.push('interval_seconds = ?'); values.push(body.interval); }
  if (body.timeout !== undefined) { fields.push('timeout_ms = ?'); values.push(body.timeout); }
  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
  if (body.groupId !== undefined) { fields.push('group_id = ?'); values.push(body.groupId || null); }
  if (body.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(body.tags)); }
  if (body.expectedStatusCode !== undefined) { fields.push('expected_status_code = ?'); values.push(body.expectedStatusCode); }
  if (body.port !== undefined) { fields.push('port = ?'); values.push(body.port); }

  fields.push('updated_at = unixepoch()');

  if (fields.length > 1) {
    db.prepare(`UPDATE monitors SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  }

  const row = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as MonitorRow;
  return NextResponse.json(toResponse(row));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM monitors WHERE id = ?').get(id);
  if (!existing) return NextResponse.json({ error: 'Monitor non trouvé' }, { status: 404 });

  db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
