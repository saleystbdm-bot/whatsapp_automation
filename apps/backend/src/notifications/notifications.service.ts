import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationType } from './enums/notification-type.enum';

export interface CreateNotificationInput {
  type: NotificationType;
  recipientPhone: string;
  message: string;
  issueId?: string | null;
  slaId?: string | null;
  status?: NotificationStatus;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    const notification = this.notifications.create({
      type: input.type,
      recipientPhone: input.recipientPhone,
      message: input.message,
      issueId: input.issueId ?? null,
      slaId: input.slaId ?? null,
      status: input.status ?? NotificationStatus.PENDING,
    });
    return this.notifications.save(notification);
  }

  findAll(): Promise<Notification[]> {
    return this.notifications.find();
  }

  findForSlaIncident(slaId: string): Promise<Notification[]> {
    return this.notifications.find({ where: { slaId } });
  }

  findForIssue(issueId: string): Promise<Notification[]> {
    return this.notifications.find({ where: { issueId } });
  }

  /**
   * Transitions an existing PENDING notification to its actual dispatch
   * outcome, as reported by n8n after it attempts the real WhatsApp send
   * (see docs/api-contract.md, POST /events/notifications). This updates
   * the existing row — it never creates a new Notification, which would
   * otherwise turn "NestJS creates intent → n8n sends → n8n reports" into
   * an unbounded loop of notification rows for the same event.
   */
  async updateDispatchStatus(
    id: string,
    status: NotificationStatus.SENT | NotificationStatus.FAILED,
    sentAt: Date,
  ): Promise<Notification> {
    const notification = await this.notifications.findOneBy({ id });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    notification.status = status;
    if (status === NotificationStatus.SENT) {
      notification.sentAt = sentAt;
    }
    return this.notifications.save(notification);
  }
}
