import { ApiProperty } from '@nestjs/swagger';
import { GroupType } from '../../common/enums/group-type.enum';
import { SlaIncident } from '../../sla/entities/sla-incident.entity';
import { SlaStatus } from '../../sla/enums/sla-status.enum';
import { SlaTriggerType } from '../../sla/enums/sla-trigger-type.enum';
import { Issue } from '../entities/issue.entity';
import { IssueStatus } from '../enums/issue-status.enum';

export class IssueSlaSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SlaStatus })
  status: SlaStatus;

  @ApiProperty({ enum: SlaTriggerType })
  triggerType: SlaTriggerType;

  @ApiProperty()
  slaDeadline: Date;

  @ApiProperty({ nullable: true })
  firstResponseAt: Date | null;
}

export class IssueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  messageId: string;

  @ApiProperty({ format: 'uuid' })
  groupId: string;

  @ApiProperty({
    description:
      'Current group name, resolved live (not a historical snapshot)',
  })
  groupName: string;

  @ApiProperty({
    enum: GroupType,
    description:
      'Snapshot of the group type at the time the issue was reported',
  })
  groupType: GroupType;

  @ApiProperty()
  senderPhone: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: IssueStatus })
  status: IssueStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({ nullable: true })
  resolvedBy: string | null;

  @ApiProperty({ type: IssueSlaSummaryDto, nullable: true })
  sla: IssueSlaSummaryDto | null;
}

export class IssueTeamMemberDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;
}

export class IssueTimelineEventDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  timestamp: Date;
}

export class IssueDetailResponseDto extends IssueResponseDto {
  @ApiProperty({ type: [IssueTeamMemberDto] })
  responsibleTeam: IssueTeamMemberDto[];

  @ApiProperty({
    type: [IssueTimelineEventDto],
    description:
      'Only events actually persisted for this issue — "reported" and, if applicable, "resolved". ' +
      'No fabricated conversation history: the schema does not store a per-message chat log.',
  })
  timeline: IssueTimelineEventDto[];
}

function toSlaSummary(sla: SlaIncident | null): IssueSlaSummaryDto | null {
  if (!sla) return null;
  return {
    id: sla.id,
    status: sla.status,
    triggerType: sla.triggerType,
    slaDeadline: sla.slaDeadline,
    firstResponseAt: sla.firstResponseAt,
  };
}

export function toIssueResponseDto(
  issue: Issue,
  groupName: string,
  sla: SlaIncident | null,
): IssueResponseDto {
  return {
    id: issue.id,
    messageId: issue.messageId,
    groupId: issue.groupId,
    groupName,
    groupType: issue.groupType,
    senderPhone: issue.senderPhone,
    message: issue.message,
    status: issue.status,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    resolvedAt: issue.resolvedAt,
    resolvedBy: issue.resolvedBy,
    sla: toSlaSummary(sla),
  };
}

export function toIssueDetailResponseDto(
  issue: Issue,
  groupName: string,
  sla: SlaIncident | null,
  responsibleTeam: IssueTeamMemberDto[],
): IssueDetailResponseDto {
  const timeline: IssueTimelineEventDto[] = [
    { label: 'Issue reported', timestamp: issue.createdAt },
  ];
  if (issue.resolvedAt) {
    timeline.push({ label: 'Issue resolved', timestamp: issue.resolvedAt });
  }

  return {
    ...toIssueResponseDto(issue, groupName, sla),
    responsibleTeam,
    timeline,
  };
}
