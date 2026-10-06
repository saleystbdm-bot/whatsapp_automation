# WhatsApp Operations

A CEO operations dashboard that monitors selected WhatsApp groups (via
Wassenger + n8n), detects mentions and issues, tracks response SLAs,
escalates missed SLAs, tracks issue lifecycle, and monitors internal team
end-of-day (EOD) reports.

See [`docs/architecture.md`](docs/architecture.md) for the full architecture,
[`docs/product-requirements.md`](docs/product-requirements.md) for product
scope, [`docs/ui-ux-spec.md`](docs/ui-ux-spec.md) for the UI spec, and
[`docs/api-contract.md`](docs/api-contract.md) for the API surface.

## Architecture

```
WhatsApp → Wassenger → n8n → NestJS Backend → PostgreSQL → React Frontend
```

- **Wassenger** — WhatsApp connectivity and message send/receive.
- **n8n** — webhook intake, detection, SLA timers, notifications.
- **Backend** (`apps/backend`, NestJS + TypeORM) — business logic, API,
  persistence.
- **Database** (PostgreSQL, via Docker Compose) — source of truth.
- **Frontend** (`apps/frontend`, React + Vite + TypeScript) — CEO dashboard
  UI, consumes the backend API only.

## Project Structure

```
apps/
  backend/     NestJS API (TypeScript, TypeORM, PostgreSQL)
  frontend/    React + Vite + TypeScript dashboard
docs/          Product, architecture, UI/UX, and API documentation
docker-compose.yml   Local PostgreSQL
.env.example         Environment variable template
```

## Prerequisites

- Node.js 20+ (developed against v22)
- npm 10+
- Docker (for local PostgreSQL)

## Setup

```bash
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Install dependencies
cd apps/backend && npm install
cd ../frontend && npm install
```

Vite only reads `.env` files from `apps/frontend/`, not the repo root, so
also create a frontend-local env file:

```bash
echo "VITE_API_BASE_URL=http://localhost:3000" > apps/frontend/.env
```

## Running

**Backend** (from `apps/backend`):

```bash
npm run start:dev
```

Runs on `http://localhost:3000` by default. Health check: `GET /health`.
Interactive API docs (Swagger/OpenAPI): `http://localhost:3000/api-docs`.

**Frontend** (from `apps/frontend`):

```bash
npm run dev
```

Runs on the Vite dev server (default `http://localhost:5173`), configured to
call the backend at `VITE_API_BASE_URL`.

## Database Migrations

Schema is owned entirely by TypeORM migrations under
`apps/backend/src/database/migrations` — `synchronize` is always `false`
(dev and production alike). Run these from `apps/backend`:

```bash
npm run migration:run       # apply all pending migrations
npm run migration:revert    # roll back the most recently applied migration
npm run migration:show      # list migrations and their applied state
npm run migration:generate  # generate a new migration from entity changes
```

## Seed Data (optional, development only)

```bash
npm run seed   # from apps/backend
```

Inserts a small set of example data (one internal group, one client group,
a few team members, their group memberships, and issue keywords) so the
API has something to query locally. Safe to re-run — every insert is
guarded by a lookup on the row's natural unique key, so it no-ops on rows
that already exist rather than erroring or duplicating them. Seeds are
kept out of migrations on purpose: migrations define schema only, never
environment-specific or example data.

## Testing & Quality

**Backend** (from `apps/backend`):

```bash
npm run lint
npm run build
npm test          # requires PostgreSQL running with migrations applied
npm run test:e2e  # requires PostgreSQL running with migrations applied
```

Backend tests are integration tests against a real PostgreSQL database
(the same one `docker-compose.yml` provisions), not mocks — they exercise
the actual constraints the migration creates (unique constraints, check
constraints, foreign keys). Run `npm run migration:run` first.

**Frontend** (from `apps/frontend`):

```bash
npm run lint
npm run build
```

## Environment Variables

See [`.env.example`](.env.example) for the full list, including database
connection settings, Wassenger/n8n integration secrets (used only by the
backend/n8n — never the frontend), business rule configuration (timezone,
EOD deadline), and `FRONTEND_ORIGIN` (the origin the backend allows via CORS
— must match the frontend dev server's actual origin, default
`http://localhost:5173`).

**Canonical phone format:** all phone numbers are stored as E.164 with a
leading `+` and no other punctuation (e.g. `+919566831192`) — never
`919566831192` or a WhatsApp JID like `919566831192@c.us`. Enforced by a
database check constraint on every phone column. Stripping the WhatsApp
JID suffix and adding the `+` is the responsibility of the integration
layer that receives WhatsApp payloads (n8n, in a later phase), not the
backend.

## Status

This repository currently contains:

- **Project foundation** — frontend shell, five-page navigation, backend
  scaffold.
- **Database and domain foundation** — TypeORM entities, migrations for
  all 8 tables, domain modules/services for Groups, Team Members, Group
  Members, Keywords, Issues, SLA Incidents, EOD Reports, Notifications.
- **Groups + Team + Keywords APIs** — full REST CRUD for Groups, Group
  Membership, Team Members, and Keywords, with DTO validation, consistent
  error responses (400/404/409), and Swagger docs.
- **Issues + SLA APIs** — `GET/PATCH /issues`, `GET/PATCH /sla`,
  `GET /sla/summary`, with independent Issue/SLA state machines,
  idempotent event-facing creation (`createFromEvent`), and SLA-missed
  notification fan-out (CEO + team).
- **EOD API** — `GET /eod`, `GET /eod/summary`, `GET /eod/:param`
  (date-or-id), tracking INTERNAL-team daily submissions against
  `BUSINESS_TIMEZONE`/`EOD_DEADLINE`, with `MISSING`/`PENDING` computed
  on read rather than persisted.
- **Dashboard API** — `GET /dashboard`, a pure read-only aggregation of
  Issues/SLA/Groups/EOD into KPIs, Live Operations, SLA Performance,
  Group Activity, and EOD Snapshot — reuses each domain's own
  `summary()`/`findAll()` rather than recomputing any business rule. See
  [`docs/api-contract.md`](docs/api-contract.md) for the exact shapes.
- **Frontend↔backend wiring** — the frontend consumes the real backend API
  end-to-end (`apps/frontend/src/api/client.ts`, `src/data/repository.ts`,
  `src/data/adapters.ts`); `src/mock/*` fixtures remain in the tree but are
  no longer imported by any runtime code path.
- **n8n Event API** — `POST /events/issues`, `POST /events/sla`,
  `PATCH /events/sla/:messageId/responded`, `PATCH /events/sla/:messageId/missed`,
  `POST /events/eod`, `POST /events/notifications` (`src/events/`), guarded
  by a shared secret (`N8N_WEBHOOK_SHARED_SECRET`, header
  `X-N8N-Webhook-Secret`). Thin translation to the existing domain
  services — no business rule is duplicated here. NestJS never calls
  Wassenger or sends WhatsApp directly; see
  [`docs/architecture.md`](docs/architecture.md) "Events / n8n
  Integration Boundary".

Not yet implemented: the actual n8n workflow nodes that call these
endpoints (this repo has no n8n workflow file — see
[`docs/api-contract.md`](docs/api-contract.md) for the exact requests to
configure), Wassenger connectivity, and CEO/frontend-facing
authentication.
