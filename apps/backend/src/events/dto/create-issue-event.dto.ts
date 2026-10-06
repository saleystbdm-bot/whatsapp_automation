import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';
import { TrimString } from '../../common/validators/trim-string.decorator';

/**
 * n8n → POST /events/issues, once a client/internal issue message has been
 * detected. `messageId` is the idempotency key — a replayed webhook for
 * the same WhatsApp message returns the existing Issue rather than
 * creating a duplicate (IssuesService.createFromEvent).
 */
export class CreateIssueEventDto {
  @ApiProperty({ description: 'WhatsApp message id (idempotency key)' })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The monitored Group this message belongs to',
  })
  @IsUUID()
  groupId: string;

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
    description: 'When the message was actually sent. Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}
