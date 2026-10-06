import type {
  ConversationEvent,
  EodReport,
  EodStatus,
  GroupType,
  Issue,
  IssueStatus,
  MonitoredGroup,
  SlaIncident,
  SlaStatus,
  SlaTimelineStep,
  TeamMember,
} from '../types/domain';

/**
 * Static demo dataset for the client demo build (VITE_DEMO_MODE). Every
 * timestamp is relative to the moment the dataset is built, so the
 * "today" views always look live. Shapes match the frontend domain types
 * exactly, so the demo store and the real repository are interchangeable.
 */

const MIN = 60_000;

interface GroupSpec {
  key: string;
  name: string;
  type: GroupType;
  slaMinutes: number;
  active: boolean;
  keywords: string[];
  team: string[];
}

interface MemberSpec {
  key: string;
  name: string;
  phone: string;
}

const MEMBER_SPECS: MemberSpec[] = [
  { key: 'arun', name: 'Arun Kumar', phone: '+919800100001' },
  { key: 'rahul', name: 'Rahul S', phone: '+919800100002' },
  { key: 'priya', name: 'Priya Sharma', phone: '+919800100003' },
  { key: 'karthik', name: 'Karthik M', phone: '+919800100004' },
  { key: 'vignesh', name: 'Vignesh R', phone: '+919800100005' },
  { key: 'divya', name: 'Divya S', phone: '+919800100006' },
];

const GROUP_SPECS: GroupSpec[] = [
  { key: 'abc', name: 'ABC Technologies Support', type: 'CLIENT', slaMinutes: 30, active: true, keywords: ['issue', 'down', 'not working'], team: ['arun', 'rahul'] },
  { key: 'techademy', name: 'Techademy Client Operations', type: 'CLIENT', slaMinutes: 30, active: true, keywords: ['login', 'payment', 'urgent'], team: ['priya', 'karthik'] },
  { key: 'chennai', name: 'Chennai Operations Team', type: 'INTERNAL', slaMinutes: 30, active: true, keywords: ['server', 'deploy', 'cpu'], team: ['arun', 'vignesh', 'priya'] },
  { key: 'priority', name: 'Customer Support - Priority', type: 'CLIENT', slaMinutes: 15, active: true, keywords: ['urgent', 'escalate', 'down'], team: ['divya', 'priya'] },
  { key: 'internal', name: 'Internal Technical Team', type: 'INTERNAL', slaMinutes: 30, active: true, keywords: ['database', 'api', 'error'], team: ['rahul', 'karthik', 'vignesh'] },
  { key: 'enterprise', name: 'Enterprise Client Support', type: 'CLIENT', slaMinutes: 20, active: true, keywords: ['outage', 'sla', 'down'], team: ['arun', 'divya'] },
  { key: 'production', name: 'Production Support Team', type: 'INTERNAL', slaMinutes: 15, active: true, keywords: ['production', 'cpu', 'outage'], team: ['karthik', 'rahul'] },
  { key: 'payments', name: 'Payments Escalations', type: 'CLIENT', slaMinutes: 20, active: true, keywords: ['payment', 'gateway', 'refund'], team: ['priya', 'vignesh'] },
  { key: 'mobile', name: 'Mobile App Support', type: 'CLIENT', slaMinutes: 30, active: true, keywords: ['app', 'crash', 'otp'], team: ['divya', 'rahul'] },
  { key: 'qa', name: 'QA & Release Coordination', type: 'INTERNAL', slaMinutes: 60, active: true, keywords: ['release', 'regression'], team: ['vignesh', 'divya'] },
  { key: 'data', name: 'Data Platform Alerts', type: 'INTERNAL', slaMinutes: 30, active: false, keywords: ['pipeline', 'etl'], team: ['karthik'] },
  { key: 'sales', name: 'Sales & Renewals', type: 'INTERNAL', slaMinutes: 60, active: false, keywords: ['renewal', 'invoice'], team: ['priya'] },
];

/**
 * 50 issues. Index drives the status/SLA distribution below, so the
 * totals always reconcile: 42 resolved + 8 active = 50 issues, and
 * 44 responded + 4 missed + 2 open = 50 SLA incidents.
 */
