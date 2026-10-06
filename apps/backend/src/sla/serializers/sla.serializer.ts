import { ApiProperty } from '@nestjs/swagger';
import { GroupType } from '../../common/enums/group-type.enum';
import { SlaIncident } from '../entities/sla-incident.entity';
import { SlaStatus } from '../enums/sla-status.enum';
import { SlaTriggerType } from '../enums/sla-trigger-type.enum';

export class SlaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  messageId: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  issueId: string | null;

  @ApiProperty({ format: 'uuid' })
  groupId: string;

  @ApiProperty({
    description:
      'Snapshot of the group name at the time the SLA incident was created',
  })
  groupName: string;

  @ApiProperty({ enum: GroupType })
  groupType: GroupType;

  @ApiProperty({ enum: SlaTriggerType })
  triggerType: SlaTriggerType;

  @ApiProperty()
  senderPhone: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: SlaStatus })
  status: SlaStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  slaDeadline: Date;

  @ApiProperty({ nullable: true })
  firstResponseAt: Date | null;

  @ApiProperty({ nullable: true })
  respondedBy: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Also used as the "missed" timestamp — the schema does not have a separate missedAt column, ' +
      'so this is set the moment status transitions to MISSED (see docs/api-contract.md).',
  })
  escalatedAt: Date | null;

  @ApiProperty({ nullable: true })
  resolvedAt: Date | null;

  @ApiProperty({
    description:
      'now - createdAt, in whole minutes. Computed at request time (not stored) — always reflects ' +
      'wall-clock time relative to when the API call was made, not a frozen snapshot.',
  })
  elapsedMinutes: number;

  @ApiProperty({
    description:
      'slaDeadline - now, in whole minutes. Computed at request time; negative once the deadline has passed.',
  })
  remainingMinutes: number;
}

export function toSlaResponseDto(incident: SlaIncident): SlaResponseDto {
  const now = Date.now();
  return {
    id: incident.id,
    messageId: incident.messageId,
    issueId: incident.issueId,
    groupId: incident.groupId,
    groupName: incident.groupName,
    groupType: incident.groupType,
    triggerType: incident.triggerType,
    senderPhone: incident.senderPhone,
    message: incident.message,
    status: incident.status,
    createdAt: incident.createdAt,
    slaDeadline: incident.slaDeadline,
    firstResponseAt: incident.firstResponseAt,
    respondedBy: incident.respondedBy,
    escalatedAt: incident.escalatedAt,
    resolvedAt: incident.resolvedAt,
    elapsedMinutes: Math.round((now - incident.createdAt.getTime()) / 60_000),
    remainingMinutes: Math.round(
      (incident.slaDeadline.getTime() - now) / 60_000,
    ),
  };
}
