import type {
  DashboardData,
  EodReport,
  EodStatus,
  GroupType,
  Issue,
  IssueStatus,
  MonitoredGroup,
  SlaIncident,
  SlaStatus,
  TeamMember,
} from '../types/domain';
import { buildDemoDataset } from './demoData';

/**
 * In-memory stand-in for the backend, used when VITE_DEMO_MODE is on.
 * Mirrors the repository's function signatures so the pages behave the
 * same way. Changes (monitor/remove group, add group, issue status) live
 * only in this session's memory and reset on reload.
 */

const MIN = 60_000;
const DEMO_LATENCY_MS = 180;

const dataset = buildDemoDataset();
let groups: MonitoredGroup[] = dataset.groups;
let issues: Issue[] = dataset.issues;
const slaIncidents: SlaIncident[] = dataset.slaIncidents;
const eodReports: EodReport[] = dataset.eodReports;
const teamMembers: TeamMember[] = dataset.teamMembers;

function respond<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(value)), DEMO_LATENCY_MS);
  });
}

function fail(message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), DEMO_LATENCY_MS);
  });
}

// ---------------------------------------------------------------------------
// Groups & team
// ---------------------------------------------------------------------------

export function getGroups(params?: { active?: boolean; type?: GroupType; search?: string }) {
  const term = params?.search?.trim().toLowerCase();
  return respond(
    groups.filter(
      (group) =>
        (params?.active === undefined || group.active === params.active) &&
        (params?.type === undefined || group.type === params.type) &&
        (!term || group.name.toLowerCase().includes(term)),
    ),
  );
}

export function getGroup(id: string) {
  const group = groups.find((item) => item.id === id);
  return group ? respond(group) : fail(`Group ${id} not found`);
}

export function createGroup(input: {
  whatsappGroupId: string;
  name: string;
  type: GroupType;
  slaMinutes: number;
  memberIds?: string[];
  keywords?: string[];
}) {
  const responsibleTeam = teamMembers.filter((member) => input.memberIds?.includes(member.id));
  const group: MonitoredGroup = {
    id: `group-demo-${Date.now()}`,
    whatsappGroupId: input.whatsappGroupId,
    name: input.name,
    memberCount: responsibleTeam.length,
    type: input.type,
    slaMinutes: input.slaMinutes,
    active: false,
    responsibleTeam,
    keywords: (input.keywords ?? []).map((keyword) => keyword.trim().toLowerCase()).filter(Boolean),
  };
  groups = [...groups, group];
  return respond(group);
}

export function updateGroup(
  id: string,
  patch: { name?: string; type?: GroupType; slaMinutes?: number; active?: boolean },
) {
  const group = groups.find((item) => item.id === id);
  if (!group) return fail(`Group ${id} not found`);
  const updated: MonitoredGroup = { ...group, ...patch };
  groups = groups.map((item) => (item.id === id ? updated : item));
  return respond(updated);
}

export function getTeamMembers(params?: { active?: boolean; search?: string }) {
  const term = params?.search?.trim().toLowerCase();
  return respond(teamMembers.filter((member) => !term || member.name.toLowerCase().includes(term)));
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

const ALLOWED_ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
};

export function getIssues(filters?: {
  status?: IssueStatus;
  groupId?: string;
  groupType?: GroupType;
  search?: string;
  date?: string;
}) {
  const term = filters?.search?.trim().toLowerCase();
  return respond(
    issues.filter(
      (issue) =>
        (!filters?.status || issue.status === filters.status) &&
        (!filters?.groupId || issue.groupId === filters.groupId) &&
        (!filters?.groupType || issue.groupType === filters.groupType) &&
        (!term || issue.message.toLowerCase().includes(term)),
    ),
  );
}

export function getIssue(id: string) {
  const issue = issues.find((item) => item.id === id);
  return issue ? respond(issue) : fail(`Issue ${id} not found`);
}

export function updateIssueStatus(id: string, status: IssueStatus) {
  const issue = issues.find((item) => item.id === id);
  if (!issue) return fail(`Issue ${id} not found`);
  if (issue.status === status) return respond(issue);
  if (!ALLOWED_ISSUE_TRANSITIONS[issue.status].includes(status)) {
    return fail(`Invalid issue status transition: ${issue.status} → ${status}`);
  }
  const now = new Date().toISOString();
  const updated: Issue = {
    ...issue,
    status,
    conversation:
      status === 'RESOLVED'
        ? [
            ...issue.conversation,
            { id: `${issue.id}-resolved-${Date.now()}`, timestamp: now, actor: 'CEO', message: 'Issue resolved.' },
          ]
        : issue.conversation,
  };
  issues = issues.map((item) => (item.id === id ? updated : item));
  return respond(updated);
}

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

export function getSlaIncidents(filters?: {
  status?: SlaStatus;
  groupId?: string;
  groupType?: GroupType;
  triggerType?: 'MENTION' | 'MESSAGE';
  date?: string;
}) {
  return respond(
    slaIncidents.filter(
      (incident) =>
        (!filters?.status || incident.status === filters.status) &&
        (!filters?.groupId || incident.groupId === filters.groupId) &&
        (!filters?.groupType || incident.groupType === filters.groupType),
    ),
  );
}