const ISSUE_MESSAGES = [
  'Production website is down',
  'Payment gateway is not responding',
  'Login OTP is not being received',
  'Server CPU usage is high',
  'Database connection error',
  'API response time is very high',
  'Customer unable to access dashboard',
  'Email notifications are delayed',
  'Checkout page times out for guest users',
  'Invoice PDF generation fails for March statements',
  'Mobile app crashes on Android 14 at startup',
  'Refund not reflected in customer wallet',
  'Webhook deliveries failing with 502 errors',
  'Search results missing recent product listings',
  'SSL certificate expiring on the partner portal',
  'Scheduled report export is empty',
  'Bulk upload of customer records stuck at 40%',
  'Password reset link expires immediately',
  'Duplicate charges seen for UPI payments',
  'Staging deploy failed on the migration step',
  'Disk usage on reporting server above 90%',
  'Sales ETL pipeline has not run since midnight',
  'Regression failures in the release candidate build',
  'Push notifications not delivered to iOS devices',
  'Support chat widget not loading',
  'Order status stuck at "processing"',
  'Rate limiter blocking legitimate partner traffic',
  'CSV export truncates rows above 10,000',
  'Two-factor login loop on Safari',
  'Vendor onboarding rejects valid GST numbers',
  'Cache not clearing stale prices',
  'Admin panel session expires every five minutes',
  'Analytics dashboard shows zero for yesterday',
  'Shipping label API returns timeout',
  'Incorrect tax calculation for interstate orders',
  'Background job queue backlog growing',
  'Email templates broken in Outlook',
  'File upload fails for attachments above 5 MB',
  'Subscription renewal reminder sent twice',
  'Login page slow to load for Chennai office',
  'Memory leak suspected in notification service',
  'Coupon code not applied at checkout',
  'Customer data export missing address fields',
  'Load balancer health check failing intermittently',
  'Telephony callbacks not updating ticket status',
  'Partner dashboard shows outdated commission data',
  'Mobile OTP SMS delayed by several minutes',
  'Reporting job failing with out-of-memory error',
  'Sandbox credentials not working for new partners',
  'Audit log entries missing for admin actions',
];

/** Uneven rotation over the active groups, so per-group activity looks like real traffic. */
const GROUP_ROTATION = [0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 6, 7, 8, 9, 0, 3];

const MISSED_SLA_INDEXES = new Set([30, 33, 36, 38]);
const OPEN_SLA_INDEXES = new Set([48, 49]);

const EOD_PLAN: { member: string; group: string; status: EodStatus; agoMin: number; content: string[] }[] = [
  { member: 'arun', group: 'chennai', status: 'ON_TIME', agoMin: 130, content: ['Reviewed Chennai server capacity plan', 'Closed three deployment tickets'] },
  { member: 'rahul', group: 'internal', status: 'ON_TIME', agoMin: 88, content: ['Fixed payment callback retry logic', 'Reviewed production alerts'] },
  { member: 'karthik', group: 'production', status: 'LATE', agoMin: 25, content: ['Database failover drill completed', 'Pending: index rebuild on orders table'] },
  { member: 'vignesh', group: 'qa', status: 'ON_TIME', agoMin: 160, content: ['Regression pass on release candidate 4.2', 'Logged two defects for QA sign-off'] },
  { member: 'divya', group: 'qa', status: 'ON_TIME', agoMin: 42, content: ['Mobile crash fix merged to release branch', 'Updated Android test matrix'] },
  { member: 'priya', group: 'chennai', status: 'MISSING', agoMin: 0, content: [] },
];

export interface DemoDataset {
  groups: MonitoredGroup[];
  teamMembers: TeamMember[];
  issues: Issue[];
  slaIncidents: SlaIncident[];
  eodReports: EodReport[];
  /** Maps each issue id to its SLA incident id (1:1 in this dataset). */
  slaIdByIssueId: Record<string, string>;
  /** Historical compliance points for the SLA sparkline (last point is recomputed live). */
  complianceTrend: number[];
  eodDeadlineLabel: string;
  eodDeadlineIso: string;
}

function todayDeadlineIso(): string {
  // 7:00 PM Asia/Kolkata (UTC+05:30) on today's Indian calendar date.
  const istNow = new Date(Date.now() + 330 * MIN);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  return new Date(Date.UTC(y, m, d, 13, 30)).toISOString();
}

