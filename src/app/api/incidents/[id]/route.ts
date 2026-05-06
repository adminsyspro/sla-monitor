import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkWriteAccess, parseJsonArray, fromEpoch } from '@/lib/api-helpers';

type RouteContext = { params: Promise<{ id: string }> };

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

function replaceRelatedIncidents(db: ReturnType<typeof getDb>, id: string, relatedIncidentIds: unknown) {
  const targetIds = normalizeStringArray(relatedIncidentIds).filter(targetId => targetId !== id);
  const exists = db.prepare('SELECT id FROM incidents WHERE id = ?');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO incident_links (id, source_incident_id, target_incident_id, relation_type)
    VALUES (?, ?, ?, 'related')
  `);

  const transaction = db.transaction((ids: string[]) => {
    db.prepare('DELETE FROM incident_links WHERE source_incident_id = ? OR target_incident_id = ?').run(id, id);
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

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow | undefined;
  if (!row) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  const updates = db.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC').all(id) as UpdateRow[];
  return NextResponse.json(toResponse(row, updates, loadRelatedIncidents(db, id)));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow | undefined;
  if (!existing) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.severity !== undefined) { fields.push('severity = ?'); values.push(body.severity); }
  if (body.affectedMonitors !== undefined) { fields.push('affected_monitors = ?'); values.push(JSON.stringify(body.affectedMonitors)); }
  if (body.rootCause !== undefined) { fields.push('root_cause = ?'); values.push(body.rootCause); }
  if (body.postmortem !== undefined) { fields.push('postmortem = ?'); values.push(body.postmortem); }
  if (body.impact !== undefined) { fields.push('impact = ?'); values.push(body.impact); }
  if (body.resolution !== undefined) { fields.push('resolution = ?'); values.push(body.resolution); }
  if (body.preventiveActions !== undefined) { fields.push('preventive_actions = ?'); values.push(body.preventiveActions); }
  if (body.owner !== undefined) { fields.push('owner = ?'); values.push(body.owner); }
  if (body.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(normalizeStringArray(body.tags))); }

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
  if (body.relatedIncidentIds !== undefined) {
    replaceRelatedIncidents(db, id, body.relatedIncidentIds);
  }

  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as IncidentRow;
  const updates = db.prepare('SELECT * FROM incident_updates WHERE incident_id = ? ORDER BY created_at ASC').all(id) as UpdateRow[];
  return NextResponse.json(toResponse(row, updates, loadRelatedIncidents(db, id)));
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = checkWriteAccess(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDb();
  db.prepare('DELETE FROM incident_links WHERE source_incident_id = ? OR target_incident_id = ?').run(id, id);
  db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