export function getSlaIncident(id: string) {
  const incident = slaIncidents.find((item) => item.id === id);
  return incident ? respond(incident) : fail(`SLA incident ${id} not found`);
}

// The demo has no live SLA engine, so respond/miss are reflected as-is.
export function respondSla(id: string) {
  return getSlaIncident(id);
}

export function missSla(id: string) {
  return getSlaIncident(id);
}

// ---------------------------------------------------------------------------
// EOD
// ---------------------------------------------------------------------------

export function getEod(filters?: { date?: string; groupId?: string; status?: EodStatus; memberId?: string }) {
  return respond(
    eodReports.filter(
      (report) =>
        (!filters?.status || report.status === filters.status) &&
        (!filters?.memberId || report.memberId === filters.memberId),
    ),
  );
}

export function getEodSummary(_filters?: { date?: string; groupId?: string }) {
  const submitted = eodReports.filter((report) => report.submitted);
  const onTime = eodReports.filter((report) => report.status === 'ON_TIME').length;
  const late = eodReports.filter((report) => report.status === 'LATE').length;
  const missing = eodReports.filter((report) => report.status === 'MISSING').length;
  const total = eodReports.length;
  return respond({
    totalMembers: total,
    submitted: submitted.length,
    onTime,
    late,
    missing,
    deadline: dataset.eodDeadlineIso,
    deadlinePassed: missing > 0,
    completionPercentage: total > 0 ? Math.round((submitted.length / total) * 1000) / 10 : 0,
  });
}

export function getEodReport(id: string) {
  const report = eodReports.find((item) => item.id === id);
  return report ? respond(report) : fail(`EOD report ${id} not found`);
}

// ---------------------------------------------------------------------------
// Dashboard — derived from the same arrays as the lists, so cards reconcile.
// ---------------------------------------------------------------------------

export function getDashboard(_date?: string) {
  const now = Date.now();
  const active = issues.filter((issue) => issue.status !== 'RESOLVED');
  const responded = slaIncidents.filter((s) => s.status === 'RESPONDED').length;
  const missed = slaIncidents.filter((s) => s.status === 'MISSED').length;
  const open = slaIncidents.filter((s) => s.status === 'OPEN').length;
  const applicable = responded + missed;
  const compliance = applicable > 0 ? Math.round((responded / applicable) * 1000) / 10 : 0;

  const responseMinutes = slaIncidents
    .filter((s) => s.responseAt !== null)
    .map((s) => (new Date(s.responseAt!).getTime() - new Date(s.triggeredAt).getTime()) / MIN);
  const averageResponseMinutes =
    responseMinutes.length > 0
      ? Math.round((responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length) * 10) / 10
      : 0;

  const submitted = eodReports.filter((r) => r.submitted).length;
  const late = eodReports.filter((r) => r.status === 'LATE').length;
  const missing = eodReports.filter((r) => r.status === 'MISSING').length;
  const inProgress = active.filter((i) => i.status === 'IN_PROGRESS').length;
  const openIssues = active.length - inProgress;

  const slaById = new Map(slaIncidents.map((s) => [s.id, s]));

  const data: DashboardData = {
    kpis: {
      activeIssues: active.length,
      activeIssuesDelta: `${openIssues} open · ${inProgress} in progress`,
      slaCompliance: compliance,
      slaComplianceContext: `${responded} of ${applicable} responses on time`,
      slaMissed: missed,
      slaMissedContext: `${missed} SLA${missed === 1 ? '' : 's'} breached`,
      eodSubmitted: submitted,
      eodTotal: eodReports.length,
      eodContext: `${late} late · ${missing} missing`,
    },
    liveOperations: active
      .slice()
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
      .map((issue) => {
        const sla = slaById.get(dataset.slaIdByIssueId[issue.id]);
        const elapsed = sla ? Math.round((now - new Date(sla.triggeredAt).getTime()) / MIN) : 0;
        const remaining = sla ? Math.round((new Date(sla.slaDeadline).getTime() - now) / MIN) : 0;
        return {
          id: issue.id,
          issueTitle: issue.title,
          groupName: issue.groupName,
          elapsedLabel: `${elapsed}m elapsed`,
          remainingLabel: sla?.status === 'OPEN' && remaining > 0 ? `${remaining}m remaining` : undefined,
          status: issue.slaStatus,
        };
      }),
    slaPerformance: {
      compliance,
      totalIssues: slaIncidents.length,
      responded,
      missed,
      open,
      averageResponseMinutes,
      trend: [...dataset.complianceTrend, compliance],
    },
    groupActivity: groups
      .filter((group) => group.active)
      .map((group) => ({
        groupName: group.name,
        count: issues.filter((issue) => issue.groupId === group.id).length,
      })),
    eodSnapshot: {
      submitted,
      total: eodReports.length,
      late,
      missing,
      deadline: dataset.eodDeadlineIso,
    },
  };
  return respond(data);
}
