import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { parseJsonArray } from '@/lib/api-helpers';

interface ConfigRow {
  id: string; enabled: number; title: string; description: string;
  subdomain: string; custom_domain: string; logo_url: string;
  theme: string; accent_color: string; show_uptime: number;
  show_response_time: number; show_incidents: number;
  subscribers_enabled: number; monitor_ids: string; updated_at: number;
}

function toResponse(row: ConfigRow) {
  return {
    enabled: row.enabled === 1, title: row.title, description: row.description,
    subdomain: row.subdomain, customDomain: row.custom_domain,
    logoUrl: row.logo_url, theme: row.theme, accentColor: row.accent_color,
    showUptime: row.show_uptime === 1, showResponseTime: row.show_response_time === 1,
    showIncidents: row.show_incidents === 1,
    subscribersEnabled: row.subscribers_enabled === 1,
    monitorIds: parseJsonArray(row.monitor_ids),
  };
}

export async function GET() {
  const db = getDb();
  let row = db.prepare("SELECT * FROM status_page_config WHERE id = 'default'").get() as ConfigRow | undefined;
  if (!row) {
    db.prepare("INSERT INTO status_page_config (id) VALUES ('default')").run();
    row = db.prepare("SELECT * FROM status_page_config WHERE id = 'default'").get() as ConfigRow;
  }
  return NextResponse.json(toResponse(row));
}

export async function PUT(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (role !== 'Administrator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const db = getDb();

  db.prepare(`
    INSERT INTO status_page_config (id, enabled, title, description, subdomain, custom_domain, logo_url, theme, accent_color, show_uptime, show_response_time, show_incidents, subscribers_enabled, monitor_ids, updated_at)
    VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled, title = excluded.title, description = excluded.description,
      subdomain = excluded.subdomain, custom_domain = excluded.custom_domain,
      logo_url = excluded.logo_url, theme = excluded.theme, accent_color = excluded.accent_color,
      show_uptime = excluded.show_uptime, show_response_time = excluded.show_response_time,
      show_incidents = excluded.show_incidents, subscribers_enabled = excluded.subscribers_enabled,
      monitor_ids = excluded.monitor_ids, updated_at = unixepoch()
  `).run(
    body.enabled ? 1 : 0, body.title || 'Status', body.description || '',
    body.subdomain || '', body.customDomain || '', body.logoUrl || '',
    body.theme || 'auto', body.accentColor || '#3b82f6',
    body.showUptime !== false ? 1 : 0, body.showResponseTime !== false ? 1 : 0,
    body.showIncidents !== false ? 1 : 0, body.subscribersEnabled ? 1 : 0,
    JSON.stringify(body.monitorIds || [])
  );

  return NextResponse.json({ success: true });
}
