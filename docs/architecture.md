# Architecture — WhatsApp Operations

## Data Flow

```
WhatsApp
   ↓
Wassenger
   ↓
n8n
   ↓
NestJS Backend
   ↓
PostgreSQL
   ↓
React Frontend
   ↓
CEO Operations Dashboard
```

Messages originate on WhatsApp, are captured by Wassenger, forwarded to n8n for
detection/orchestration, and persisted and processed as business state by the
NestJS backend into PostgreSQL. The React frontend reads that state through the
backend API to render the CEO Operations Dashboard.

## Layer Responsibilities

### Wassenger

- WhatsApp connectivity (session/device management).
- WhatsApp message retrieval (inbound webhook payloads).
- WhatsApp message sending (outbound notifications/reminders).
- Credentials live only in n8n/backend environment configuration — **never**
  in the frontend.

### n8n

- Receives the WhatsApp webhook from Wassenger.
- Normalizes raw WhatsApp payloads into a consistent internal message shape.
- Determines whether a message belongs to a monitored group.
- Detects mentions (keyword/tag based) and issue/problem messages.
- Runs SLA timers and checks whether a response has occurred within the SLA
  window.
- Sends WhatsApp notifications: team SLA reminders, CEO SLA alerts, EOD
  reminders.
- Talks to the NestJS backend's event endpoints (`/events/*`) to persist
  detected events and lifecycle transitions — n8n does not write to
  PostgreSQL directly.

### NestJS Backend

- Owns all application/business logic.
- Owns persistence (via TypeORM against PostgreSQL).
- Exposes the REST API consumed by the frontend and by n8n.
- Owns the issue lifecycle (`OPEN` → `IN_PROGRESS` → `RESOLVED`).
- Owns the SLA lifecycle (`OPEN` → `RESPONDED` | `MISSED` → `ESCALATED` →
  `RESOLVED`), kept independent of issue resolution state.
- Owns group configuration (monitored groups, SLA durations, keywords,
  responsible team members).
- Owns team configuration (team members, roles, responsibility mapping).
- Owns EOD state (submissions, lateness, missing reports).
- Owns dashboard aggregation (KPIs, summaries) so the frontend never computes
  business figures itself.
- Owns notification *intent/state* (`Notification` rows: PENDING → SENT |
  FAILED) — never the actual WhatsApp send. **NestJS never calls
  Wassenger and never sends a WhatsApp message.** See "Events / n8n
  Integration Boundary" below.
- Enforces idempotency using `message_id` so a WhatsApp message can never
  create duplicate issues or duplicate SLA incidents.
- Validates all inbound payloads (from both the frontend and n8n), and
  authenticates every n8n event request via a shared secret
  (`N8N_WEBHOOK_SHARED_SECRET`, header `X-N8N-Webhook-Secret`) — these
  endpoints are machine-to-machine, never publicly writable.

### EOD Domain (Phase 2D)

EOD tracks whether **INTERNAL** team members submitted their daily
end-of-day report — a domain independent of Issues and SLA.

- **Ownership**: the backend (`EodService`) is the sole source of truth
  for EOD status. It computes `ON_TIME`/`LATE` at submission time and
  derives `MISSING` on read — nothing about EOD state is ever decided
  client-side or by n8n.
- **Business timezone & deadline**: both the business date a submission
  belongs to and the submission deadline are computed from
  `BUSINESS_TIMEZONE` and `EOD_DEADLINE` (env config, defaults
  `Asia/Kolkata` / `19:00`) — never the server process's own timezone.
  Shared with the Issues/SLA date filters via
  `src/common/date/business-day.util.ts` and
  `src/common/config/business-config.util.ts`.
- **Missing derivation, not persistence**: a member who hasn't submitted
  is never written as a database row. `MISSING`/the response-only
  `PENDING` value are computed on every read from
  `(eligible members) − (submitted reports)`, so `eod_reports` stays pure
  submission history and no synthetic-row cleanup job is ever needed.
- **n8n responsibility**: n8n calls `POST /events/eod` (backed by
  `EodService.createFromEvent()`, Phase 2G) when a member posts their EOD
  message. The 7 PM reminder workflow itself — independently querying
  missing members and sending WhatsApp reminders through Wassenger — is a
  later phase; recording a sent/failed `EOD_REMINDER` would use the same
  `POST /events/notifications` state-transition endpoint SLA notifications
  already use (see "Events / n8n Integration Boundary" below).

### Dashboard Aggregation Layer (Phase 2E)

`GET /dashboard` (backed by `DashboardService`) is a **read-only
aggregation layer**, not a domain of its own — it owns no entity, no
table, and no business rule. It renders the CEO dashboard by:

1. Calling `IssuesService.findAll()`, `SlaService.findAll()`,
   `SlaService.summary()`, `EodService.summary()`, and
   `GroupsService.findAll()` — each already scoped to the requested
   business date by its own owning service.
2. Grouping the *results* of those calls by `groupId` in memory (never a
   second SQL join across domains) to build the per-group activity rows.

This means SLA compliance, EOD eligibility/deadline, and issue/SLA
status rules are computed in exactly one place each (their own domain
service) — the dashboard can never drift from `GET /sla/summary` or
`GET /eod/summary` because it returns their output directly rather than
recalculating it.

