import type {
  DashboardData,
  EodReport,
  EodSnapshot,
  Issue,
  MonitoredGroup,
  SlaIncident,
  SlaPerformance,
  SlaTimelineStep,
  TeamMember,
} from '../types/domain';
import type {
  DashboardResponse,
  EodDetailResponse,
  EodResponse,
  GroupResponse,
  IssueDetailResponse,
  IssueResponse,
  SlaResponse,
  TeamMemberResponse,
} from './backend-types';

export function mapGroupResponse(g: GroupResponse): MonitoredGroup {
  return {
    id: g.id,
    whatsappGroupId: g.whatsappGroupId,
    name: g.name,
    memberCount: g.memberCount,
    type: g.type,
    slaMinutes: g.slaMinutes,
    active: g.active,
    responsibleTeam: g.members
      .filter((m) => m.active)
      .map((m) => ({ id: m.memberId, name: m.name, phone: m.phone })),
    keywords: g.keywords.filter((k) => k.active).map((k) => k.keyword),
  };
}

export function mapTeamMemberResponse(m: TeamMemberResponse): TeamMember {
  return { id: m.id, name: m.name, phone: m.phone };
}

function buildIssueConversation(issue: IssueResponse) {
  const conversation = [
    {
      id: `${issue.id}-reported`,
      timestamp: issue.createdAt,
      actor: issue.senderPhone,
      message: issue.message,
    },
  ];
  if (issue.resolvedAt) {
    conversation.push({
      id: `${issue.id}-resolved`,
      timestamp: issue.resolvedAt,
      actor: issue.resolvedBy ?? 'System',
      message: 'Issue resolved',
    });
  }
  return conversation;
}

export function mapIssueResponse(issue: IssueResponse | IssueDetailResponse): Issue {
  const detail = 'responsibleTeam' in issue ? issue : null;
  return {
    id: issue.id,
    title: issue.message,
    message: issue.message,
    groupId: issue.groupId,
    groupName: issue.groupName,
    groupType: issue.groupType,
    status: issue.status,
    slaStatus: issue.sla?.status ?? null,
    reportedBy: issue.senderPhone,
    reportedAt: issue.createdAt,
    responsibleTeam: detail ? detail.responsibleTeam.map((t) => ({ id: t.id, name: t.name, phone: t.phone })) : [],
    conversation: buildIssueConversation(issue),
  };
}

function buildSlaTimeline(sla: SlaResponse): SlaTimelineStep[] {
  const timeline: SlaTimelineStep[] = [
    { id: `${sla.id}-received`, label: 'Issue received', timestamp: sla.createdAt },
    { id: `${sla.id}-started`, label: 'SLA started', timestamp: sla.createdAt },
    { id: `${sla.id}-deadline`, label: 'SLA deadline', timestamp: sla.slaDeadline },
  ];
  if (sla.firstResponseAt) {
    timeline.push({ id: `${sla.id}-responded`, label: 'Response received', timestamp: sla.firstResponseAt });
  } else if (sla.escalatedAt) {
    timeline.push({ id: `${sla.id}-missed`, label: 'SLA missed', timestamp: sla.escalatedAt });
  }
  return timeline;
}

export function mapSlaResponse(sla: SlaResponse): SlaIncident {
  const slaMinutes = Math.round(
    (new Date(sla.slaDeadline).getTime() - new Date(sla.createdAt).getTime()) / 60000,
  );
  return {
    id: sla.id,
    issueTitle: sla.message,
    groupId: sla.groupId,
    groupName: sla.groupName,
    groupType: sla.groupType,
    triggeredAt: sla.createdAt,
    slaDeadline: sla.slaDeadline,
    responseAt: sla.firstResponseAt,
    elapsedMinutes: sla.elapsedMinutes,
    slaMinutes,
    status: sla.status,
    ceoNotified: null,
    teamNotified: null,
    timeline: buildSlaTimeline(sla),
  };
}

export function mapEodResponse(eod: EodResponse | EodDetailResponse): EodReport {
  const detail = 'reminders' in eod ? eod : null;
  return {
    id: eod.id,
    memberId: eod.memberId,
    member: eod.memberName,
    submitted: eod.submittedAt !== null,
    submittedAt: eod.submittedAt,
    status: eod.status,
    content: eod.reportContent ? eod.reportContent.split('\n').filter((line) => line.trim().length > 0) : [],
    reminders: detail
      ? detail.reminders.map((r) => ({ id: r.id, timestamp: r.sentAt, label: r.message || r.status }))
      : [],
  };
}

export function mapDashboardResponse(d: DashboardResponse): DashboardData {
  const slaPerformance: SlaPerformance = {
    compliance: d.slaPerformance.compliancePercentage ?? 0,
    totalIssues: d.slaPerformance.total,
    responded: d.slaPerformance.responded,
    missed: d.slaPerformance.missed,
    open: d.slaPerformance.open,
    averageResponseMinutes: d.slaPerformance.averageResponseMinutes ?? 0,
    trend: [],
  };

  const eodSnapshot: EodSnapshot = {
    submitted: d.eodSnapshot.submitted,
    total: d.eodSnapshot.totalMembers,
    late: d.eodSnapshot.late,
    missing: d.eodSnapshot.missing,
    deadline: d.eodSnapshot.deadline,
  };

  return {
    kpis: {
      activeIssues: d.kpis.activeIssues,
      activeIssuesDelta: '',
      slaCompliance: d.kpis.slaCompliancePercentage ?? 0,
      slaComplianceContext: '',
      slaMissed: d.kpis.slaMissed,
      slaMissedContext: '',
      eodSubmitted: d.kpis.eodSubmitted,
      eodTotal: d.kpis.eodTotalMembers,
      eodContext: '',
    },
    liveOperations: d.liveOperations.map((op) => ({
      id: op.issueId,
      issueTitle: op.message,
      groupName: op.groupName,
      elapsedLabel: `${op.elapsedMinutes}m elapsed`,
      remainingLabel: undefined,
      status: op.slaStatus,
    })),
    slaPerformance,
    groupActivity: d.groupActivity.map((g) => ({ groupName: g.groupName, count: g.issueCount })),
    eodSnapshot,
  };
}
