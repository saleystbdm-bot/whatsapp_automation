# API Contract — WhatsApp Operations

All endpoints are served by the backend under a single base URL (e.g.
`http://localhost:3000`). The frontend consumes these; n8n consumes the
`events` group; nothing else talks to the backend.

**Implementation status:** Groups, Team Members, Group Membership,
Keywords (Phase 2B), Issues, SLA (Phase 2C), EOD (Phase 2D), Dashboard
(Phase 2E), and n8n Events (Phase 2G) are implemented and documented in
full below — request/response shapes, status codes, and error cases all
reflect the actual code, not a proposal.

Issue, SLA, and EOD *creation* have no public POST endpoint for the
frontend — each
only happens through an internal service method
(`IssuesService.createFromEvent`, `SlaService.createFromEvent`,
`EodService.createFromEvent`) that the n8n event endpoints (listed under
n8n Events below) will call once that integration phase lands.

Interactive OpenAPI/Swagger docs are served at `/api-docs` (JSON at
`/api-docs-json`) whenever the backend is running — the source of truth
for exact schemas; this document is the narrative companion.

All endpoints validate the request body/query with a global
`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`:
unknown properties are rejected (400), not silently dropped.

## Groups

The `active` column is the single source of truth for "is this group
monitored" — there is no separate `monitoring_enabled` field.
`active = true` means monitored, `active = false` means not monitored.
A group is always created with `active = false`; monitoring is enabled
explicitly via `PATCH /groups/:id { "active": true }` (this is also what
the frontend's "Monitor"/"Remove" buttons call).

| Method | Path          | Purpose                                    |
| ------ | ------------- | ------------------------------------------- |
| GET    | `/groups`     | List groups (with members/keywords embedded). |
| GET    | `/groups/:id` | Get a single group, with members/keywords.  |
| POST   | `/groups`     | Create a group (always unmonitored).        |
| PATCH  | `/groups/:id` | Update a group; toggle monitoring via `active`. |
| DELETE | `/groups/:id` | Delete a group (only if it has no history). |

### GET /groups

Query parameters (all optional, combinable):

| Param    | Type                  | Effect                                                |
| -------- | --------------------- | ------------------------------------------------------ |
| `active` | `true` \| `false`     | Filter by monitoring status.                          |
| `type`   | `INTERNAL` \| `CLIENT`| Filter by group type.                                  |
| `search` | string                | Case-insensitive substring match on `name`.            |

Response `200`: `GroupResponse[]`, each:

```jsonc
{
  "id": "5f876799-4714-4475-b09d-620040a1f405",
  "whatsappGroupId": "120363414558473367@g.us",
  "name": "Test Whatsapp Automation",
  "type": "INTERNAL",
  "active": true,
  "slaMinutes": 30,
  "memberCount": 2,          // count of ACTIVE responsible team members
  "members": [
    {
      "id": "6250acba-...",       // group_members row id, not the team member id
      "memberId": "9456556a-...",
      "name": "Raj",
      "phone": "+919566800003",
      "role": "Engineer",
      "responsibility": "SECONDARY",
      "active": true
    }
  ],
  "keywords": [
    { "id": "e2b1...", "keyword": "payment", "active": true }
  ],
  "createdAt": "2026-09-22T10:00:00.000Z",
  "updatedAt": "2026-09-22T10:00:00.000Z"
}
```

`members`/`memberCount` reflect only *active* memberships (a deactivated
membership means that person is no longer responsible for the group);
`keywords` similarly only includes active keywords. This embedding means
the frontend never needs a second request to render the Groups drawer.

### GET /groups/:id

Same shape as one item above. `404` if the id doesn't exist.

### POST /groups

Request body:

```json
{
  "whatsappGroupId": "120363414558473367@g.us",
  "name": "Client ABC",
  "type": "CLIENT",
  "slaMinutes": 30
}
```

`active` is not an accepted field — sending it is rejected by
`forbidNonWhitelisted` (400). The created group is always `active: false`.

| Status | When                                              |
| ------ | -------------------------------------------------- |
| 201    | Created. Body: `GroupResponse` (empty members/keywords). |
| 400    | Missing/empty `name` or `whatsappGroupId`, invalid `type`, `slaMinutes <= 0` or not an integer, or an unknown field in the body. |
| 409    | `whatsappGroupId` already exists.                  |

### PATCH /groups/:id

Request body (all fields optional): `{ "name"?, "type"?, "slaMinutes"?, "active"? }`.

```json
{ "active": true }
```

means **enable monitoring** ("Monitor"); `{ "active": false }` means
**disable monitoring** ("Remove") — disabling monitoring never deletes or
touches historical Issues/SLA incidents/EOD reports.

| Status | When                          |
| ------ | ------------------------------ |
| 200    | Updated. Body: `GroupResponse`. |
| 400    | Invalid field value.           |
| 404    | Group not found.               |

### DELETE /groups/:id

Physically deletes the group. Only succeeds if nothing references it with
`ON DELETE RESTRICT` (Issues, SLA incidents, EOD reports — see
`docs/architecture.md`); group memberships and keywords, which are pure
config sub-resources, cascade-delete automatically.

| Status | When                                                        |
| ------ | ------------------------------------------------------------ |
| 204    | Deleted.                                                     |
| 404    | Group not found.                                              |
| 409    | Group has historical issues/SLA incidents/EOD reports. **Use `PATCH /groups/:id { "active": false }` instead** — this is the recommended way to stop monitoring a group without losing history. |

## Group Membership

Which team members are responsible for a group. `:memberId` in the
PATCH/DELETE routes is the **TeamMember id**, not the internal
`group_members` join-row id (the caller only ever knows the team member's
identity).

| Method | Path                                  | Purpose                          |
| ------ | -------------------------------------- | ---------------------------------- |
| GET    | `/groups/:groupId/members`             | List all memberships (incl. inactive). |
| POST   | `/groups/:groupId/members`             | Add a team member to a group.      |
| PATCH  | `/groups/:groupId/members/:memberId`   | Update responsibility/active status. |
| DELETE | `/groups/:groupId/members/:memberId`   | Remove a team member from a group. |

### POST /groups/:groupId/members

```json
{ "memberId": "9456556a-...", "responsibility": "PRIMARY" }
```

`responsibility` is free text (e.g. `PRIMARY`/`SECONDARY`/`SUPPORT`), not
an enum — deliberately, to avoid over-engineering roles this early.
`active` defaults to `true`.

| Status | When                                             |
| ------ | -------------------------------------------------- |
| 201    | Added. Body: membership object (see GET /groups/:id `members[]` shape above). |
| 400    | Invalid body (`memberId` not a UUID, etc).         |
| 404    | Group or team member not found.                    |
| 409    | This team member is already a member of this group. |

### PATCH /groups/:groupId/members/:memberId

Body: `{ "responsibility"?, "active"? }`. `404` if the group, team
member, or membership doesn't exist.

### DELETE /groups/:groupId/members/:memberId

`204` on success, `404` if no such membership exists.

## Keywords

Issue-detection keywords for a group. Stored lowercase/trimmed
(`"Payment"` → `"payment"`, `" API "` → `"api"`). Only one *active* row
may exist per `(group, keyword)` — enforced by a partial unique DB index
— so a deactivated keyword can always be re-added later.

| Method | Path                                     | Purpose                      |
| ------ | ------------------------------------------ | ------------------------------ |
| GET    | `/groups/:groupId/keywords`                | List all keywords (incl. inactive). |
| POST   | `/groups/:groupId/keywords`                | Add a keyword.                |
| PATCH  | `/groups/:groupId/keywords/:keywordId`     | Update text or (de)activate.  |
| DELETE | `/groups/:groupId/keywords/:keywordId`     | Delete a keyword.             |

### POST /groups/:groupId/keywords

```json
{ "keyword": "Payment" }
```

| Status | When                                                     |
| ------ | ----------------------------------------------------------- |
| 201    | Created. Body: `{ "id", "groupId", "keyword", "active" }`.   |
| 400    | Empty/whitespace-only keyword.                               |
| 404    | Group not found.                                              |
| 409    | An active keyword with this text already exists for the group. |

### PATCH /groups/:groupId/keywords/:keywordId

Body: `{ "keyword"?, "active"? }`. `404` if group or keyword not found;
`409` if the update would collide with another active keyword of the
same text in the same group.

### DELETE /groups/:groupId/keywords/:keywordId

`204` on success, `404` if the keyword doesn't exist for that group.

## Team Members

| Method | Path                | Purpose                        |
| ------ | -------------------- | --------------------------------- |
| GET    | `/team-members`      | List team members.                |
| GET    | `/team-members/:id`  | Get a single team member.         |
| POST   | `/team-members`      | Create a team member.             |
| PATCH  | `/team-members/:id`  | Update a team member.             |
| DELETE | `/team-members/:id`  | Delete a team member (only if no history). |

### GET /team-members

Query parameters (optional, combinable):

| Param    | Type              | Effect                                     |
| -------- | ------------------ | -------------------------------------------- |
| `active` | `true` \| `false`  | Filter by active status.                     |
| `search` | string              | Case-insensitive match on `name` **or** `phone`. |

Response `200`: array of

```json
{
  "id": "9456556a-...",
  "name": "Raj",
  "phone": "+919566800003",
  "role": "Engineer",
  "active": true,
  "createdAt": "2026-09-22T10:00:00.000Z",
  "updatedAt": "2026-09-22T10:00:00.000Z"
}
```

### POST /team-members

```json
{ "name": "Harish", "phone": "+919566831192", "role": "Developer" }
```

`phone` must be the canonical E.164 format (`+` followed by 7–15 digits,
no spaces/dashes/WhatsApp JID suffix — see `.env.example` /
`common/constants/phone.constant.ts`). `active` defaults to `true`.

| Status | When                                     |
| ------ | ------------------------------------------ |
| 201    | Created.                                    |
| 400    | Missing `name`, or `phone` not in E.164 format. |
| 409    | `phone` already in use by another team member. |

### PATCH /team-members/:id

Body (all optional): `{ "name"?, "phone"?, "role"?, "active"? }`. If
`phone` changes, it's re-validated as E.164 and re-checked for
uniqueness (`409` on collision). `404` if the id doesn't exist.

### DELETE /team-members/:id

Physically deletes the team member. EOD reports reference team members
with `ON DELETE RESTRICT`, so a member with historical EOD reports cannot
be deleted this way — group memberships (current, non-historical)
cascade-delete automatically.

| Status | When                                                            |
| ------ | ------------------------------------------------------------------ |
| 204    | Deleted.                                                            |
| 404    | Team member not found.                                              |
| 409    | Member has historical EOD reports. **Use `PATCH /team-members/:id { "active": false }` instead.** |

## Issues

**Issue status and SLA status are separate concepts and are never
merged.** Issue asks "is the problem fixed?" (`OPEN` → `IN_PROGRESS` →
`RESOLVED`); SLA asks "did someone respond in time?" (see the SLA section
below). A team responding to an SLA never changes Issue status, and
resolving an Issue never changes SLA status.

| Method | Path          | Purpose                                  |
| ------ | ------------- | ------------------------------------------ |
| GET    | `/issues`     | List issues (filterable), with groupName/groupType/SLA summary embedded. |
| GET    | `/issues/:id` | Get a single issue, with responsible team and timeline. |
| PATCH  | `/issues/:id` | Change issue status (controlled transitions only). |

There is no `POST /issues` — see the implementation-status note above.

### GET /issues

Query parameters (optional, combinable):

| Param       | Type                              | Effect                                         |
| ----------- | ---------------------------------- | ------------------------------------------------ |
| `status`    | `OPEN`\|`IN_PROGRESS`\|`RESOLVED`  | Filter by issue status.                          |
| `groupId`   | uuid                                | Filter by group.                                 |
| `groupType` | `INTERNAL`\|`CLIENT`               | Filter by group type.                            |
| `search`    | string                              | Case-insensitive substring match on `message`.   |
| `date`      | `YYYY-MM-DD`                        | Business-calendar date (`BUSINESS_TIMEZONE`), **not** a UTC calendar date — see Business Day Filtering below. |

Response `200`: array of

```jsonc
{
  "id": "...",
  "messageId": "wa-msg-123",
  "groupId": "...",
  "groupName": "Test Whatsapp Automation",   // resolved live from the current Group row — see note below
  "groupType": "INTERNAL",                    // snapshot from when the issue was reported
  "senderPhone": "+919566831192",
  "message": "Payment API is not working",
  "status": "OPEN",
  "createdAt": "2026-09-22T10:17:00.000Z",
  "updatedAt": "2026-09-22T10:17:00.000Z",
  "resolvedAt": null,
  "resolvedBy": null,
  "sla": {                                     // null if no SLA incident references this issue
    "id": "...",
    "status": "MISSED",
    "triggerType": "MESSAGE",
    "slaDeadline": "2026-09-22T10:47:00.000Z",
    "firstResponseAt": null
  }
}
```

**Limitation — `groupName` is not a historical snapshot.** Unlike
`sla_incidents.group_name` (stored at creation time), the `issues` table
only snapshots `groupType`, not the group name — adding a `group_name`
column would need a migration that isn't otherwise required this phase.
`groupName` here is resolved live via a join to the current `groups` row
on every request. Groups are never hard-deleted while they have issues
(`ON DELETE RESTRICT`), so the join always resolves; if a group is
renamed, older issues will show the *current* name, not the name at the
time they were reported.

### GET /issues/:id

Same fields as above, plus:

```jsonc
{
  // ...all GET /issues fields...
  "responsibleTeam": [
    { "id": "...", "name": "Harish", "phone": "+919566800001" }
  ],
  "timeline": [
    { "label": "Issue reported", "timestamp": "2026-09-22T10:17:00.000Z" },
    { "label": "Issue resolved", "timestamp": "2026-09-22T10:51:00.000Z" }  // only present if resolved
  ]
}
```

**Limitation — no per-message conversation log.** The schema stores one
`message` string per issue, not a chat history, so `timeline` only ever
contains the two events the database actually has evidence for
("reported", and "resolved" if applicable). There is no captured
timestamp for the `IN_PROGRESS` transition specifically (only the
row-level `updatedAt`), so it does not appear as its own timeline entry.
Nothing here is fabricated.

`404` if the id doesn't exist.

### PATCH /issues/:id

```json
{ "status": "RESOLVED", "resolvedBy": "+919566800001" }
```

Allowed transitions: `OPEN → IN_PROGRESS`, `OPEN → RESOLVED`,
`IN_PROGRESS → RESOLVED`. `RESOLVED` is terminal — no reopen in this
phase. Setting `status` to its current value is a no-op (200, unchanged).
`resolvedBy` (optional, E.164) is only applied when the request actually
transitions the issue to `RESOLVED`; it is ignored otherwise.

| Status | When                                                    |
| ------ | ---------------------------------------------------------- |
| 200    | Updated (or no-op if `status` matched the current value). Body: same shape as GET /issues/:id. |
| 400    | Disallowed transition (e.g. `RESOLVED → OPEN`), or invalid `status`/`resolvedBy`. |
| 404    | Issue not found.                                             |

## SLA

**Response SLA and issue resolution are different concepts** (see
Issues above). `RESPONDED` means the team replied within the deadline —
it says nothing about whether the underlying problem is fixed.

| Method | Path           | Purpose                                          |
| ------ | -------------- | --------------------------------------------------- |
| GET    | `/sla`         | List SLA incidents (filterable).                    |
| GET    | `/sla/:id`     | Get a single SLA incident.                          |
| GET    | `/sla/summary` | SLA performance summary (counts, compliance, avg response time). |
| PATCH  | `/sla/:id`     | Record a controlled business action (respond/miss). |

There is no `POST /sla` — see the implementation-status note above.

### GET /sla

Query parameters (optional, combinable):

| Param         | Type                                              | Effect                        |
| ------------- | --------------------------------------------------- | -------------------------------- |
| `status`      | `OPEN`\|`RESPONDED`\|`MISSED`\|`ESCALATED`\|`RESOLVED` | Filter by SLA status.        |
| `groupId`     | uuid                                                 | Filter by group.               |
| `groupType`   | `INTERNAL`\|`CLIENT`                                 | Filter by group type.          |
| `triggerType` | `MENTION`\|`MESSAGE`                                 | Filter by trigger type.        |
| `date`        | `YYYY-MM-DD`                                         | Business-calendar date filter (see below). |

Response `200`: array of

```jsonc
{
  "id": "...",
  "messageId": "wa-msg-124",
  "issueId": "...",              // nullable — a MENTION-only SLA may have no Issue behind it
  "groupId": "...",
  "groupName": "Test Whatsapp Automation",  // snapshot at creation time — see note below
  "groupType": "INTERNAL",                   // snapshot at creation time
  "triggerType": "MESSAGE",
  "senderPhone": "+919566831192",
  "message": "Payment API is not working",
  "status": "MISSED",
  "createdAt": "2026-09-22T10:17:00.000Z",
  "slaDeadline": "2026-09-22T10:47:00.000Z",
  "firstResponseAt": null,
  "respondedBy": null,
  "escalatedAt": "2026-09-22T10:47:05.000Z",  // also doubles as "missedAt" — see note below
  "resolvedAt": null,
  "elapsedMinutes": 34,     // now - createdAt, computed at request time, not stored
  "remainingMinutes": -4    // slaDeadline - now, computed at request time; negative once overdue
}
```

`groupName`/`groupType` **are** true historical snapshots here (unlike
Issues) — stored on the row at creation time, so they read correctly even
if the group is later renamed or its type changed.
`elapsedMinutes`/`remainingMinutes` are always computed fresh from the
current server clock on every request; they are never persisted, so two
requests a minute apart will show different values for the same incident.

**Limitation — no separate `missedAt` column.** The schema (Phase 2A) has
`escalated_at`, not a dedicated `missed_at`. This phase repurposes
`escalatedAt` as "the moment the incident was marked MISSED" rather than
implementing a distinct escalation *state* — there is no ESCALATED
transition wired up yet (the enum value exists for a future phase, e.g. a
second reminder tier). If/when true escalation is implemented, this will
need its own field; documented here rather than silently conflated.

### GET /sla/:id

Same shape as one item above. `404` if the id doesn't exist.

### GET /sla/summary

Accepts the same `groupId`/`groupType`/`date` filters as `GET /sla`
(no `status`/`triggerType` — the summary computes counts *by* status
itself).

```json
{
  "total": 51,
  "open": 6,
  "responded": 42,
  "missed": 3,
  "escalated": 0,
  "resolved": 0,
  "compliancePercentage": 93.3,
  "averageResponseMinutes": 11.4
}
```

- **`compliancePercentage`** = `responded / (responded + missed)`, as a
  percentage rounded to 1 decimal place. `OPEN` incidents are excluded
  from both sides of the ratio — they haven't reached a final outcome
  yet. `null` when `responded + missed = 0`.
- **`averageResponseMinutes`** = average of `firstResponseAt - createdAt`
  in minutes, across every incident with a `firstResponseAt` set
  (including a `MISSED` incident that got a late response) — `OPEN`
  incidents and `MISSED` incidents with no response at all are excluded.
  Any computed negative duration (a corrupt/invalid timestamp pair) is
  defensively dropped from the average rather than skewing it. `null`
  when no incident qualifies.

### PATCH /sla/:id

**Deliberately does not accept an arbitrary `status` field** — a client
cannot rewrite SLA history directly. Instead it accepts one of two
controlled actions:

```json
{ "action": "RESPOND", "respondedBy": "+919566800001" }
```
```json
{ "action": "MISS" }
```

**RESPOND** — records the first response. Idempotent: if
`firstResponseAt` is already set, this is a no-op (the *first* response
is the only one that counts). Business rule: **a response after the
deadline does not turn a MISSED incident back into RESPONDED** — if the
incident is already `MISSED`/`ESCALATED`/`RESOLVED`, the response
timestamp is still recorded (so it's known *when* the late reply
happened) but the status is left unchanged; if the incident was `OPEN`
and the response arrives after `slaDeadline` (e.g. no separate MISS event
ever arrived), it resolves to `MISSED`, not `RESPONDED`.

**MISS** — marks the incident missed and fans out notifications (one
`CEO_SLA_ALERT` to the configured `CEO_PHONE_NUMBER`, one
`TEAM_SLA_REMINDER` per active responsible team member of the group — see
Notifications below). Idempotent: a no-op if the incident has already
settled (`RESPONDED`/`MISSED`/`ESCALATED`/`RESOLVED`) — in particular, an
incident that was already `RESPONDED` in time is never retroactively
marked `MISSED` by a stale/out-of-order event, and repeat `MISS` calls
never create duplicate notifications.

| Status | When                                              |
| ------ | ---------------------------------------------------- |
| 200    | Recorded (or idempotent no-op). Body: same shape as GET /sla/:id. |
| 400    | Missing/invalid `action`, or an unrecognized field (e.g. a bare `status`). |
| 404    | SLA incident not found.                                |

## Notifications (created internally, no public endpoints yet)

`SlaService.miss()` and `SlaService.respond()` (when a response arrives
late) create `Notification` rows via `NotificationsService` — this is
what satisfies the CEO/team notification requirement in this phase.
**A missed SLA always produces exactly one `SlaIncident` regardless of
how many notifications are created for it** — one `CEO_SLA_ALERT` plus
one `TEAM_SLA_REMINDER` per active member of the group's responsible team
(`group_members` where `active = true`), all referencing the same
`sla_id`. The CEO's phone number is read from the `CEO_PHONE_NUMBER`
environment variable (never hard-coded) — see `.env.example`. No actual
WhatsApp message is sent by the backend; these rows represent intent to
notify, which n8n/Wassenger will act on in a later phase.

## Business Day Filtering

`date=YYYY-MM-DD` filters (Issues, SLA, and EOD in a later phase) are
evaluated against the business's local calendar day, not a naive UTC
calendar day — see `src/common/date/business-day.util.ts`. A group in
`Asia/Kolkata` (UTC+5:30, the `BUSINESS_TIMEZONE` default) filtering for
"today" gets the correct local midnight-to-midnight window even though
that window doesn't align with UTC day boundaries.

## EOD

EOD tracks whether **INTERNAL** team members submitted their daily
end-of-day report by the configured deadline. It is a separate domain
from Issues and SLA — nothing here reads or writes `issues` or
`sla_incidents`.

| Method | Path           | Purpose                                                   |
| ------ | -------------- | ------------------------------------------------------------ |
| GET    | `/eod`         | EOD state for a business date (defaults to today), filterable. |
| GET    | `/eod/summary` | EOD completion summary for a business date.                  |
| GET    | `/eod/:param`  | EOD state for a specific date, **or** one report by id (see Route Disambiguation below). |

There is no `POST /eod` and no `PATCH /eod/:id` — see the
implementation-status note above and Status Calculation below (status is
always derived, never set directly).

### Eligibility — member-based, not group-membership-based

An EOD-eligible person is: an **active** team member, with an **active**
membership in at least one **active INTERNAL** group. Eligibility (and
every count in this API) is **per person**, not per membership — a team
member who belongs to two internal groups is counted **once**, not
twice, and is not required to submit once per group. `eod_reports` is
still stored per `(member_id, group_id, report_date)` (unchanged Phase 2A
schema — a submission is tied to whichever group's WhatsApp thread it
came from), but "has this member submitted today?" is answered by "does
ANY of their eligible groups have a report for today?", not "does
*every* group have one." CLIENT group memberships never count, at all.

### Status values — ON_TIME / LATE / MISSING / PENDING

`ON_TIME`, `LATE`, `MISSING` are the persisted `eod_status_enum` values
(unchanged Phase 2A schema). **`PENDING` is an API-response-only
value, never persisted** — see Missing-Record Strategy below for why it
exists and why no schema change was made for it.

- **ON_TIME** — submitted, `submittedAt <= deadline`. Computed once at
  submission time and stored; never recalculated afterward (so a later
  change to `EOD_DEADLINE` never rewrites history).
- **LATE** — submitted, `submittedAt > deadline`.
- **MISSING** — no submission exists for this member/date, **and** the
  deadline has already passed. Never persisted as a row — see below.
- **PENDING** *(response-only)* — no submission exists, but the deadline
  has **not** passed yet. The whole point of this value: a member is
  never shown as MISSING before they've actually run out of time.

### Missing-Record Strategy

**No synthetic `eod_reports` row is ever written for a member who hasn't
submitted.** A `MISSING` (or `PENDING`) entry in any response below is
computed fresh on every request from `(eligible members) − (submitted
reports for this date)`, joined with the deadline check — not a
persisted placeholder. This avoids one fake row per eligible member per
business date accumulating forever, and keeps `eod_reports` as pure
submission history. The tradeoff: a computed entry has `"id": null` (see
each shape below) — there is nothing to fetch by id until the member
actually submits.

### Business Date / Deadline Calculation

Uses the same `BUSINESS_TIMEZONE` mechanism as Issues/SLA (see Business
Day Filtering above) plus `EOD_DEADLINE` (`HH:mm`, 24h, business-local —
default `19:00`, i.e. 7:00 PM). Both live in `.env.example`; neither is
hard-coded in service logic (`src/common/config/business-config.util.ts`
centralizes the two defaults so Issues/SLA/EOD never drift from each
other). `getBusinessDayDeadline()` (`src/common/date/business-day.util.ts`)
computes the exact UTC instant of e.g. 7:00 PM `Asia/Kolkata` on a given
business date — the server's own timezone is never consulted.

### GET /eod

Query parameters (all optional, combinable):

| Param      | Type                                    | Effect                                         |
| ---------- | ----------------------------------------- | ------------------------------------------------ |
| `date`     | `YYYY-MM-DD`                              | Business date. **Defaults to today** (business timezone). |
| `groupId`  | uuid                                       | Restrict to members eligible via this group.     |
| `status`   | `ON_TIME`\|`LATE`\|`MISSING`\|`PENDING`   | Filter by (display) status.                      |
| `memberId` | uuid                                       | A single member's entry for that date.           |

Response `200`: array of

```jsonc
// a real submission
{
  "id": "...",
  "memberId": "...",
  "memberName": "Harish",
  "phone": "+919566800001",
  "groupId": "...",
  "groupName": "Test Whatsapp Automation",
  "reportDate": "2026-09-22",
  "submittedAt": "2026-09-22T13:12:00.000Z",
  "status": "ON_TIME",
  "reportContent": "1. Fixed payment API issue\n2. Tested deployment",
  "deadline": "2026-09-22T13:30:00.000Z",
  "missing": false
}
```
```jsonc
// a computed entry — nobody has submitted yet, deadline already passed
{
  "id": null,
  "memberId": "...",
  "memberName": "Kiran",
  "phone": "+919566800004",
  "groupId": "...",
  "groupName": "Test Whatsapp Automation",
  "reportDate": "2026-09-22",
  "submittedAt": null,
  "status": "MISSING",
  "reportContent": null,
  "deadline": "2026-09-22T13:30:00.000Z",
  "missing": true
}
```

`400` if `date` is not `YYYY-MM-DD`.

### GET /eod/summary

Query parameters: `date` (optional, defaults to today), `groupId`
(optional).

```json
{
  "totalMembers": 20,
  "submitted": 18,
  "onTime": 17,
  "late": 1,
  "missing": 1,
  "deadline": "2026-09-22T13:30:00.000Z",
  "deadlinePassed": true,
  "completionPercentage": 90
}
```

- `totalMembers` — eligible active-internal members (member-based, see
  Eligibility above), optionally scoped to `groupId`.
- `submitted = onTime + late`.
- `missing` — **always 0 while `deadlinePassed` is false.** Before the
  deadline, non-submitters are `PENDING`, not counted as missing — the
  summary never claims a deadline was missed before it happened.
- `completionPercentage = round(submitted / totalMembers * 100, 1)`, `0`
  when `totalMembers = 0`.

### GET /eod/:param — Route Disambiguation

`:param` accepts **either** a `YYYY-MM-DD` date (same response as
`GET /eod?date=:param`, full per-member state for that date) **or** a
report UUID (a single report's detail, see below). This is one route,
not two — `GET /eod/:date` and `GET /eod/:id` as *separate* Nest route
declarations would be ambiguous (Express matches the first one declared
for every request, silently making the second unreachable), so the
handler inspects the value's shape instead. `GET /eod/summary` is
registered **before** `:param` so it's never swallowed by it. `400` if
`:param` is neither a valid date nor a UUID.

**UUID form** response — the shape above, plus:

```json
{
  "reminders": [
    { "id": "...", "sentAt": "2026-09-22T13:35:00.000Z", "status": "SENT", "message": "..." }
  ]
}
```

`reminders` is `EOD_REMINDER`-typed `Notification` rows for that member
on that business date (matched by phone + date, the same pattern SLA
notifications use via `slaId`). **Always an empty array today** —
nothing in the system creates `EOD_REMINDER` notifications yet; that is
n8n's responsibility in the WhatsApp-reminder integration phase. This is
real plumbing against the existing `Notification` entity (no new table),
not a fabricated result — see `docs/architecture.md`.

`404` (UUID form only) if no report exists with that id.

## Dashboard

A single read-only aggregation endpoint for the CEO Operations Dashboard
page (Header, KPI cards, Live Operations, SLA Performance, Group
Activity, EOD Snapshot — see `docs/ui-ux-spec.md`). **Purely an
aggregation layer**: every number here is either taken verbatim from an
existing domain service's own summary (`SlaService.summary()`,
`EodService.summary()`) or computed by grouping the *results* of existing
domain queries (`IssuesService.findAll()`, `SlaService.findAll()`,
`GroupsService.findAll()`) in memory — there is no second implementation
of SLA compliance, EOD eligibility, or issue/SLA status rules here, and
this endpoint never creates or mutates anything.

| Method | Path         | Purpose                                    |
| ------ | ------------ | --------------------------------------------- |
| GET    | `/dashboard` | Aggregated dashboard data for one business date. |

### GET /dashboard

Query: `date` (optional, `YYYY-MM-DD`, business-calendar — defaults to
today per `BUSINESS_TIMEZONE`, same rules as Issues/SLA/EOD). `400` if
malformed.

```jsonc
{
  "date": "2026-09-22",
  "kpis": {
    "activeIssues": 12,               // status OPEN or IN_PROGRESS, this business date
    "slaCompliancePercentage": 93.3,  // === slaPerformance.compliancePercentage, never recomputed
    "slaMissed": 3,                   // === slaPerformance.missed
    "eodSubmitted": 18,                // === eodSnapshot.submitted
    "eodTotalMembers": 20              // === eodSnapshot.totalMembers
  },
  "liveOperations": [
    {
      "issueId": "...",
      "message": "Payment API is not working",
      "groupId": "...",
      "groupName": "Test Whatsapp Automation",
      "groupType": "INTERNAL",
      "issueStatus": "OPEN",
      "slaId": "...",              // null if no SLA incident tracks this issue
      "slaStatus": "MISSED",       // null alongside a null slaId
      "createdAt": "2026-09-22T10:17:00.000Z",
      "slaDeadline": "2026-09-22T10:47:00.000Z",
      "firstResponseAt": null,
      "elapsedMinutes": 34,        // now - createdAt, computed at request time
      "overdue": true              // slaStatus === MISSED, or still OPEN and past slaDeadline
    }
  ],
  "slaPerformance": {
    // identical shape and values to GET /sla/summary?date=... — see SLA section above
    "total": 51, "open": 6, "responded": 42, "missed": 3, "escalated": 0, "resolved": 0,
    "compliancePercentage": 93.3, "averageResponseMinutes": 11.4
  },
  "groupActivity": [
    {
      "groupId": "...",
      "groupName": "Test Whatsapp Automation",
      "groupType": "INTERNAL",
      "active": true,               // Group.active = monitoring status, same meaning as everywhere else
      "memberCount": 3,
      "issueCount": 5,               // issues reported in this group, this business date
      "activeIssueCount": 2,         // of issueCount, still OPEN or IN_PROGRESS
      "slaCount": 4,                 // SLA incidents started in this group, this business date
      "missedSlaCount": 1
    }
  ],
  "eodSnapshot": {
    // identical shape and values to GET /eod/summary?date=... — see EOD section above
    "totalMembers": 20, "submitted": 18, "onTime": 17, "late": 1, "missing": 1,
    "deadline": "2026-09-22T13:30:00.000Z", "deadlinePassed": true, "completionPercentage": 90
  }
}
```

**`liveOperations`** — every `OPEN`/`IN_PROGRESS` issue for the selected
business date, most recent first. Not paginated or truncated in this
phase (the frontend may slice it for display). `slaId`/`slaStatus` are
only populated for issues with a linked `SlaIncident` — a `MESSAGE`-only
issue with no matching SLA event (rare, but possible if the events arrive
out of order) legitimately shows `null` there rather than a fabricated
value. **There is no `assignedTo` field**: nothing in the schema tracks
issue assignment yet (the frontend's "Assign" button is not wired to
anything) — omitted rather than invented.

**`groupActivity`** — one row per currently-**monitored** group
(`active = true`, the same flag `GET /groups` uses — not a new
"monitoring" concept), of **any** type (INTERNAL and CLIENT both appear
here, unlike EOD which is INTERNAL-only). Counts are computed by grouping
the single `GET /issues`/`GET /sla` result sets by `groupId` in memory —
an issue with three responsible team members is still counted once (the
aggregation never joins through `group_members`, so there is no
row-multiplication risk).

**Empty state**: a fresh install with no groups/issues/SLA/EOD data
returns `200` with all-zero counts and empty arrays — never `404` or
`500` for "nothing to show yet".

**Notifications**: the approved dashboard has no dedicated notification
panel, so none is added here — `Notification` rows are not surfaced by
this endpoint (see Section 15 of the phase brief this was built from; the
`Notification` entity itself already backs EOD reminder history under
`GET /eod/:id` and SLA notification fan-out under SLA `MISS`, both
documented in their own sections above).

## n8n Events

Machine-to-machine endpoints called by n8n (never the frontend) to record
detected WhatsApp events and lifecycle transitions. Each is a thin
translation to an existing domain service — no business rule is
duplicated here. `EventsController`/`EventsService` (`src/events/`).

### Authentication

Every route below requires the header:

```
X-N8N-Webhook-Secret: <N8N_WEBHOOK_SHARED_SECRET>
```

Never send the secret as a query parameter or in the body. If
`N8N_WEBHOOK_SHARED_SECRET` is unset in the environment, **every** event
request is rejected (fail closed) rather than left open.

| Status | When |
| ------ | ------------------------------------------------------- |
| 401    | Missing or incorrect secret. Same generic message either way — never reveals which. |

### POST /events/issues

```json
{
  "messageId": "wa-msg-123",
  "groupId": "5f876799-...",
  "senderPhone": "+919566831192",
  "message": "Payment API is not working",
  "createdAt": "2026-09-22T10:17:00.000Z"
}
```

`createdAt` is optional (defaults to now). Idempotent on `messageId` —
backed by `IssuesService.createFromEvent()`, unchanged from Phase 2C.

| Status | When |
| ------ | ------------------------------------------------------- |
| 201    | Created, or the existing Issue if this `messageId` was already recorded. Body: `IssueDetailResponse` (same shape as `GET /issues/:id`). |
| 400    | Malformed payload. |
| 404    | Unknown `groupId`. |

### POST /events/sla

```json
{
  "messageId": "wa-msg-124",
  "groupId": "5f876799-...",
  "triggerType": "MENTION",
  "senderPhone": "+919566831192",
  "message": "@Harish can you check this?",
  "issueId": "ef6c4d2a-...",
  "createdAt": "2026-09-22T10:17:00.000Z"
}
```

`issueId` is optional (a MENTION SLA need not have an Issue behind it;
pass the id returned from `POST /events/issues` for the same message when
one exists). `createdAt` is optional (defaults to now).

**The backend — never the caller — computes `slaDeadline`**, as
`createdAt + Group.slaMinutes`. `slaDeadline` is not an accepted field:
n8n's own timer must never be able to disagree with the persisted
deadline. `CLIENT` groups do not require a mention — a `MESSAGE` trigger
on a `CLIENT` group starts an SLA the same way. Idempotent on
`messageId` — backed by `SlaService.createFromEvent()`, unchanged from
Phase 2C.

| Status | When |
| ------ | ------------------------------------------------------- |
| 201    | Created, or the existing incident if this `messageId` was already recorded. Body: `SlaResponse` (same shape as `GET /sla/:id`). |
| 400    | Malformed payload. |
| 404    | Unknown `groupId`, or `issueId` given but not found. |

### PATCH /events/sla/:messageId/responded

```json
{ "respondedBy": "+919566800001", "responseAt": "2026-09-22T10:25:00.000Z" }
```

Both fields optional (`responseAt` defaults to now). Looks up the
incident by `messageId`, then calls `SlaService.respond()` — the backend
owns the resulting status. A reply arriving after the incident is already
`MISSED` still records the response timestamp but never reverts the
status (unchanged Phase 2C rule).

| Status | When |
| ------ | ------------------------------------------------------- |
| 200    | Recorded (or idempotent no-op). Body: `SlaResponse`. |
| 404    | No SLA incident exists for this `messageId`. |

### PATCH /events/sla/:messageId/missed

```json
{ "missedAt": "2026-09-22T10:47:00.000Z" }
```

Optional (defaults to now). Looks up the incident by `messageId`, then
calls `SlaService.miss()` — idempotent, unchanged Phase 2C notification
fan-out (one `CEO_SLA_ALERT` + one `TEAM_SLA_REMINDER` per active
responsible team member, all referencing this incident).

```json
{
  "sla": { "...": "same shape as GET /sla/:id" },
  "notifications": [
    {
      "id": "...", "type": "CEO_SLA_ALERT", "recipientPhone": "+10000000000",
      "message": "SLA missed in Test Whatsapp Automation: Payment API is not working",
      "issueId": "...", "slaId": "...", "status": "PENDING", "sentAt": null,
      "createdAt": "2026-09-22T10:47:00.000Z"
    }
  ]
}
```

`notifications` is exactly what this call fanned out — **empty on an
idempotent duplicate call**, so n8n never re-sends WhatsApp messages for
an already-processed miss. This is how n8n learns who to message and
what to say without reconstructing business state itself: the CEO
message already contains the human-readable group name (never the raw
`groupId`/WhatsApp JID), and the CEO phone is always read from
`CEO_PHONE_NUMBER`.

| Status | When |
| ------ | ------------------------------------------------------- |
| 200    | Recorded (or idempotent no-op — `notifications: []`). |
| 404    | No SLA incident exists for this `messageId`. |

### POST /events/eod

```json
{
  "messageId": "eod-msg-1",
  "memberId": "9456556a-...",
  "groupId": "5f876799-...",
  "reportContent": "1. Fixed payment API issue\n2. Tested deployment",
  "submittedAt": "2026-09-22T13:12:00.000Z"
}
```

`submittedAt` is required (this is the actual moment the report was
sent). The backend — never the caller — computes `ON_TIME`/`LATE` from
`submittedAt` vs. the business deadline, and enforces the unchanged Phase
2D eligibility rules. Idempotent on `messageId` (and on the underlying
`(member, group, date)` uniqueness — a second submission for a date
already on file returns the existing report even under a new
`messageId`). Backed by `EodService.createFromEvent()`.

| Status | When |
| ------ | ------------------------------------------------------- |
| 201    | Created, or the existing report. Body: `EodDetailResponse` (same shape as `GET /eod/:id`). |
| 400    | Malformed payload, group is not `INTERNAL`, member is not active, or member has no active membership in this group. |
| 404    | Unknown `groupId` or `memberId`. |

### POST /events/notifications

```json
{
  "notificationId": "...",
  "status": "SENT",
  "sentAt": "2026-09-22T10:47:05.000Z"
}
```

`status` is `SENT` or `FAILED` (never `PENDING` — that's only the
creation-time default). `sentAt` optional, only meaningful for `SENT`
(defaults to now). Called by n8n once it has actually attempted the
WhatsApp send for a notification returned from
`PATCH /events/sla/:messageId/missed`. **Updates that existing row** —
never creates a new `Notification` — so this can never loop with the
fan-out step (`NestJS creates → n8n reports → NestJS creates another…`).
`Notification` creation is intent/state, not proof of delivery: a row is
never `SENT` merely because NestJS created it.

| Status | When |
| ------ | ------------------------------------------------------- |
| 200    | Updated. Body: `NotificationResponse`. |
| 400    | Malformed payload. |
| 404    | Unknown `notificationId`. |

## Notes

- `message_id` is the idempotency key for `/events/issues` and `/events/sla`
  — replays of the same WhatsApp message never create duplicate issues or
  SLA incidents (enforced at the database level via a unique constraint,
  not just an application-level check — safe under concurrent duplicate
  deliveries too).
- SLA state transitions (`RESPONDED`, `MISSED`) are independent of issue
  lifecycle transitions (`IN_PROGRESS`, `RESOLVED`); they are updated through
  separate endpoints and never implicitly cascade into one another.
- NestJS never calls Wassenger and never sends a WhatsApp message directly
  — see "Outbound Notifications" in `docs/architecture.md`.
