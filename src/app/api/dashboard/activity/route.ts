import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { fromEpoch } from '@/lib/api-helpers';

export async function GET() {
  const db = getDb();

  // Recent incident updates
  const incidentUpdates = db.prepare(`
    SELECT iu.id, iu.created_at as timestamp, iu.status, iu.message, iu.created_by,
           i.title as incident_title, i.severity,
           CASE
             WHEN iu.status = 'resolved' THEN 'incident_resolved'
             WHEN iu.status = 'investigating' THEN 'incident_created'
             ELSE 'incident_updated'
           END as type
    FROM incident_updates iu
    JOIN incidents i ON iu.incident_id = i.id
    ORDER BY iu.created_at DESC
    LIMIT 15
  `).all() as Array<{
    id: string; timestamp: number; status: string; message: string;
    created_by: string; incident_title: string; severity: string; type: string;
  }>;

  // Recent maintenance events
  const maintenanceEvents = db.prepare(`
    SELECT id, title,
      CASE
        WHEN status = 'completed' THEN actual_end
        WHEN status = 'in_progress' THEN actual_start
        ELSE created_at
      END as timestamp,
      CASE
        WHEN status = 'completed' THEN 'maintenance_ended'
        WHEN status = 'in_progress' THEN 'maintenance_started'
        ELSE 'maintenance_scheduled'
      END as type,
      status, created_by
    FROM maintenance_windows
    ORDER BY updated_at DESC
    LIMIT 10
  `).all() as Array<{
    id: string; title: string; timestamp: number; type: string;
    status: string; created_by: string;
  }>;

  const activities = [
    ...incidentUpdates.map(u => ({
      id: u.id,
      type: u.type,
      title: u.incident_title,
      description: u.message,
      timestamp: fromEpoch(u.timestamp),
      user: u.created_by,
      severity: u.severity,
    })),
    ...maintenanceEvents.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      description: `Maintenance ${m.status === 'completed' ? 'terminée' : m.status === 'in_progress' ? 'démarrée' : 'planifiée'}`,
      timestamp: fromEpoch(m.timestamp),
      user: m.created_by,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
   .slice(0, 20);

  return NextResponse.json(activities);
}
