# SLA Monitor

Plateforme de surveillance de disponibilité et de suivi SLA pour vos applications et services.

## Fonctionnalités

### MVP (Phase 1)
- ✅ Dashboard avec vue d'ensemble
- ✅ Gestion des monitors (HTTP, TCP, Ping, DNS, SSL)
- ✅ Barre d'uptime sur 90 jours
- ✅ Gestion des incidents avec timeline
- ✅ Rapports SLA mensuels/trimestriels/annuels
- ✅ Calcul du budget d'erreur
- ✅ Interface responsive avec thème clair/sombre

### Phase 2 (À venir)
- [ ] Backend Go avec API REST
- [ ] Sondes de monitoring distribuées
- [ ] Alertes (Email, Slack, Webhook)
- [ ] Page de statut publique
- [ ] Authentification LDAP
- [ ] Export PDF des rapports

### Phase 3 (Futur)
- [ ] Maintenance planifiée
- [ ] Multi-tenant
- [ ] SLA personnalisés par client
- [ ] Intégrations (PagerDuty, OpsGenie, etc.)

## Stack Technique

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Langage**: TypeScript
- **Styling**: Tailwind CSS
- **Composants**: Shadcn UI (Radix primitives)
- **State**: Zustand
- **Formulaires**: React Hook Form + Zod
- **Tableaux**: TanStack Table
- **Graphiques**: Recharts

### Backend (Phase 2)
- **Langage**: Go
- **Base de données**: SQLite (MVP) / PostgreSQL + TimescaleDB (production)
- **Cache**: Redis (optionnel)

## Installation

```bash
# Cloner le repo
git clone https://github.com/your-org/sla-monitor.git
cd sla-monitor

# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build production
npm run build
npm start
```

## Running with Docker Compose

```bash
cp .env.example .env
# Edit .env to set PROBER_TOKEN and NEXTAUTH_SECRET
# (use: openssl rand -hex 32)
docker compose up --build
```

The web UI is at `http://localhost:3000`. The prober runs in the background and starts checking your monitors at their configured intervals.

## Structure du projet

```
src/
├── app/                    # App Router (pages)
│   ├── (dashboard)/       # Layout avec sidebar
│   │   ├── dashboard/     # Page principale
│   │   ├── monitors/      # Gestion des monitors
│   │   ├── incidents/     # Gestion des incidents
│   │   ├── reports/       # Rapports SLA
│   │   └── settings/      # Paramètres
│   ├── globals.css        # Styles globaux
│   └── layout.tsx         # Layout racine
├── components/
│   ├── ui/                # Composants Shadcn
│   ├── layout/            # Sidebar, Header
│   ├── charts/            # Graphiques
│   ├── monitors/          # Composants monitors
│   └── incidents/         # Composants incidents
├── lib/
│   └── utils.ts           # Utilitaires
├── stores/
│   └── app-store.ts       # State Zustand
└── types/
    └── index.ts           # Types TypeScript
```

## Concepts clés

### Statuts des monitors
- **Operational**: Service fonctionnel (uptime 100%)
- **Degraded**: Temps de réponse élevé ou erreurs intermittentes
- **Partial**: Panne partielle affectant certaines fonctionnalités
- **Major**: Panne majeure, service indisponible
- **Maintenance**: Maintenance planifiée

### Calcul SLA
- **Uptime** = (Temps total - Temps d'indisponibilité) / Temps total × 100
- **Budget d'erreur** = 100% - Objectif SLA (ex: 0.1% pour un SLA 99.9%)
- **MTTR** (Mean Time To Repair) = Durée moyenne de résolution des incidents

### Objectifs SLA typiques
| SLA | Indisponibilité/mois | Indisponibilité/an |
|-----|---------------------|-------------------|
| 99.9% | 43 minutes | 8.7 heures |
| 99.95% | 22 minutes | 4.4 heures |
| 99.99% | 4.3 minutes | 52 minutes |

## Configuration

### Variables d'environnement

```env
# Base de données
DATABASE_URL=file:./data/sla-monitor.db

# API Backend (Phase 2)
API_URL=http://localhost:8080

# Authentification (Phase 2)
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

## Licence

MIT
