import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  applyMaintenanceTransitions,
  completeMaintenanceWindow,
  startMaintenanceWindow,
} from '@/lib/maintenance';

interface MaintenanceRow {
  id: string;
  affected_monitors: string;
  scheduled_start: number;
  scheduled_end: number;
  actual_start: number | null;
  actual_end: number | null;
  status: string;
}

let db: Database.Database;

function makeDb() {
  const nextDb = new Database(':memory:');
  nextDb.prepare(`
    CREATE TABLE monitors (
      id TEXT PRIMARY KEY,
      name TEXT,
      status TEXT,
      enabled INTEGER,
      updated_at INTEGER
    )
  `).run();
  nextDb.prepare(`
    CREATE TABLE monitor_checks (
      id TEXT PRIMARY KEY,
      monitor_id TEXT,
      timestamp INTEGER,
      status TEXT
    )
  `).run();
  nextDb.prepare(`
    CREATE TABLE maintenance_windows (
      id TEXT PRIMARY KEY,
      affected_monitors TEXT DEFAULT '[]',
      scheduled_start INTEGER NOT NULL,
      scheduled_end INTEGER NOT NULL,
      actual_start INTEGER DEFAULT NULL,
      actual_end INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      updated_at INTEGER
    )
  `).run();
  return nextDb;
}

function insertMonitor(id: string, status = 'operational') {
  db.prepare('INSERT INTO monitors (id, name, status, enabled, updated_at) VALUES (?, ?, ?, 1, 0)')
    .run(id, id, status);
}

function insertMaintenance(id: string, monitorIds: string[], start: number, end: number, status = 'scheduled') {
  db.prepare(`
    INSERT INTO maintenance_windows (id, affected_monitors, scheduled_start, scheduled_end, status, updated_at)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, JSON.stringify(monitorIds), start, end, status);
  return db.prepare('SELECT * FROM maintenance_windows WHERE id = ?').get(id) as MaintenanceRow;
}

describe('maintenance transitions', () => {
  beforeEach(() => {
    db = makeDb();
  });

  it('sets affected monitors to maintenance when a window starts', () => {
    insertMonitor('m1');
    const row = insertMaintenance('mw1', ['m1'], 100, 200);

    startMaintenanceWindow(db, row, 120);

    expect(db.prepare('SELECT status FROM monitors WHERE id = ?').get('m1')).toEqual({ status: 'maintenance' });
    expect(db.prepare('SELECT status, actual_start FROM maintenance_windows WHERE id = ?').get('mw1'))
      .toEqual({ status: 'in_progress', actual_start: 120 });
  });

  it('restores the latest real monitor status when a window completes', () => {
    insertMonitor('m1', 'maintenance');
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
      .run('c1', 'm1', 150, 'degraded');
    const row = insertMaintenance('mw1', ['m1'], 100, 200, 'in_progress');

    completeMaintenanceWindow(db, row, 210);

    expect(db.prepare('SELECT status FROM monitors WHERE id = ?').get('m1')).toEqual({ status: 'degraded' });
    expect(db.prepare('SELECT status, actual_end FROM maintenance_windows WHERE id = ?').get('mw1'))
      .toEqual({ status: 'completed', actual_end: 210 });
  });

  it('automatically starts due windows and completes expired windows', () => {
    insertMonitor('m1');
    insertMonitor('m2', 'maintenance');
    db.prepare('INSERT INTO monitor_checks (id, monitor_id, timestamp, status) VALUES (?, ?, ?, ?)')
      .run('c1', 'm2', 250, 'operational');
    insertMaintenance('mw1', ['m1'], 100, 300, 'scheduled');
    insertMaintenance('mw2', ['m2'], 100, 200, 'in_progress');

    applyMaintenanceTransitions(db, 250);

    expect(db.prepare('SELECT status FROM monitors WHERE id = ?').get('m1')).toEqual({ status: 'maintenance' });
    expect(db.prepare('SELECT status FROM monitors WHERE id = ?').get('m2')).toEqual({ status: 'operational' });
    expect(db.prepare('SELECT status FROM maintenance_windows WHERE id = ?').get('mw1')).toEqual({ status: 'in_progress' });
    expect(db.prepare('SELECT status FROM maintenance_windows WHERE id = ?').get('mw2')).toEqual({ status: 'completed' });
  });
});
