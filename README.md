<h1 align="center">SLA Monitor</h1>

<p align="center">
  <strong>Self-hosted uptime monitoring, incident registry, SLA reporting, and public status pages</strong>
</p>

<p align="center">
  <a href="https://github.com/adminsyspro/sla-monitor/actions/workflows/docker-publish.yml"><img src="https://github.com/adminsyspro/sla-monitor/actions/workflows/docker-publish.yml/badge.svg" alt="Docker build"></a>
</p>

---

## Overview

**SLA Monitor** is a self-hosted monitoring platform for tracking service availability, incidents, maintenance windows, and SLA targets from a single web interface.

It includes a Next.js web application backed by SQLite and a separate prober service that performs HTTP, TCP, Ping, DNS, and SSL checks. The application can automatically create and resolve incidents from monitor failures, publish a customizable status page, schedule maintenance windows, and generate SLA reports.

Use it as:

- An internal uptime and SLA dashboard.
- A lightweight incident registry with root cause context and related incident links.
- A public status page for users and stakeholders.
- A scheduled maintenance planner connected to monitor status.
- A Docker-friendly monitoring stack with a separate polling worker.

---

## Quick Start

```bash
git clone https://github.com/adminsyspro/sla-monitor.git
cd sla-monitor
cp .env.example .env
```

Edit `.env` and set unique values:

```bash
openssl rand -hex 32
```

Then start the stack:

```bash
docker compose up --build -d
```

Open `http://localhost:3000`.

Default local credentials are created on first startup:

```text
username: admin
password: admin
```

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Global uptime, incident, monitor, response time, and maintenance widgets |
| **Monitors** | HTTP, TCP, Ping, DNS, and SSL monitors with configurable intervals |
| **Automatic Incidents** | System incidents are created when monitors fail and resolved when they recover |
| **Incident Registry** | Track root cause, impact, resolution, preventive actions, related incidents, and timeline updates |
| **Maintenance Windows** | Schedule maintenance for selected monitors; affected monitors enter maintenance status automatically |
| **SLA Targets** | Define SLA objectives, monitor groups, periods, and maintenance exclusion rules |
| **SLA Reports** | Generate reports, inspect details, choose custom periods, and export styled PDFs |
| **Status Page** | Public page with service groups, incident details, maintenance windows, uptime history, and per-monitor timelines |
| **Customization** | Configure status page branding, colors, messages, layout radius, and footer |
| **LDAP Authentication** | Optional LDAP / Active Directory login with group-to-role mapping |
| **Local Users** | Built-in local authentication, roles, and pending LDAP user approval |
| **Data Retention** | Configurable retention for monitor check history |
| **Docker Ready** | Web and prober images with healthchecks and persistent SQLite storage |

---

## Architecture

```text
┌──────────────┐          internal HTTP           ┌──────────────┐
│    Prober    │ ───────────────────────────────▶ │   Web App    │
│ Python async │                                  │ Next.js API  │
└──────────────┘                                  └──────┬───────┘
        ▲                                                │
        │                                                ▼
        │                                         ┌──────────────┐
        └──────── monitor checks ─────────────── │   SQLite     │
                                                  │ /app/data    │
                                                  └──────────────┘
```

The web application owns the database and exposes internal endpoints for the prober:

- `GET /api/internal/monitors-due`
- `POST /api/internal/checks`
- `POST /api/internal/cleanup`

The prober authenticates with `PROBER_TOKEN` and reports check results back to the web application.

---

## Docker Compose

The recommended deployment is Docker Compose:

```bash
cp .env.example .env
docker compose up --build -d
```

Inspect the stack:

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f prober
```

Stop the stack:

```bash
docker compose down
```

The SQLite database is persisted in the named Docker volume:

```text
sla-monitor-data
```

To remove all data:

```bash
docker compose down -v
```

### Published Images

The GitHub Actions workflow publishes two images to GHCR:

| Image | Description |
|---|---|
| `ghcr.io/adminsyspro/sla-monitor:latest` | Next.js web application |
| `ghcr.io/adminsyspro/sla-monitor-prober:latest` | Python probing service |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AUTH_SECRET` | required | Session signing secret and encryption key source for stored secrets |
| `PROBER_TOKEN` | required | Shared token used by the prober to call internal API endpoints |
| `DATABASE_URL` | `file:/app/data/sla-monitor.db` | SQLite database location |
| `FORCE_HTTPS` | `false` | Set secure cookies when the app is served over HTTPS |
| `POLL_INTERVAL_SECONDS` | `5` | Prober polling interval |
| `MAX_CONCURRENT_CHECKS` | `50` | Maximum concurrent checks run by the prober |
| `CLEANUP_INTERVAL_SECONDS` | `3600` | Prober-triggered cleanup interval |
| `LOG_LEVEL` | `INFO` | Prober log level |

