import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

interface MonitorRow {
  id: string;
  name: string;
  url: string;
  type: string;
  interval_seconds: number;
  timeout_ms: number;
  status: string;
  enabled: number;
  group_id: string | null;
  tags: string;
  expected_status_code: number | null;
  port: number | null;
  check_certificate: number | null;
  certificate_expiry_warning: number | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

function toResponse(row: MonitorRow) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    type: row.type,
    interval: row.interval_seconds,
    timeout: row.timeout_ms,
    status: row.status,
    enabled: row.enabled === 1,
    groupId: row.group_id,
    tags: parseJsonArray(row.tags),
    expectedStatusCode: row.expected_status_code,
    port: row.port,
    checkCertificate: row.check_certificate === 1,
    certificateExpiryWarning: row.certificate_expiry_warning,
    createdAt: fromEpoch(row.created_at),
    updatedAt: fromEpoch(row.updated_at),
  };
}

// GET /api/monitors
export async function GET(request: NextRequest) {
  const db = getDb();
  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const type = url.searchParams.get('type');
  const search = url.searchParams.get('search');
  const groupId = url.searchParams.get('groupId');

  let sql = 'SELECT * FROM monitors WHERE 1=1';
  const params: unknown[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (groupId) { sql += ' AND group_id = ?'; params.push(groupId); }
  if (search) { sql += ' AND (name LIKE ? OR url LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY created_at ASC';

  const rows = db.prepare(sql).all(...params) as MonitorRow[];
  return NextResponse.json(rows.map(toResponse));
}

// POST /api/monitors
export async function POST(request: NextRequest) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { name, url, type, interval, timeout, groupId, tags, expectedStatusCode, port, checkCertificate, certificateExpiryWarning } = body;

  if (!name || !url || !type) {
    return NextResponse.json({ error: 'Name, URL and type are required' }, { status: 400 });
  }

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, group_id, tags, expected_status_code, port, check_certificate, certificate_expiry_warning, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'unknown', 1, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, name, url, type,
    interval || 60, timeout || 10000,
    groupId || null,
    JSON.stringify(tags || []),
    expectedStatusCode || null,
    port || null,
    checkCertificate ? 1 : null,
    certificateExpiryWarning || null,
    auth.username || 'admin'
  );

  const row = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as MonitorRow;
  return NextResponse.json(toResponse(row), { status: 201 });
}
