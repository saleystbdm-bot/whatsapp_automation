import type { GroupType, IssueStatus, SlaStatus } from '../types/domain';

export interface GroupMemberResponse {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  role: string;
  responsibility: string;
  active: boolean;
}

export interface KeywordResponse {
  id: string;
  groupId?: string;
  keyword: string;
  active: boolean;
}

export interface GroupResponse {
  id: string;
  whatsappGroupId: string;
  name: string;
  type: GroupType;
  active: boolean;
  slaMinutes: number;
  memberCount: number;
  members: GroupMemberResponse[];
  keywords: KeywordResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberResponse {
  id: string;
  name: string;
  phone: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueSlaSummary {
  id: string;
  status: SlaStatus;
  triggerType: 'MENTION' | 'MESSAGE';
  slaDeadline: string;
  firstResponseAt: string | null;
}

export interface IssueResponse {
  id: string;
  messageId: string;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  senderPhone: string;
  message: string;
  status: IssueStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  sla: IssueSlaSummary | null;
}

export interface IssueDetailResponse extends IssueResponse {
  responsibleTeam: { id: string; name: string; phone: string }[];
  timeline: { label: string; timestamp: string }[];
}

export interface SlaResponse {
  id: string;
  messageId: string;
  issueId: string | null;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  triggerType: 'MENTION' | 'MESSAGE';
  senderPhone: string;
  message: string;
  status: SlaStatus;
  createdAt: string;
  slaDeadline: string;
  firstResponseAt: string | null;
  respondedBy: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  elapsedMinutes: number;
  remainingMinutes: number;
}

export interface SlaSummaryResponse {
  total: number;
  open: number;
  responded: number;
  missed: number;
  escalated: number;
  resolved: number;
  compliancePercentage: number | null;
  averageResponseMinutes: number | null;
}

export interface EodResponse {
  id: string | null;
  memberId: string;
  memberName: string;
  phone: string;
  groupId: string;
  groupName: string;
  reportDate: string;
  submittedAt: string | null;
  status: 'ON_TIME' | 'LATE' | 'MISSING' | 'PENDING';
  reportContent: string | null;
  deadline: string;
  missing: boolean;
}

export interface EodReminderResponse {
  id: string;
  sentAt: string;
  status: string;
  message: string;
}

export interface EodDetailResponse extends EodResponse {
  reminders: EodReminderResponse[];
}

export interface EodSummaryResponse {
  totalMembers: number;
  submitted: number;
  onTime: number;
  late: number;
  missing: number;
  deadline: string;
  deadlinePassed: boolean;
  completionPercentage: number;
}

export interface LiveOperationResponse {
  issueId: string;
  message: string;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  issueStatus: IssueStatus;
  slaId: string | null;
  slaStatus: SlaStatus | null;
  createdAt: string;
  slaDeadline: string | null;
  firstResponseAt: string | null;
  elapsedMinutes: number;
  overdue: boolean;
}

export interface GroupActivityResponse {
  groupId: string;
  groupName: string;
  groupType: GroupType;
  active: boolean;
  memberCount: number;
  issueCount: number;
  activeIssueCount: number;
  slaCount: number;
  missedSlaCount: number;
}

export interface DashboardResponse {
  date: string;
  kpis: {
    activeIssues: number;
    slaCompliancePercentage: number | null;
    slaMissed: number;
    eodSubmitted: number;
    eodTotalMembers: number;
  };
  liveOperations: LiveOperationResponse[];
  slaPerformance: SlaSummaryResponse;
  groupActivity: GroupActivityResponse[];
  eodSnapshot: EodSummaryResponse;
}
