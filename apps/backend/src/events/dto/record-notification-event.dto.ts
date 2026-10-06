import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { NotificationStatus } from '../../notifications/enums/notification-status.enum';

const DISPATCH_OUTCOMES = [
  NotificationStatus.SENT,
  NotificationStatus.FAILED,
] as const;
type DispatchOutcome = (typeof DISPATCH_OUTCOMES)[number];

/**
 * n8n → POST /events/notifications, after it has actually attempted to
 * send a WhatsApp message for a notification NestJS previously created as
 * PENDING (returned from the SLA-missed response, see
 * docs/api-contract.md). Updates that existing row's dispatch state — it
 * never creates a new Notification, which would otherwise loop forever
 * (NestJS creates → n8n reports → NestJS creates another…).
 */
export class RecordNotificationEventDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The Notification id returned when it was created',
  })
  @IsUUID()
  notificationId: string;

  @ApiProperty({ enum: DISPATCH_OUTCOMES })
  @IsIn(DISPATCH_OUTCOMES)
  status: DispatchOutcome;

  @ApiPropertyOptional({
    description:
      'When the message was actually sent. Only meaningful when status = SENT. Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  sentAt?: string;
}
