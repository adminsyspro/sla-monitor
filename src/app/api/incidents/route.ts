import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

interface IncidentRow {
  id: string; title: string; status: string; severity: string;
  affected_monitors: string; started_at: number; resolved_at: number | null;
  root_cause: string | null; postmortem: string | null;
  impact: string | null; resolution: string | null; preventive_actions: string | null;
  owner: string | null; tags: string | null;
  created_by: string; created_at: number; updated_at: number;
}

interface UpdateRow {
  id: string; incident_id: string; status: string; message: string;
  created_by: string; created_at: number;
}

interface RelatedIncidentRow {
  id: string; title: string; status: string; severity: string; relation_type: string;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map(item => item.trim()).filter(Boolean))];
}

function loadRelatedIncidents(db: ReturnType<typeof getDb>, id: string): RelatedIncidentRow[] {
  return db.prepare(`
    SELECT i.id, i.title, i.status, i.severity, il.relation_type
    FROM incident_links il
    JOIN incidents i ON i.id = il.target_incident_id
    WHERE il.source_incident_id = ?
    UNION
    SELECT i.id, i.title, i.status, i.severity, il.relation_type
    FROM incident_links il
    JOIN incidents i ON i.id = il.source_incident_id
    WHERE il.target_incident_id = ?
    ORDER BY title ASC
  `).all(id, id) as RelatedIncidentRow[];
}

function insertRelatedIncidents(db: ReturnType<typeof getDb>, id: string, relatedIncidentIds: unknown) {
  const targetIds = normalizeStringArray(relatedIncidentIds).filter(targetId => targetId !== id);
  if (targetIds.length === 0) return;

  const exists = db.prepare('SELECT id FROM incidents WHERE id = ?');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO incident_links (id, source_incident_id, target_incident_id, relation_type)
    VALUES (?, ?, ?, 'related')
  `);

  const transaction = db.transaction((ids: string[]) => {
    for (const targetId of ids) {
      if (exists.get(targetId)) {
        insert.run(crypto.randomUUID(), id, targetId);
      }
    }
  });

  transaction(targetIds);
}

function toResponse(row: IncidentRow, updates: UpdateRow[] = [], relatedIncidents: RelatedIncidentRow[] = []) {
  return {
    id: row.id, title: row.title, status: row.status, severity: row.severity,
    affectedMonitors: parseJsonArray(row.affected_monitors),
    startedAt: fromEpoch(row.started_at),
    resolvedAt: row.resolved_at ? fromEpoch(row.resolved_at) : undefined,
    rootCause: row.root_cause, postmortem: row.postmortem,
    impact: row.impact || '',
    resolution: row.resolution || '',
    preventiveActions: row.preventive_actions || '',
    owner: row.owner || '',
    tags: parseJsonArray(row.tags),
    relatedIncidents: relatedIncidents.map(incident => ({
      id: incident.id,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      relationType: incident.relation_type,
    })),
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
  const owner = url.searchParams.get('owner');
  const tag = url.searchParams.get('tag');

  let sql = 'SELECT * FROM incidents WHERE 1=1';
  const params: unknown[] = [];

  if (status === 'active') { sql += " AND status != 'resolved'"; }
  else if (status === 'resolved') { sql += " AND status = 'resolved'"; }
  else if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }

  if (severity && severity !== 'all') { sql += ' AND severity = ?'; params.push(severity); }
  if (owner) { sql += ' AND owner LIKE ?'; params.push(`%${owner}%`); }
  if (tag) { sql += ' AND tags LIKE ?'; params.push(`%${tag}%`); }
  if (search) {
    sql += ` AND (
      title LIKE ? OR root_cause LIKE ? OR impact LIKE ? OR resolution LIKE ?
      OR preventive_actions LIKE ? OR owner LIKE ? OR tags LIKE ?
    )`;
    params.push(...Array(7).fill(`%${search}%`));
  }

  sql += ' ORDER BY started_at DESC';

  const rows = db.prepare(sql).all(...params) as IncidentRow[];

  const result = rows.map(row => {
    const updates = db.prepare(
      'SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC'
    ).all(row.id) as UpdateRow[];
    return toResponse(row, updates, loadRelatedIncidents(db, row.id));
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const {
    title,
    severity,
    affectedMonitors,
    message,
    rootCause,
    postmortem,
    impact,
    resolution,
    preventiveActions,
    owner,
    tags,
    relatedIncidentIds,
  } = body;

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO incidents (
      id, title, status, severity, affected_monitors, root_cause, postmortem,
      impact, resolution, preventive_actions, owner, tags, created_by
    )
     VALUES (?, ?, 'investigating', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    title,
    severity || 'minor',
    JSON.stringify(affectedMonitors || []),
    rootCause || null,
    postmortem || null,
    impact || '',
    resolution || '',
    preventiveActions || '',
    owner || '',
    JSON.stringify(normalizeStringArray(tags)),
    auth.username || 'admin'
  );

  insertRelatedIncidents(db, id, relatedIncidentIds);

  // Create first update automatically
  if (message) {
    db.prepare(
      `INSERT INTO incident_updates (id, incident_id, status, message, created_by)
       VALUES (?, ?, 'investigating', ?, ?)`
    ).run(crypto.randomUUID(), id, message, auth.username || 'admin');
  }

  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow;
  const updates = db.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC').all(id) as UpdateRow[];
  return NextResponse.json(toResponse(row, updates, loadRelatedIncidents(db, id)), { status: 201 });
}