### Events / n8n Integration Boundary (Phase 2G)

The inbound path — `src/events/` (`EventsController`/`EventsService`) —
is a thin translation layer in front of the existing domain services. It
adds no business rule of its own:

```
WhatsApp → Wassenger → n8n → NestJS Events → Domain Services → PostgreSQL
```

n8n's own detection/timer/reply-check logic (mention detection, keyword
issue detection, SLA timers, reply checking) is unchanged — this
boundary is only the new call-out point where n8n reports what it
detected. Every route requires `X-N8N-Webhook-Secret`.

- `POST /events/issues` → `IssuesService.createFromEvent()`
- `POST /events/sla` → `SlaService.createFromEvent()`, but the caller
  never supplies `slaDeadline` — the backend computes it from
  `Group.slaMinutes`, so n8n's own timer can never persist a deadline
  that disagrees with the one actually enforced.
- `PATCH /events/sla/:messageId/responded` → `SlaService.respond()`
- `PATCH /events/sla/:messageId/missed` → `SlaService.miss()`
- `POST /events/eod` → `EodService.createFromEvent()`

All five are idempotent on `messageId` (or, for EOD, also on the
`(member, group, date)` composite) exactly as their Phase 2C/2D internal
contracts always were — the event boundary does not add a second
idempotency mechanism, it relies on the one the domain services already
enforce at the database level.

**Outbound notifications** are the mirror image — NestJS never pushes to
Wassenger; n8n pulls:

```
NestJS notification intent (PENDING) → n8n reads it → n8n → Wassenger → WhatsApp
                                                          ↓
                                        n8n reports outcome → POST /events/notifications
                                                          ↓
                                        NestJS updates that same row to SENT | FAILED
```

When `SlaService.miss()` fans out CEO/team `Notification` rows (Phase
2C, unchanged), `PATCH /events/sla/:messageId/missed`'s response includes
those rows — recipient phone, the human-readable group name already
resolved into the message text, and the notification id — so n8n never
reconstructs business state itself. A duplicate/idempotent `missed` call
returns an empty `notifications` array specifically so a replayed webhook
can never cause n8n to re-send the same WhatsApp message.
`POST /events/notifications` then transitions that same row's `status`
(PENDING → SENT/FAILED) — it never creates a second `Notification`,
which is what keeps this a bounded state machine instead of an
ever-growing loop of rows for the same underlying event.

### Wiring the existing n8n workflow to this boundary

This repository has no n8n workflow file, so the existing workflow's
exact current node structure was not available to inspect or rebuild —
per the phase's explicit instruction, it was not guessed at. Its
described branches (webhook → normalize → monitored-group check → group
type → mention detection → mention SLA; and, on no-mention, message/issue
detection → message SLA; plus reply checking and reminder sending) are
**unchanged**. Add one HTTP Request node at each of these existing
points, each sending header `X-N8N-Webhook-Secret: {{ $env.N8N_WEBHOOK_SHARED_SECRET }}`
(see full request/response bodies in `docs/api-contract.md` → "n8n
Events"):

| Existing branch                                    | Add HTTP Request node calling |
| ---------------------------------------------------- | -------------------------------- |
| Message/issue detected (CLIENT groups)               | `POST /events/issues`, then `POST /events/sla` (`triggerType: MESSAGE`, `issueId` from the first call's response) |
| Mention detected (INTERNAL groups)                    | `POST /events/sla` (`triggerType: MENTION`, no `issueId`) |
| Reply detected within the existing reply-check branch | `PATCH /events/sla/:messageId/responded` |
| SLA timer fires with no reply detected                | `PATCH /events/sla/:messageId/missed`, then send WhatsApp to each entry in the response's `notifications[]` via the existing Wassenger send node, then `POST /events/notifications` per attempt |
| EOD message received (existing branch, if present)    | `POST /events/eod` |
| Reminder workflow, once built                         | Send WhatsApp via Wassenger, then `POST /events/notifications` |

The SLA timer's production duration is a configuration value on the
existing n8n timer node, not something this phase changed — whatever
duration n8n waits before firing its "missed" check, the *persisted*
deadline it will be compared against always comes from the backend's own
`POST /events/sla` response (`Group.slaMinutes`), never from n8n
recalculating one itself.

### PostgreSQL

- The single source of truth for all persistent application state: groups,
  team members, issues, SLA incidents, EOD reports, notifications, keywords.
- Accessed only by the NestJS backend (via TypeORM).

### React Frontend

- Renders the CEO Operations Dashboard and all operational UI (Dashboard,
  Groups, SLA, Issues, EOD).
- Consumes the NestJS backend REST API exclusively.
- Has no direct database access.
- Has no direct Wassenger access and never handles Wassenger credentials.
- Contains no business logic — display, filtering, and navigation only;
  computed figures (SLA compliance, elapsed time, etc.) are served by the
  backend.

## Governing Rule

**The backend is the source of business logic, and PostgreSQL is the source
of truth.** n8n orchestrates WhatsApp-side automation and calls into the
backend to record what happened; it does not independently decide or persist
business state. The frontend only ever reads/writes through the backend API.

## Non-Goals (v1)

- No microservices split — the backend is a single modular NestJS
  application.
- No Kubernetes.
- No Redis, unless a future requirement explicitly requires it (e.g.
  distributed job scheduling at scale).