Generate secrets with:

```bash
openssl rand -hex 32
```

### Ping Monitors

The Compose stack sets:

```yaml
sysctls:
  net.ipv4.ping_group_range: "0 2147483647"
```

This allows the prober to run unprivileged ICMP checks. If your runtime does not allow this sysctl, Ping monitors may require additional container capabilities or host-level configuration.

---

## Status Page

The public status page is available at:

```text
/status-page
```

Administrators configure it from:

```text
/status
```

It supports:

- Service groups and ungrouped services.
- Current overall status.
- Custom operational/degraded/maintenance/outage messages.
- Branding, colors, card radius, logo, and footer text.
- Aggregate uptime history for `24h`, `7d`, `30d`, `90d`, and `1y`.
- Per-monitor uptime timelines.
- Incident details and update history.
- Upcoming and active maintenance windows.

---

## Incidents

Incidents can be managed manually or created automatically from monitor failures.

Automatic behavior:

- A failing monitor creates one active system incident per monitor.
- Repeated failures update the existing active incident instead of creating duplicates.
- When the monitor recovers, the system incident is marked `resolved`.
- Manual incidents are not auto-resolved by monitor recovery.

Incident registry fields include:

- Root cause.
- Impact.
- Resolution.
- Preventive actions.
- Owner and tags.
- Related incidents.
- Timeline updates.

---

## Maintenance Windows

Maintenance windows can be created from:

```text
/maintenance
```

When a maintenance window starts:

- Selected monitors move to `maintenance`.
- Monitor checks continue to be stored.
- The visible monitor status remains protected from check updates during maintenance.

When a maintenance window completes:

- Each affected monitor is restored to its latest real check status.
- If no real check exists, the monitor falls back to `unknown`.

Maintenance transitions are applied by the web APIs and by the prober polling flow, so scheduled windows progress automatically while the stack is running.

---

## SLA Reports

SLA reports are available at:

```text
/reports
```

They support:

- Predefined and custom periods.
- Detail views.
- Error budget display.
- Styled PDF export.
- Direct PDF download without opening the print dialog.

SLA targets are managed from:

```text
/sla-targets
```

---

## Authentication

### Local Authentication

A default local administrator is created only when the user table is empty:

```text
admin / admin
```

Change this password after first login.

### LDAP Authentication

LDAP / Active Directory can be configured by administrators from:

```text
/settings
```

Current LDAP support includes:

- LDAP URL and Base DN.
- Optional bind DN and bind password.
- User search filter with `{{username}}`.
- Role mapping through LDAP groups.
- Automatic user provisioning.
- Pending approval for newly provisioned LDAP users.

Limitations:

- No connection test button yet.
- Group discovery relies on the `memberOf` attribute.
- User attributes are currently fixed to common LDAP / AD fields.
- Changing `AUTH_SECRET` after saving LDAP settings can make encrypted bind passwords unusable.

---

## Development

Install dependencies:

```bash
npm install
```

Run the web application:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build locally:

```bash
npm run build
```

Run the prober in development:

```bash
cd prober
pip install -e ".[dev]"
PROBER_TOKEN=your-token NEXT_INTERNAL_URL=http://localhost:3000 python -m prober
```

---

## CI

GitHub Actions builds and publishes both Docker images:

```text
.github/workflows/docker-publish.yml
```

Behavior:

- Pull requests: build only.
- Push to `main`: build and publish `latest` and branch tags.
- Tags `v*`: build and publish semantic version tags.
- Manual workflow dispatch: optional custom version tag.

---

## Requirements

- Docker and Docker Compose for deployment.
- Node.js 20 for local development.
- Python 3.10+ for local prober development.

---

## License

MIT

## Support

- [GitHub Issues](https://github.com/adminsyspro/sla-monitor/issues)
