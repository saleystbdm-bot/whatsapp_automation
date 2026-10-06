# UI/UX Spec — WhatsApp Operations

Five-page CEO Operations Dashboard, dark-first professional SaaS aesthetic.

## Primary Sidebar

Top to bottom:

- Dashboard
- Groups
- SLA
- Issues
- EOD

Bottom of sidebar:

- `● System Online`

## Dashboard

**Header**

- Title: `Dashboard`
- Greeting: `Good morning, CEO`
- Subtitle: `Here's what's happening across your monitored WhatsApp groups.`
- Date selector: `Today`

**KPI cards**

- Active Issues
- SLA Compliance
- SLA Missed
- EOD Reports

**Live Operations**

Shows, per active item:

- Issue title
- Group
- Elapsed time
- SLA state
- Status

**SLA Performance**

Shows:

- Compliance
- Total issues
- Responded
- Missed
- Open
- Average response time

**Group Activity**

Shows activity broken down by monitored group.

**EOD Snapshot**

Shows:

- Submitted
- Late
- Missing
- Deadline

## Groups

Two-panel layout.

**Left panel — All WhatsApp Groups**

- Search
- List of all groups, each showing:
  - Group name
  - Member count
  - Internal/Client badge
  - `Monitor` button

Example:

```
Client ABC        24 members   CLIENT     [Monitor]
Client XYZ        18 members   CLIENT     [Monitor]
Sales Team        12 members   INTERNAL   [Monitor]
```

**Right panel — Monitored Groups**

- Monitored group count
- List of monitored groups, each showing:
  - Group name
  - Member count
  - Internal/Client badge
  - SLA duration
  - Active status
  - `Remove` button

Example:

```
Test Whatsapp Automation   INTERNAL   SLA: 30 minutes   Active
Client Support             CLIENT     SLA: 30 minutes   Active
Production Team            INTERNAL   SLA: 30 minutes   Active
```

**Monitored group detail drawer** (opened by clicking a monitored group)

- Group name
- Group type
- Monitoring status
- WhatsApp group ID
- SLA duration
- Responsible team members
- Issue keywords
- `Remove monitoring` action

**Add Group**

- `+ Add Group` action opens a form with fields:
  - Group Name
  - WhatsApp Group ID
  - Group Type
  - SLA Duration
  - Responsible Team
  - Keywords

## SLA

**Header**

- Title: `SLA Monitor`
- Subtitle: `Live SLA status across monitored groups.`

**Filters**

- Status: `All` / `Open` / `Responded` / `Missed`
- Group
- Type
- Date

**Table / list columns**

- Issue
- Group
- Type
- Elapsed
- SLA
- Status
- Actions

**Statuses**

- `OPEN`
- `RESPONDED`
- `MISSED`

**SLA detail drawer**

- Issue
- Group
- Triggered time
- SLA deadline
- Response time
- Current status
- CEO notification status
- Team notification status

**Timeline**

1. Issue received
2. SLA started
3. SLA deadline
4. Response or SLA missed
5. Team notified
6. CEO notified

## Issues

**Header**

- Title: `Issues`
- Subtitle: `All issues detected from monitored WhatsApp groups.`

**Filters**

- Status: `All` / `Open` / `In Progress` / `Resolved`
- Search
- Group
- Date

**Table columns**

- Issue
- Group
- Status
- Reported time
- Actions

**Issue detail**

- Issue title
- Issue message
- Group
- Group type
- Reported by
- Reported time
- SLA status
- Responsible team
- Conversation timeline

**Future actions** (not implemented in v1 foundation)

- Assign
- Mark In Progress
- Mark Resolved

## EOD

**Header**

- Title: `EOD Reports`
- Date
- Deadline: `7:00 PM`

**KPI**

- Submitted
- Late
- Missing

**Progress**

- Example: `18 / 20 submitted`

**Table columns**

- Member
- Submitted
- Time
- Status
- Actions

**Statuses**

- `ON TIME`
- `LATE`
- `MISSING`

**EOD detail**

- Member
- Submission time
- Status
- EOD content
- Deadline
- Reminder history

## Design System

Dark-first professional SaaS operations dashboard.

- Dark background
- Subtle borders
- Rounded cards
- Restrained use of color
- Strong typography hierarchy
- Green → success
- Yellow/amber → warning
- Red → critical/missed
- Blue/indigo → primary actions

**Component usage rules**

- Not everything is a card.
- Cards → KPIs.
- Tables → operational data.
- Drawers → details.
- Timeline → incident history.
- Badges → status.
- Charts → analytics.

## Responsive Behavior

- **Desktop** — two-column Groups page (All Groups / Monitored Groups
  side-by-side).
- **Tablet** — Groups panels stack vertically.
- **Mobile** — responsive navigation (collapsible/horizontal sidebar) and
  stacked content throughout.
