import { ApiProperty } from '@nestjs/swagger';
import {
  EOD_DISPLAY_STATUS_VALUES,
  EodDisplayStatus,
} from '../enums/eod-display-status';

/**
 * One row for a specific (member, business date) pair. `id` is null when
 * the row is *computed* (MISSING or PENDING — no eod_reports row exists
 * for this member/date yet) rather than persisted — see
 * docs/api-contract.md for why no synthetic DB row is created for these.
 */
export class EodResponseDto {
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'null for a computed (not yet submitted) entry',
  })
  id: string | null;

  @ApiProperty({ format: 'uuid' })
  memberId: string;

  @ApiProperty()
  memberName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ format: 'uuid' })
  groupId: string;

  @ApiProperty()
  groupName: string;

  @ApiProperty({ example: '2026-09-22' })
  reportDate: string;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ enum: EOD_DISPLAY_STATUS_VALUES })
  status: EodDisplayStatus;

  @ApiProperty({
    nullable: true,
    description: 'Exactly as submitted — never summarized or rewritten',
  })
  reportContent: string | null;

  @ApiProperty({
    description:
      "UTC instant of that business date's deadline (BUSINESS_TIMEZONE + EOD_DEADLINE)",
  })
  deadline: Date;

  @ApiProperty({ description: 'true iff status === MISSING' })
  missing: boolean;
}

export class EodReminderDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true })
  sentAt: Date | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  message: string;
}

export class EodDetailResponseDto extends EodResponseDto {
  @ApiProperty({
    type: [EodReminderDto],
    description:
      'EOD_REMINDER notifications sent to this member on this business date, if any. Always empty until ' +
      'the n8n integration phase actually creates them — see docs/api-contract.md.',
  })
  reminders: EodReminderDto[];
}
