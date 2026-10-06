import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getBusinessTimeZone } from '../common/config/business-config.util';
import { toBusinessDateString } from '../common/date/business-day.util';
import { EodService } from '../eod/eod.service';
import { GroupResponseDto } from '../groups/serializers/group.serializer';
import { GroupsService } from '../groups/groups.service';
import { IssueStatus } from '../issues/enums/issue-status.enum';
import { IssuesService } from '../issues/issues.service';
import { IssueResponseDto } from '../issues/serializers/issue.serializer';
import { SlaStatus } from '../sla/enums/sla-status.enum';
import { SlaService } from '../sla/sla.service';
import { SlaResponseDto } from '../sla/serializers/sla.serializer';
import {
  DashboardResponseDto,
  DashboardGroupActivityDto,
  DashboardLiveOperationDto,
} from './serializers/dashboard.serializer';

const ACTIVE_ISSUE_STATUSES: ReadonlySet<IssueStatus> = new Set([
  IssueStatus.OPEN,
  IssueStatus.IN_PROGRESS,
]);

/**
 * Pure aggregation layer: every number here is either taken verbatim from
 * an existing domain service's response (SlaService.summary(),
 * EodService.summary()) or computed by grouping the *results* of existing
 * domain queries (IssuesService.findAll(), SlaService.findAll(),
 * GroupsService.findAll()) in memory — never a second implementation of
 * SLA compliance, EOD eligibility, or issue/SLA status rules. See
 * docs/architecture.md "Dashboard Aggregation Layer".
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly issuesService: IssuesService,
    private readonly slaService: SlaService,
    private readonly eodService: EodService,
    private readonly groupsService: GroupsService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard(date?: string): Promise<DashboardResponseDto> {
    const businessDate =
      date ??
      toBusinessDateString(new Date(), getBusinessTimeZone(this.config));

    // Five independent reads, each already scoped to `businessDate` by the
    // owning service — run concurrently, not once per group/member (no N+1).
    const [issues, slaIncidents, slaPerformance, eodSnapshot, monitoredGroups] =
      await Promise.all([
        this.issuesService.findAll({ date: businessDate }),
        this.slaService.findAll({ date: businessDate }),
        this.slaService.summary({ date: businessDate }),
        this.eodService.summary({ date: businessDate }),
        this.groupsService.findAll({ active: true }),
      ]);

    const activeIssues = issues.filter((issue) =>
      ACTIVE_ISSUE_STATUSES.has(issue.status),
    );

    const kpis = {
      activeIssues: activeIssues.length,
      slaCompliancePercentage: slaPerformance.compliancePercentage,
      slaMissed: slaPerformance.missed,
      eodSubmitted: eodSnapshot.submitted,
      eodTotalMembers: eodSnapshot.totalMembers,
    };

    const liveOperations = activeIssues
      .map((issue) => this.toLiveOperation(issue))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const groupActivity = this.buildGroupActivity(
      monitoredGroups,
      issues,
      slaIncidents,
    );

    return {
      date: businessDate,
      kpis,
      liveOperations,
      slaPerformance,
      groupActivity,
      eodSnapshot,
    };
  }

  private toLiveOperation(issue: IssueResponseDto): DashboardLiveOperationDto {
    const now = Date.now();
    const sla = issue.sla;
    const overdue = sla
      ? sla.status === SlaStatus.MISSED ||
        (sla.status === SlaStatus.OPEN && now > sla.slaDeadline.getTime())
      : false;

    return {
      issueId: issue.id,
      message: issue.message,
      groupId: issue.groupId,
      groupName: issue.groupName,
      groupType: issue.groupType,
      issueStatus: issue.status,
      slaId: sla?.id ?? null,
      slaStatus: sla?.status ?? null,
      createdAt: issue.createdAt,
      slaDeadline: sla?.slaDeadline ?? null,
      firstResponseAt: sla?.firstResponseAt ?? null,
      elapsedMinutes: Math.round((now - issue.createdAt.getTime()) / 60_000),
      overdue,
    };
  }

  private buildGroupActivity(
    monitoredGroups: GroupResponseDto[],
    issues: IssueResponseDto[],
    slaIncidents: SlaResponseDto[],
  ): DashboardGroupActivityDto[] {
    const issuesByGroup = groupBy(issues, (issue) => issue.groupId);
    const slaByGroup = groupBy(slaIncidents, (incident) => incident.groupId);

    return monitoredGroups.map((group) => {
      const groupIssues = issuesByGroup.get(group.id) ?? [];
      const groupSla = slaByGroup.get(group.id) ?? [];

      return {
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        active: group.active,
        memberCount: group.memberCount,
        issueCount: groupIssues.length,
        activeIssueCount: groupIssues.filter((issue) =>
          ACTIVE_ISSUE_STATUSES.has(issue.status),
        ).length,
        slaCount: groupSla.length,
        missedSlaCount: groupSla.filter(
          (incident) => incident.status === SlaStatus.MISSED,
        ).length,
      };
    });
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}
