import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { seedDefaultAdmin } from '@/lib/auth/seed';

let db: Database.Database | null = null;

function resolveDbPath(): string {
  const configured = process.env.DATABASE_URL || process.env.SQLITE_PATH;
  if (!configured) return path.join(process.cwd(), 'data', 'sla-monitor.db');

  const rawPath = configured.startsWith('file:') ? configured.slice('file:'.length) : configured;
  const normalizedPath = rawPath.replace(/^\/\/+/, '/');
  return path.isAbsolute(normalizedPath)
    ? normalizedPath
    : path.join(process.cwd(), normalizedPath);
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Users & Settings (auth system)
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      username        TEXT NOT NULL UNIQUE,
      email           TEXT NOT NULL,
      firstname       TEXT DEFAULT '',
      lastname        TEXT DEFAULT '',
      role            TEXT NOT NULL DEFAULT 'User' CHECK(role IN ('Administrator','Operator','User')),
      active          INTEGER NOT NULL DEFAULT 1,
      password_hash   TEXT DEFAULT NULL,
      avatar          TEXT DEFAULT NULL,
      auth_type       TEXT NOT NULL DEFAULT 'local' CHECK(auth_type IN ('local','ldap')),
      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Monitor Groups
    CREATE TABLE IF NOT EXISTS monitor_groups (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Monitors
    CREATE TABLE IF NOT EXISTS monitors (
      id                         TEXT PRIMARY KEY,
      name                       TEXT NOT NULL,
      url                        TEXT NOT NULL,
      type                       TEXT NOT NULL CHECK(type IN ('http','tcp','ping','dns','ssl')),
      interval_seconds           INTEGER NOT NULL DEFAULT 60,
      timeout_ms                 INTEGER NOT NULL DEFAULT 10000,
      status                     TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('operational','degraded','partial','major','maintenance','unknown')),
      enabled                    INTEGER NOT NULL DEFAULT 1,
      group_id                   TEXT REFERENCES monitor_groups(id) ON DELETE SET NULL,
      tags                       TEXT DEFAULT '[]',
      expected_status_code       INTEGER DEFAULT NULL,
      port                       INTEGER DEFAULT NULL,
      check_certificate          INTEGER DEFAULT NULL,
      certificate_expiry_warning INTEGER DEFAULT NULL,
      created_by                 TEXT NOT NULL DEFAULT 'system',
      created_at                 INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at                 INTEGER NOT NULL DEFAULT (unixepoch()),
      last_check_at              INTEGER DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_monitors_group ON monitors(group_id);
    CREATE INDEX IF NOT EXISTS idx_monitors_status ON monitors(status);
    CREATE INDEX IF NOT EXISTS idx_monitors_due ON monitors(enabled, last_check_at);

    -- Monitor Checks (health check results)
    CREATE TABLE IF NOT EXISTS monitor_checks (
      id            TEXT PRIMARY KEY,
      monitor_id    TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      timestamp     INTEGER NOT NULL DEFAULT (unixepoch()),
      status        TEXT NOT NULL CHECK(status IN ('operational','degraded','partial','major','maintenance','unknown')),
      response_time INTEGER DEFAULT NULL,
      status_code   INTEGER DEFAULT NULL,
      error         TEXT DEFAULT NULL,
      region        TEXT DEFAULT NULL,
      metadata      TEXT DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_checks_monitor_ts ON monitor_checks(monitor_id, timestamp DESC);

    -- Incidents
    CREATE TABLE IF NOT EXISTS incidents (
      id                TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'investigating' CHECK(status IN ('investigating','identified','monitoring','resolved')),
      severity          TEXT NOT NULL DEFAULT 'minor' CHECK(severity IN ('minor','major','critical')),
      affected_monitors TEXT DEFAULT '[]',
      started_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      resolved_at       INTEGER DEFAULT NULL,
      root_cause        TEXT DEFAULT NULL,
      postmortem        TEXT DEFAULT NULL,
      impact            TEXT DEFAULT '',
      resolution        TEXT DEFAULT '',
      preventive_actions TEXT DEFAULT '',
      owner             TEXT DEFAULT '',
      tags              TEXT DEFAULT '[]',
      created_by        TEXT NOT NULL DEFAULT 'system',
      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

    -- Incident relationships used for root cause correlation
    CREATE TABLE IF NOT EXISTS incident_links (
      id                 TEXT PRIMARY KEY,
      source_incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      target_incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      relation_type      TEXT NOT NULL DEFAULT 'related',
      created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(source_incident_id, target_incident_id)
    );
    CREATE INDEX IF NOT EXISTS idx_incident_links_source ON incident_links(source_incident_id);
    CREATE INDEX IF NOT EXISTS idx_incident_links_target ON incident_links(target_incident_id);

    -- Incident Timeline Updates
    CREATE TABLE IF NOT EXISTS incident_updates (
      id          TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      status      TEXT NOT NULL CHECK(status IN ('investigating','identified','monitoring','resolved')),
      message     TEXT NOT NULL,
      created_by  TEXT NOT NULL DEFAULT 'system',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id, created_at ASC);

    -- Maintenance Windows
    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id                TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      description       TEXT DEFAULT '',
      affected_monitors TEXT DEFAULT '[]',
      scheduled_start   INTEGER NOT NULL,
      scheduled_end     INTEGER NOT NULL,
      actual_start      INTEGER DEFAULT NULL,
      actual_end        INTEGER DEFAULT NULL,
      status            TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
      created_by        TEXT NOT NULL DEFAULT 'system',
      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_windows(status);

    -- SLA Targets
    CREATE TABLE IF NOT EXISTS sla_targets (
      id                          TEXT PRIMARY KEY,
      name                        TEXT NOT NULL,
      monitor_ids                 TEXT DEFAULT '[]',
      target_uptime               REAL NOT NULL DEFAULT 99.9,
      period                      TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly','quarterly','yearly')),
      exclude_maintenance_windows INTEGER NOT NULL DEFAULT 1,
      created_at                  INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at                  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Status Page Configuration (singleton)
    CREATE TABLE IF NOT EXISTS status_page_config (
      id                 TEXT PRIMARY KEY DEFAULT 'default',
      enabled            INTEGER NOT NULL DEFAULT 1,
      title              TEXT NOT NULL DEFAULT 'Status',
      description        TEXT DEFAULT '',
      subdomain          TEXT DEFAULT '',
      custom_domain      TEXT DEFAULT '',
      logo_url           TEXT DEFAULT '',
      theme              TEXT DEFAULT 'auto',
      accent_color       TEXT DEFAULT '#3b82f6',
      background_color   TEXT DEFAULT '#f8fafc',
      header_background  TEXT DEFAULT '#ffffff',
      header_text_color  TEXT DEFAULT '#0f172a',
      card_background    TEXT DEFAULT '#ffffff',
      border_radius      TEXT DEFAULT 'large',
      operational_message TEXT DEFAULT 'All systems are operational',
      degraded_message   TEXT DEFAULT 'Some systems are experiencing issues',
      major_message      TEXT DEFAULT 'Issues are affecting our services',
      maintenance_message TEXT DEFAULT 'Maintenance in progress',
      footer_text        TEXT DEFAULT '',
      show_uptime        INTEGER NOT NULL DEFAULT 1,
      show_response_time INTEGER NOT NULL DEFAULT 1,
      show_incidents     INTEGER NOT NULL DEFAULT 1,
      subscribers_enabled INTEGER NOT NULL DEFAULT 0,
      monitor_ids        TEXT DEFAULT '[]',
      updated_at         INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Idempotent migrations for existing databases
  const monitorsColumns = db.prepare('PRAGMA table_info(monitors)').all();
  const hasLastCheckAt = monitorsColumns.some((col: any) => col.name === 'last_check_at');
  if (!hasLastCheckAt) {
    db.prepare('ALTER TABLE monitors ADD COLUMN last_check_at INTEGER DEFAULT NULL').run();
  }
  db.prepare('CREATE INDEX IF NOT EXISTS idx_monitors_due ON monitors(enabled, last_check_at)').run();

  const checksColumns = db.prepare('PRAGMA table_info(monitor_checks)').all();
  const hasMetadata = checksColumns.some((col: any) => col.name === 'metadata');
  if (!hasMetadata) {
    db.prepare('ALTER TABLE monitor_checks ADD COLUMN metadata TEXT DEFAULT \'{}\'').run();
  }

  const incidentColumns = db.prepare('PRAGMA table_info(incidents)').all();
  const hasIncidentColumn = (name: string) => incidentColumns.some((col: any) => col.name === name);
  if (!hasIncidentColumn('impact')) {
    db.prepare("ALTER TABLE incidents ADD COLUMN impact TEXT DEFAULT ''").run();
  }
  if (!hasIncidentColumn('resolution')) {
    db.prepare("ALTER TABLE incidents ADD COLUMN resolution TEXT DEFAULT ''").run();
  }
  if (!hasIncidentColumn('preventive_actions')) {
    db.prepare("ALTER TABLE incidents ADD COLUMN preventive_actions TEXT DEFAULT ''").run();
  }
  if (!hasIncidentColumn('owner')) {
    db.prepare("ALTER TABLE incidents ADD COLUMN owner TEXT DEFAULT ''").run();
  }
  if (!hasIncidentColumn('tags')) {
    db.prepare("ALTER TABLE incidents ADD COLUMN tags TEXT DEFAULT '[]'").run();
  }

  const statusPageColumns = db.prepare('PRAGMA table_info(status_page_config)').all();
  const hasStatusPageColumn = (name: string) => statusPageColumns.some((col: any) => col.name === name);
  const addStatusPageColumn = (name: string, definition: string) => {
    if (!hasStatusPageColumn(name)) {
      db.prepare(`ALTER TABLE status_page_config ADD COLUMN ${name} ${definition}`).run();
    }
  };
  addStatusPageColumn('background_color', "TEXT DEFAULT '#f8fafc'");
  addStatusPageColumn('header_background', "TEXT DEFAULT '#ffffff'");
  addStatusPageColumn('header_text_color', "TEXT DEFAULT '#0f172a'");
  addStatusPageColumn('card_background', "TEXT DEFAULT '#ffffff'");
  addStatusPageColumn('border_radius', "TEXT DEFAULT 'large'");
  addStatusPageColumn('operational_message', "TEXT DEFAULT 'All systems are operational'");
  addStatusPageColumn('degraded_message', "TEXT DEFAULT 'Some systems are experiencing issues'");
  addStatusPageColumn('major_message', "TEXT DEFAULT 'Issues are affecting our services'");
  addStatusPageColumn('maintenance_message', "TEXT DEFAULT 'Maintenance in progress'");
  addStatusPageColumn('footer_text', "TEXT DEFAULT ''");

  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_links (
      id                 TEXT PRIMARY KEY,
      source_incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      target_incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
      relation_type      TEXT NOT NULL DEFAULT 'related',
      created_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(source_incident_id, target_incident_id)
    );
    CREATE INDEX IF NOT EXISTS idx_incident_links_source ON incident_links(source_incident_id);
    CREATE INDEX IF NOT EXISTS idx_incident_links_target ON incident_links(target_incident_id);
  `);

  seedDefaultAdmin(db);
}
