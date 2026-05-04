import type Database from 'better-sqlite3';

export function seedDemoData(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM monitors').get() as { cnt: number };
  if (count.cnt > 0) return;

  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;
  const HOUR = 3600;

  // --- Monitor Groups ---
  const g1 = crypto.randomUUID();
  const g2 = crypto.randomUUID();
  db.prepare(`INSERT INTO monitor_groups (id, name, description, sort_order) VALUES (?, ?, ?, ?)`).run(g1, 'Production', 'Services de production critiques', 1);
  db.prepare(`INSERT INTO monitor_groups (id, name, description, sort_order) VALUES (?, ?, ?, ?)`).run(g2, 'Infrastructure', 'Composants infrastructure', 2);

  // --- Monitors ---
  const monitors = [
    { id: crypto.randomUUID(), name: 'API Production', url: 'https://api.example.com/health', type: 'http', interval: 60, timeout: 10000, status: 'operational', group: g1, tags: '["production","api"]', statusCode: 200 },
    { id: crypto.randomUUID(), name: 'Site Web Principal', url: 'https://www.example.com', type: 'http', interval: 60, timeout: 15000, status: 'operational', group: g1, tags: '["production","web"]', statusCode: 200 },
    { id: crypto.randomUUID(), name: 'Base de données', url: 'db.example.com', type: 'tcp', interval: 30, timeout: 5000, status: 'operational', group: g2, tags: '["production","database"]', port: 5432 },
    { id: crypto.randomUUID(), name: 'Service de paiement', url: 'https://payment.example.com/status', type: 'http', interval: 30, timeout: 10000, status: 'degraded', group: g1, tags: '["production","critical"]', statusCode: 200 },
    { id: crypto.randomUUID(), name: 'CDN Assets', url: 'https://cdn.example.com', type: 'http', interval: 120, timeout: 20000, status: 'operational', group: g2, tags: '["production","cdn"]', statusCode: 200 },
    { id: crypto.randomUUID(), name: 'Certificat SSL', url: 'https://www.example.com', type: 'ssl', interval: 3600, timeout: 10000, status: 'operational', group: g1, tags: '["security"]' },
  ];

  const insertMonitor = db.prepare(
    `INSERT INTO monitors (id, name, url, type, interval_seconds, timeout_ms, status, enabled, group_id, tags, expected_status_code, port, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'admin', ?, ?)`
  );

  for (const m of monitors) {
    const createdAt = now - 30 * DAY;
    insertMonitor.run(m.id, m.name, m.url, m.type, m.interval, m.timeout, m.status, m.group, m.tags, m.statusCode || null, m.port || null, createdAt, now);
  }

  // --- Monitor Checks (7 days of data, ~4 checks/hour per monitor) ---
  const insertCheck = db.prepare(
    `INSERT INTO monitor_checks (id, monitor_id, timestamp, status, response_time, status_code, region) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const regions = ['eu-west-1', 'eu-central-1', 'us-east-1', 'ca-central-1'];
  const insertChecks = db.transaction(() => {
    for (const m of monitors) {
      for (let t = now - 7 * DAY; t <= now; t += 900) { // every 15 min
        const rand = Math.random();
        let status: string;
        let responseTime: number;
        let statusCode: number | null = null;

        if (m.status === 'degraded' && rand < 0.08) {
          status = 'degraded';
          responseTime = 500 + Math.floor(Math.random() * 1500);
        } else if (rand < 0.01) {
          status = 'major';
          responseTime = 0;
        } else if (rand < 0.03) {
          status = 'degraded';
          responseTime = 300 + Math.floor(Math.random() * 700);
        } else {
          status = 'operational';
          responseTime = 30 + Math.floor(Math.random() * 200);
        }

        if (m.type === 'http') statusCode = status === 'major' ? 500 : 200;

        const region = regions[Math.floor(Math.random() * regions.length)];
        insertCheck.run(crypto.randomUUID(), m.id, t, status, responseTime, statusCode, region);
      }
    }
  });
  insertChecks();

  // --- Incidents ---
  const inc1 = crypto.randomUUID();
  const incStart = now - 6 * HOUR;
  db.prepare(
    `INSERT INTO incidents (id, title, status, severity, affected_monitors, started_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(inc1, 'Latence élevée sur le service de paiement', 'monitoring', 'minor', JSON.stringify([monitors[3].id]), incStart, 'system', incStart, now);

  const insertUpdate = db.prepare(
    `INSERT INTO incident_updates (id, incident_id, status, message, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertUpdate.run(crypto.randomUUID(), inc1, 'investigating', 'Nous avons détecté une latence élevée sur le service de paiement. Investigation en cours.', 'system', incStart + 300);
  insertUpdate.run(crypto.randomUUID(), inc1, 'identified', 'Le problème a été identifié comme une surcharge du pool de connexions.', 'admin', incStart + 900);
  insertUpdate.run(crypto.randomUUID(), inc1, 'monitoring', 'Correction déployée. Surveillance en cours pour confirmer la résolution.', 'admin', incStart + 1800);

  // Second incident (resolved)
  const inc2 = crypto.randomUUID();
  const inc2Start = now - 3 * DAY;
  db.prepare(
    `INSERT INTO incidents (id, title, status, severity, affected_monitors, started_at, resolved_at, root_cause, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(inc2, 'Interruption du CDN Europe', 'resolved', 'major', JSON.stringify([monitors[4].id]), inc2Start, inc2Start + 2 * HOUR, 'Panne réseau chez le fournisseur CDN', 'system', inc2Start, inc2Start + 2 * HOUR);

  insertUpdate.run(crypto.randomUUID(), inc2, 'investigating', 'Perte de connectivité détectée sur les noeuds CDN européens.', 'system', inc2Start + 120);
  insertUpdate.run(crypto.randomUUID(), inc2, 'identified', 'Incident confirmé chez le fournisseur CDN. Basculement sur les noeuds secondaires en cours.', 'admin', inc2Start + 1800);
  insertUpdate.run(crypto.randomUUID(), inc2, 'resolved', 'Service rétabli. Le fournisseur CDN a résolu le problème réseau.', 'admin', inc2Start + 2 * HOUR);

  // --- Maintenance Windows ---
  db.prepare(
    `INSERT INTO maintenance_windows (id, title, description, affected_monitors, scheduled_start, scheduled_end, actual_start, actual_end, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    'Mise à jour base de données',
    'Migration vers PostgreSQL 16 et optimisation des index',
    JSON.stringify([monitors[2].id]),
    now - 5 * DAY, now - 5 * DAY + 2 * HOUR,
    now - 5 * DAY + 300, now - 5 * DAY + HOUR + 2700,
    'completed', 'admin', now - 7 * DAY, now - 5 * DAY + HOUR + 2700
  );

  db.prepare(
    `INSERT INTO maintenance_windows (id, title, description, affected_monitors, scheduled_start, scheduled_end, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    'Renouvellement certificats SSL',
    'Renouvellement et déploiement des certificats SSL pour tous les domaines',
    JSON.stringify([monitors[5].id, monitors[1].id]),
    now + 2 * DAY, now + 2 * DAY + HOUR,
    'scheduled', 'admin', now - DAY, now - DAY
  );

  // --- SLA Targets ---
  db.prepare(
    `INSERT INTO sla_targets (id, name, monitor_ids, target_uptime, period, exclude_maintenance_windows, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    'SLA Production',
    JSON.stringify(monitors.slice(0, 4).map(m => m.id)),
    99.9, 'monthly', 1, now - 30 * DAY, now
  );

  db.prepare(
    `INSERT INTO sla_targets (id, name, monitor_ids, target_uptime, period, exclude_maintenance_windows, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    'SLA Infrastructure',
    JSON.stringify([monitors[2].id, monitors[4].id]),
    99.95, 'monthly', 1, now - 30 * DAY, now
  );

  // --- Status Page Config ---
  db.prepare(
    `INSERT OR IGNORE INTO status_page_config (id, enabled, title, description, theme, monitor_ids)
     VALUES ('default', 1, 'SLA Monitor - Status', 'État des services en temps réel', 'auto', ?)`
  ).run(JSON.stringify(monitors.map(m => m.id)));
}
