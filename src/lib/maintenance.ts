import type Database from 'better-sqlite3';
import { parseJsonArray } from '@/lib/api-helpers';

interface MaintenanceRow {
  id: string;
  affected_monitors: string;
  scheduled_start: number;
  scheduled_end: number;
  actual_start: number | null;
  actual_end: number | null;
  status: string;
}

const RESTORABLE_STATUSES = new Set(['operational', 'degraded', 'partial', 'major', 'unknown']);

function tableExists(db: Database.Database, tableName: string) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function affectedMonitorIds(row: Pick<MaintenanceRow, 'affected_monitors'>) {
  return parseJsonArray(row.affected_monitors);
}

function updateMonitorStatuses(db: Database.Database, monitorIds: string[], status: string) {
  if (monitorIds.length === 0) return;
  const placeholders = monitorIds.map(() => '?').join(',');
  db.prepare(`
    UPDATE monitors
    SET status = ?, updated_at = unixepoch()
    WHERE id IN (${placeholders}) AND enabled = 1
  `).run(status, ...monitorIds);
}

function latestRealMonitorStatus(db: Database.Database, monitorId: string) {
  const row = db.prepare(`
    SELECT status
    FROM monitor_checks
    WHERE monitor_id = ? AND status != 'maintenance'
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(monitorId) as { status: string } | undefined;

  return row && RESTORABLE_STATUSES.has(row.status) ? row.status : 'unknown';
}

function hasOtherActiveMaintenance(db: Database.Database, monitorId: string, maintenanceId: string) {
  const rows = db.prepare(`
    SELECT affected_monitors
    FROM maintenance_windows
    WHERE status = 'in_progress' AND id != ?
  `).all(maintenanceId) as Array<{ affected_monitors: string }>;

  return rows.some(row => parseJsonArray(row.affected_monitors).includes(monitorId));
}

export function startMaintenanceWindow(db: Database.Database, row: MaintenanceRow, now: number) {
  const monitorIds = affectedMonitorIds(row);

  db.prepare(`
    UPDATE maintenance_windows
    SET actual_start = COALESCE(actual_start, ?), status = 'in_progress', updated_at = unixepoch()
    WHERE id = ?
  `).run(now, row.id);

  updateMonitorStatuses(db, monitorIds, 'maintenance');
}

export function completeMaintenanceWindow(db: Database.Database, row: MaintenanceRow, now: number) {
  const monitorIds = affectedMonitorIds(row);

  db.prepare(`
    UPDATE maintenance_windows
    SET actual_start = COALESCE(actual_start, ?),
        actual_end = COALESCE(actual_end, ?),
        status = 'completed',
        updated_at = unixepoch()
    WHERE id = ?
  `).run(row.scheduled_start, now, row.id);

  for (const monitorId of monitorIds) {
    if (hasOtherActiveMaintenance(db, monitorId, row.id)) continue;

    db.prepare(`
      UPDATE monitors
      SET status = ?, updated_at = unixepoch()
      WHERE id = ? AND enabled = 1
    `).run(latestRealMonitorStatus(db, monitorId), monitorId);
  }
}

export function syncInProgressMaintenanceMonitors(
  db: Database.Database,
  previous: MaintenanceRow,
  next: MaintenanceRow
) {
  if (next.status !== 'in_progress') return;

  const previousIds = affectedMonitorIds(previous);
  const nextIds = affectedMonitorIds(next);
  const addedIds = nextIds.filter(id => !previousIds.includes(id));
  const removedIds = previousIds.filter(id => !nextIds.includes(id));

  updateMonitorStatuses(db, addedIds, 'maintenance');

  for (const monitorId of removedIds) {
    if (hasOtherActiveMaintenance(db, monitorId, next.id)) continue;

    db.prepare(`
      UPDATE monitors
      SET status = ?, updated_at = unixepoch()
      WHERE id = ? AND enabled = 1
    `).run(latestRealMonitorStatus(db, monitorId), monitorId);
  }
}

export function applyMaintenanceTransitions(db: Database.Database, now = Math.floor(Date.now() / 1000)) {
  if (!tableExists(db, 'maintenance_windows')) return;

  const tx = db.transaction(() => {
    const expiredScheduled = db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE status = 'scheduled' AND scheduled_end <= ?
    `).all(now) as MaintenanceRow[];

    for (const row of expiredScheduled) {
      db.prepare(`
        UPDATE maintenance_windows
        SET actual_start = COALESCE(actual_start, scheduled_start),
            actual_end = COALESCE(actual_end, scheduled_end),
            status = 'completed',
            updated_at = unixepoch()
        WHERE id = ?
      `).run(row.id);
    }

    const dueToStart = db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE status = 'scheduled' AND scheduled_start <= ? AND scheduled_end > ?
    `).all(now, now) as MaintenanceRow[];

    for (const row of dueToStart) {
      startMaintenanceWindow(db, row, now);
    }

    const dueToComplete = db.prepare(`
      SELECT * FROM maintenance_windows
      WHERE status = 'in_progress' AND scheduled_end <= ?
    `).all(now) as MaintenanceRow[];

    for (const row of dueToComplete) {
      completeMaintenanceWindow(db, row, now);
    }
  });

  tx();
}
