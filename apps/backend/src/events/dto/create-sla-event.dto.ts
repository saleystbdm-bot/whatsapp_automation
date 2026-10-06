import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { TrimString } from '../../common/validators/trim-string.decorator';
import { SlaTriggerType } from '../../sla/enums/sla-trigger-type.enum';

/**
 * n8n → POST /events/sla, once a mention (INTERNAL groups) or a detected
 * issue message (CLIENT groups) starts an SLA clock. Deliberately does
 * NOT accept a `slaDeadline` — the backend is the sole owner of that
 * calculation (Group.slaMinutes, resolved server-side), so n8n's own
 * timer can never disagree with the persisted deadline. `messageId` is
 * the idempotency key (SlaService.createFromEvent).
 */
export class CreateSlaEventDto {
  @ApiProperty({ description: 'WhatsApp message id (idempotency key)' })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId: string;

  @ApiProperty({ enum: SlaTriggerType })
  @IsEnum(SlaTriggerType)
  triggerType: SlaTriggerType;

  @ApiProperty({ example: '+919566831192' })
  @Matches(E164_PHONE_REGEX, {
    message: 'senderPhone must be in E.164 format, e.g. +919566831192',
  })
  senderPhone: string;

  @ApiProperty({ example: 'Payment API is not working' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The Issue this SLA tracks, if this trigger followed a POST /events/issues call for the same message.',
  })
  @IsOptional()
  @IsUUID()
  issueId?: string;

  @ApiPropertyOptional({
    description:
      "When the triggering message was sent. Defaults to now — the SLA deadline is computed from this plus the group's configured slaMinutes.",
  })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}
