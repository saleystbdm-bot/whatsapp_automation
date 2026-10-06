# Product Requirements — WhatsApp Operations

## Purpose

WhatsApp Operations is a CEO operations dashboard that monitors selected WhatsApp
groups, detects mentions and issues, tracks response SLAs, escalates missed SLAs,
tracks the lifecycle of issues, and monitors internal team end-of-day (EOD) reports.

## Users

- **CEO** — reviews operational health across all monitored groups, is notified
  directly when an SLA is missed.
- **Operations / Admin** — configures monitored groups, team members, keywords,
  and SLA durations; triages issues; responds within SLA.

## Primary Pages

The application has exactly five primary pages. No additional primary navigation
pages are to be introduced.

1. **Dashboard** — operational overview and KPIs.
2. **Groups** — configuration of monitored WhatsApp groups.
3. **SLA** — live SLA status and history across monitored groups.
4. **Issues** — issue tracking and lifecycle management.
5. **EOD** — internal team end-of-day report tracking.

## Core Functionality

1. Monitor selected WhatsApp groups.
2. Support both internal and client groups.
3. Detect mentions of the business/team inside monitored groups.
4. Detect issue/problem messages inside monitored groups.
5. Track response SLA for detected issues/mentions.
6. Detect SLA violations (missed responses).
7. Notify responsible team members when a response is due or overdue.
8. Notify the CEO when an SLA is missed.
9. Track the full lifecycle of an issue (open → in progress → resolved).
10. Track internal team EOD reports against a daily deadline.
11. Display all of the above operational information in the CEO dashboard.

## SLA vs. Issue Resolution

**Response SLA and issue resolution are different concepts and must never be
conflated.**

- **Response SLA** measures whether the team **acknowledged** an issue/mention
  within the configured time window.
- **Issue resolution** measures whether the **underlying problem has actually
  been fixed**.

A team response changes the SLA state to `RESPONDED`, but this **does not**
automatically resolve the issue. Resolution is a separate, explicit action.

### Example

> **Issue:** "Payment API is not working"
> **Team replies:** "We are checking it."

Result:

| Concern | State       |
| ------- | ----------- |
| SLA     | `RESPONDED` |
| Issue   | `OPEN`      |

The issue remains `OPEN` (or is moved to `IN_PROGRESS`) until it is explicitly
marked `RESOLVED` by a responsible team member — a reply alone is never
sufficient to close an issue.

## Business Rules

1. PostgreSQL is the single source of truth for application state.
2. The frontend never accesses PostgreSQL or Wassenger directly.
3. Wassenger credentials are never exposed to the frontend.
4. n8n owns WhatsApp automation (webhooks, normalization, detection triggers,
   SLA timers, notifications).
5. The backend owns business logic, persistence, and lifecycle rules.
6. A WhatsApp message must never create duplicate issues or duplicate SLA
   incidents — `message_id` is used for idempotency.
7. Response SLA state is independent of issue resolution state.
8. Internal and CLIENT groups must remain distinguishable throughout the UI.
9. EOD reporting is required only for internal team members.
10. The EOD deadline is 7:00 PM in the configured business timezone.
11. The CEO receives exactly one direct notification per missed SLA.
12. Responsible team members can receive direct SLA reminders ahead of/at the
    deadline.
13. Group names shown in the CEO UI are always human-readable names, never raw
    WhatsApp group IDs.
