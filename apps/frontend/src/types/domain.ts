export type GroupType = 'INTERNAL' | 'CLIENT';

export interface WhatsAppGroup {
  id: string;
  whatsappGroupId: string;
  name: string;
  memberCount: number;
  type: GroupType;
}

export interface TeamMember {
  id: string;
  name: string;
  phone: string;
}

export interface MonitoredGroup extends WhatsAppGroup {
  slaMinutes: number;
  active: boolean;
  responsibleTeam: TeamMember[];
  keywords: string[];
}

export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type SlaStatus = 'OPEN' | 'RESPONDED' | 'MISSED' | 'ESCALATED' | 'RESOLVED';

export interface ConversationEvent {
  id: string;
  timestamp: string;
  actor: string;
  message: string;
}

export interface Issue {
  id: string;
  title: string;
  message: string;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  status: IssueStatus;
  slaStatus: SlaStatus | null;
  reportedBy: string;
  reportedAt: string;
  responsibleTeam: TeamMember[];
  conversation: ConversationEvent[];
}

export interface SlaTimelineStep {
  id: string;
  label: string;
  timestamp: string;
}

export interface SlaIncident {
  id: string;
  issueTitle: string;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  triggeredAt: string;
  slaDeadline: string;
  responseAt: string | null;
  elapsedMinutes: number;
  slaMinutes: number;
  status: SlaStatus;
  ceoNotified: boolean | null;
  teamNotified: boolean | null;
  timeline: SlaTimelineStep[];
}

export type EodStatus = 'ON_TIME' | 'LATE' | 'MISSING' | 'PENDING';

export interface ReminderEvent {
  id: string;
  timestamp: string;
  label: string;
}

export interface EodReport {
  id: string | null;
  memberId: string;
  member: string;
  submitted: boolean;
  submittedAt: string | null;
  status: EodStatus;
  content: string[];
  reminders: ReminderEvent[];
}

export interface DashboardKpis {
  activeIssues: number;
  activeIssuesDelta: string;
  slaCompliance: number;
  slaComplianceContext: string;
  slaMissed: number;
  slaMissedContext: string;
  eodSubmitted: number;
  eodTotal: number;
  eodContext: string;
}

export interface LiveOperationItem {
  id: string;
  issueTitle: string;
  groupName: string;
  elapsedLabel: string;
  remainingLabel?: string;
  status: SlaStatus | null;
}

export interface SlaPerformance {
  compliance: number;
  totalIssues: number;
  responded: number;
  missed: number;
  open: number;
  averageResponseMinutes: number;
  trend: number[];
}

export interface GroupActivityItem {
  groupName: string;
  count: number;
}

export interface EodSnapshot {
  submitted: number;
  total: number;
  late: number;
  missing: number;
  deadline: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  liveOperations: LiveOperationItem[];
  slaPerformance: SlaPerformance;
  groupActivity: GroupActivityItem[];
  eodSnapshot: EodSnapshot;
}
