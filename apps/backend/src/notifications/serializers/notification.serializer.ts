import { ApiProperty } from '@nestjs/swagger';
import { Notification } from '../entities/notification.entity';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * Notification *intent/state*, as owned by NestJS — never proof that a
 * WhatsApp message was actually delivered. `status` starts PENDING when
 * NestJS creates the row (e.g. an SLA-missed fan-out); n8n/Wassenger is
 * responsible for the actual send and reports the outcome back via
 * POST /events/notifications, which transitions this same row to
 * SENT/FAILED (see docs/api-contract.md).
 */
export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty({ example: '+919566831192' })
  recipientPhone: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  issueId: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  slaId: string | null;

  @ApiProperty({ enum: NotificationStatus })
  status: NotificationStatus;

  @ApiProperty({ nullable: true })
  sentAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export function toNotificationResponseDto(
  notification: Notification,
): NotificationResponseDto {
  return {
    id: notification.id,
    type: notification.type,
    recipientPhone: notification.recipientPhone,
    message: notification.message,
    issueId: notification.issueId,
    slaId: notification.slaId,
    status: notification.status,
    sentAt: notification.sentAt,
    createdAt: notification.createdAt,
  };
}
