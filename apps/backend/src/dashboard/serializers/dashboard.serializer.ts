import { ApiProperty } from '@nestjs/swagger';
import { GroupType } from '../../common/enums/group-type.enum';
import { IssueStatus } from '../../issues/enums/issue-status.enum';
import { EodSummaryResponseDto } from '../../eod/serializers/eod-summary.serializer';
import { SlaStatus } from '../../sla/enums/sla-status.enum';
import { SlaSummaryResponseDto } from '../../sla/serializers/sla-summary.serializer';

export class DashboardKpiDto {
  @ApiProperty({
    description:
      'Issues with status OPEN or IN_PROGRESS for the selected business date',
  })
  activeIssues: number;

  @ApiProperty({
    nullable: true,
    description:
      'Same value as slaPerformance.compliancePercentage (SlaService.summary()) — never recomputed ' +
      'separately. null when there is no RESPONDED/MISSED incident yet to measure.',
  })
  slaCompliancePercentage: number | null;

  @ApiProperty({ description: 'Same value as slaPerformance.missed' })
  slaMissed: number;

  @ApiProperty({ description: 'Same value as eodSnapshot.submitted' })
  eodSubmitted: number;

  @ApiProperty({ description: 'Same value as eodSnapshot.totalMembers' })
  eodTotalMembers: number;
}

export class DashboardLiveOperationDto {
  @ApiProperty({ format: 'uuid' })
  issueId: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ format: 'uuid' })
  groupId: string;

  @ApiProperty()
  groupName: string;

  @ApiProperty({ enum: GroupType })
  groupType: GroupType;

  @ApiProperty({ enum: IssueStatus })
  issueStatus: IssueStatus;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'null if no SLA incident tracks this issue',
  })
  slaId: string | null;

  @ApiProperty({ enum: SlaStatus, nullable: true })
  slaStatus: SlaStatus | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  slaDeadline: Date | null;

  @ApiProperty({ nullable: true })
  firstResponseAt: Date | null;

  @ApiProperty({
    description:
      'now - createdAt, in whole minutes. Computed at request time, not stored.',
  })
  elapsedMinutes: number;

  @ApiProperty({
    description:
      'true if the SLA is MISSED, or is still OPEN but past its deadline. false if there is no SLA, or ' +
      'the SLA was RESPONDED/ESCALATED/RESOLVED.',
  })
  overdue: boolean;
}

export class DashboardGroupActivityDto {
  @ApiProperty({ format: 'uuid' })
  groupId: string;

  @ApiProperty()
  groupName: string;

  @ApiProperty({ enum: GroupType })
  groupType: GroupType;

  @ApiProperty({
    description: 'Monitoring status (Group.active) — see docs/architecture.md',
  })
  active: boolean;

  @ApiProperty({
    description:
      'Count of active responsible team members (from GroupsService)',
  })
  memberCount: number;

  @ApiProperty({
    description: 'Issues reported in this group on the selected business date',
  })
  issueCount: number;

  @ApiProperty({
    description: 'Of issueCount, those still OPEN or IN_PROGRESS',
  })
  activeIssueCount: number;

  @ApiProperty({
    description:
      'SLA incidents started in this group on the selected business date',
  })
  slaCount: number;

  @ApiProperty({ description: 'Of slaCount, those with status MISSED' })
  missedSlaCount: number;
}

export class DashboardResponseDto {
  @ApiProperty({
    example: '2026-09-22',
    description: 'The business date this dashboard reflects',
  })
  date: string;

  @ApiProperty({ type: DashboardKpiDto })
  kpis: DashboardKpiDto;

  @ApiProperty({
    type: [DashboardLiveOperationDto],
    description:
      'Every OPEN/IN_PROGRESS issue for the selected business date, most recent first',
  })
  liveOperations: DashboardLiveOperationDto[];

  @ApiProperty({
    type: SlaSummaryResponseDto,
    description:
      'Identical to GET /sla/summary?date=... — never recomputed differently here',
  })
  slaPerformance: SlaSummaryResponseDto;

  @ApiProperty({
    type: [DashboardGroupActivityDto],
    description: 'One row per currently-monitored (active) group',
  })
  groupActivity: DashboardGroupActivityDto[];

  @ApiProperty({
    type: EodSummaryResponseDto,
    description:
      'Identical to GET /eod/summary?date=... — never recomputed differently here',
  })
  eodSnapshot: EodSummaryResponseDto;
}
