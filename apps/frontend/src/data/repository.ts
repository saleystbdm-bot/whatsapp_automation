import { apiClient } from '../api/client';
import { formatTime } from '../lib/format';
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
  WhatsAppGroup,
} from '../types/domain';
import {
  mapDashboardResponse,
  mapEodResponse,
  mapGroupResponse,
  mapIssueResponse,
  mapSlaResponse,
  mapTeamMemberResponse,
} from './adapters';
import type {
  DashboardResponse,
  EodDetailResponse,
  EodResponse,
  EodSummaryResponse,
  GroupResponse,
  IssueDetailResponse,
  IssueResponse,
  SlaResponse,
  TeamMemberResponse,
} from './backend-types';

/**
 * Data access layer. Every read/write to the backend goes through here —
 * components and hooks never call the API client or fetch() directly, and
 * never import from `mock/`.
 */

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export async function getGroups(params?: {
  active?: boolean;
  type?: GroupType;
  search?: string;
}): Promise<MonitoredGroup[]> {
  const res = await apiClient.get<GroupResponse[]>('/groups', params);
  return res.map(mapGroupResponse);
}

export async function getGroup(id: string): Promise<MonitoredGroup> {
  const res = await apiClient.get<GroupResponse>(`/groups/${id}`);
  return mapGroupResponse(res);
}

export async function createGroup(input: {
  whatsappGroupId: string;
  name: string;
  type: GroupType;
  slaMinutes: number;
  memberIds?: string[];
  keywords?: string[];
}): Promise<MonitoredGroup> {
  const created = await apiClient.post<GroupResponse>('/groups', {
    whatsappGroupId: input.whatsappGroupId,
    name: input.name,
    type: input.type,
    slaMinutes: input.slaMinutes,
  });

  const memberIds = input.memberIds ?? [];
  const keywords = input.keywords ?? [];

  for (const memberId of memberIds) {
    await apiClient.post(`/groups/${created.id}/members`, { memberId });
  }
  for (const keyword of keywords) {
    await apiClient.post(`/groups/${created.id}/keywords`, { keyword });
  }

  const finalGroup =
    memberIds.length > 0 || keywords.length > 0
      ? await apiClient.get<GroupResponse>(`/groups/${created.id}`)
      : created;

  return mapGroupResponse(finalGroup);
}

export async function updateGroup(
  id: string,
  patch: { name?: string; type?: GroupType; slaMinutes?: number; active?: boolean },
): Promise<MonitoredGroup> {
  const res = await apiClient.patch<GroupResponse>(`/groups/${id}`, patch);
  return mapGroupResponse(res);
}

export function fetchAllGroups(): Promise<WhatsAppGroup[]> {
  return getGroups({ active: false });
}

export function fetchMonitoredGroups(): Promise<MonitoredGroup[]> {
  return getGroups({ active: true });
}

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------

export async function getTeamMembers(params?: { active?: boolean; search?: string }): Promise<TeamMember[]> {
  const res = await apiClient.get<TeamMemberResponse[]>('/team-members', params);
  return res.map(mapTeamMemberResponse);
}

export function fetchTeamMembers(): Promise<TeamMember[]> {
  return getTeamMembers();
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export interface IssueFilters {
  status?: IssueStatus;
  groupId?: string;
  groupType?: GroupType;
  search?: string;
  date?: string;
}

export async function getIssues(filters?: IssueFilters): Promise<Issue[]> {
  const res = await apiClient.get<IssueResponse[]>('/issues', filters);
  return res.map((issue) => mapIssueResponse(issue));
}

export async function getIssue(id: string): Promise<Issue> {
  const res = await apiClient.get<IssueDetailResponse>(`/issues/${id}`);
  return mapIssueResponse(res);
}

export async function updateIssueStatus(id: string, status: IssueStatus, resolvedBy?: string): Promise<Issue> {
  const res = await apiClient.patch<IssueDetailResponse>(`/issues/${id}`, {
    status,
    ...(resolvedBy ? { resolvedBy } : {}),
  });
  return mapIssueResponse(res);
}

export function fetchIssues(): Promise<Issue[]> {
  return getIssues();
}

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

export interface SlaFilters {
  status?: SlaStatus;
  groupId?: string;
  groupType?: GroupType;
  triggerType?: 'MENTION' | 'MESSAGE';
  date?: string;
}

export async function getSlaIncidents(filters?: SlaFilters): Promise<SlaIncident[]> {
  const res = await apiClient.get<SlaResponse[]>('/sla', filters);
  return res.map(mapSlaResponse);
}

export async function getSlaIncident(id: string): Promise<SlaIncident> {
  const res = await apiClient.get<SlaResponse>(`/sla/${id}`);
  return mapSlaResponse(res);
}

export async function respondSla(id: string, respondedBy?: string): Promise<SlaIncident> {
  const res = await apiClient.patch<SlaResponse>(`/sla/${id}`, {
    action: 'RESPOND',
    ...(respondedBy ? { respondedBy } : {}),
  });
  return mapSlaResponse(res);
}

export async function missSla(id: string): Promise<SlaIncident> {
  const res = await apiClient.patch<SlaResponse>(`/sla/${id}`, { action: 'MISS' });
  return mapSlaResponse(res);
}

export function fetchSlaIncidents(): Promise<SlaIncident[]> {
  return getSlaIncidents();
}

// ---------------------------------------------------------------------------
// EOD
// ---------------------------------------------------------------------------

export interface EodFilters {
  date?: string;
  groupId?: string;
  status?: EodStatus;
  memberId?: string;
}

export async function getEod(filters?: EodFilters): Promise<EodReport[]> {
  const res = await apiClient.get<EodResponse[]>('/eod', filters);
  return res.map((report) => mapEodResponse(report));
}

export async function getEodSummary(filters?: { date?: string; groupId?: string }): Promise<EodSummaryResponse> {
  return apiClient.get<EodSummaryResponse>('/eod/summary', filters);
}

export async function getEodReport(id: string): Promise<EodReport> {
  const res = await apiClient.get<EodDetailResponse>(`/eod/${id}`);
  return mapEodResponse(res);
}

export interface EodData {
  deadlineLabel: string;
  reports: EodReport[];
}

export async function fetchEodReports(date?: string): Promise<EodData> {
  const [reports, summary] = await Promise.all([getEod({ date }), getEodSummary({ date })]);
  return {
    deadlineLabel: formatTime(summary.deadline),
    reports,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(date?: string): Promise<DashboardData> {
  const res = await apiClient.get<DashboardResponse>('/dashboard', { date });
  return mapDashboardResponse(res);
}

export function fetchDashboardData(): Promise<DashboardData> {
  return getDashboard();
}