export function buildDemoDataset(now: number = Date.now()): DemoDataset {
  const teamMembers: TeamMember[] = MEMBER_SPECS.map((spec) => ({
    id: `member-${spec.key}`,
    name: spec.name,
    phone: spec.phone,
  }));
  const memberByKey = new Map(teamMembers.map((m) => [m.id.replace('member-', ''), m]));

  const groups: MonitoredGroup[] = GROUP_SPECS.map((spec, index) => {
    const responsibleTeam = spec.team.map((key) => memberByKey.get(key)!);
    return {
      id: `group-${spec.key}`,
      whatsappGroupId: `120363400000000${String(index + 1).padStart(3, '0')}@g.us`,
      name: spec.name,
      memberCount: responsibleTeam.length,
      type: spec.type,
      slaMinutes: spec.slaMinutes,
      active: spec.active,
      responsibleTeam,
      keywords: spec.keywords,
    };
  });

  const activeGroups = groups.filter((g) => g.active);
  const slaIdByIssueId: Record<string, string> = {};
  const issues: Issue[] = [];
  const slaIncidents: SlaIncident[] = [];

  ISSUE_MESSAGES.forEach((message, i) => {
    const group = activeGroups[GROUP_ROTATION[i % GROUP_ROTATION.length]];
    const responder = group.responsibleTeam[0];
    const status: IssueStatus = i < 42 ? 'RESOLVED' : i < 45 ? 'IN_PROGRESS' : 'OPEN';
    const ageMin = status === 'RESOLVED' ? 120 + (41 - i) * 22 : i >= 48 ? 8 : 4 + (i - 42) * 3;
    const createdAt = now - ageMin * MIN;
    const reporter = `+9198000${String(1000 + i)}`;

    const slaStatus: SlaStatus = MISSED_SLA_INDEXES.has(i)
      ? 'MISSED'
      : OPEN_SLA_INDEXES.has(i)
        ? 'OPEN'
        : 'RESPONDED';

    const deadline = createdAt + group.slaMinutes * MIN;
    let responseAt: number | null = null;
    let escalatedAt: number | null = null;
    if (slaStatus === 'RESPONDED') {
      const offsetMin = Math.min(4 + ((i * 7) % (group.slaMinutes - 8)), ageMin - 1);
      responseAt = createdAt + offsetMin * MIN;
    } else if (slaStatus === 'MISSED') {
      escalatedAt = deadline + 3 * MIN;
    }

    const issueId = `issue-${String(i + 1).padStart(2, '0')}`;
    const slaId = `sla-${String(i + 1).padStart(2, '0')}`;
    slaIdByIssueId[issueId] = slaId;

    const conversation: ConversationEvent[] = [
      { id: `${issueId}-c1`, timestamp: new Date(createdAt).toISOString(), actor: reporter, message },
    ];
    if (responseAt !== null) {
      conversation.push({
        id: `${issueId}-c2`,
        timestamp: new Date(responseAt).toISOString(),
        actor: responder.name,
        message: 'Thanks for flagging, we are looking into it.',
      });
    }
    if (status === 'RESOLVED') {
      const resolvedAt = createdAt + Math.min(90 + (i % 6) * 25, ageMin - 5) * MIN;
      conversation.push({
        id: `${issueId}-c3`,
        timestamp: new Date(resolvedAt).toISOString(),
        actor: responder.name,
        message: 'Issue resolved.',
      });
    }

    issues.push({
      id: issueId,
      title: message,
      message,
      groupId: group.id,
      groupName: group.name,
      groupType: group.type,
      status,
      slaStatus,
      reportedBy: reporter,
      reportedAt: new Date(createdAt).toISOString(),
      responsibleTeam: group.responsibleTeam,
      conversation,
    });

    const timeline: SlaTimelineStep[] = [
      { id: `${slaId}-received`, label: 'Issue received', timestamp: new Date(createdAt).toISOString() },
      { id: `${slaId}-started`, label: 'SLA started', timestamp: new Date(createdAt).toISOString() },
      { id: `${slaId}-deadline`, label: 'SLA deadline', timestamp: new Date(deadline).toISOString() },
    ];
    if (responseAt !== null) {
      timeline.push({ id: `${slaId}-responded`, label: 'Response received', timestamp: new Date(responseAt).toISOString() });
    } else if (escalatedAt !== null) {
      timeline.push({ id: `${slaId}-missed`, label: 'SLA missed', timestamp: new Date(escalatedAt).toISOString() });
    }

    slaIncidents.push({
      id: slaId,
      issueTitle: message,
      groupId: group.id,
      groupName: group.name,
      groupType: group.type,
      triggeredAt: new Date(createdAt).toISOString(),
      slaDeadline: new Date(deadline).toISOString(),
      responseAt: responseAt === null ? null : new Date(responseAt).toISOString(),
      elapsedMinutes: Math.round((now - createdAt) / MIN),
      slaMinutes: group.slaMinutes,
      status: slaStatus,
      ceoNotified: slaStatus === 'MISSED',
      teamNotified: slaStatus === 'MISSED',
      timeline,
    });
  });

  const eodDeadlineIso = todayDeadlineIso();
  const eodReports: EodReport[] = EOD_PLAN.map((plan) => {
    const member = memberByKey.get(plan.member)!;
    const submitted = plan.status !== 'MISSING';
    return {
      id: submitted ? `eod-${plan.member}` : null,
      memberId: member.id,
      member: member.name,
      submitted,
      submittedAt: submitted ? new Date(now - plan.agoMin * MIN).toISOString() : null,
      status: plan.status,
      content: plan.content,
      reminders: [],
    };
  });

  return {
    groups,
    teamMembers,
    issues,
    slaIncidents,
    eodReports,
    slaIdByIssueId,
    complianceTrend: [88.9, 90.0, 89.2, 91.0, 90.5, 91.3],
    eodDeadlineLabel: '7:00 PM',
    eodDeadlineIso,
  };
}
