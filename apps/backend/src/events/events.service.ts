import { Injectable, NotFoundException } from '@nestjs/common';
import { EodDetailResponseDto } from '../eod/serializers/eod.serializer';
import { EodService } from '../eod/eod.service';
import { GroupsService } from '../groups/groups.service';
import { IssueDetailResponseDto } from '../issues/serializers/issue.serializer';
import { IssuesService } from '../issues/issues.service';
import {
  NotificationResponseDto,
  toNotificationResponseDto,
} from '../notifications/serializers/notification.serializer';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaIncident } from '../sla/entities/sla-incident.entity';
import { SlaStatus } from '../sla/enums/sla-status.enum';
import { SlaService } from '../sla/sla.service';
import { SlaResponseDto } from '../sla/serializers/sla.serializer';
import { CreateEodEventDto } from './dto/create-eod-event.dto';
import { CreateIssueEventDto } from './dto/create-issue-event.dto';
import { CreateSlaEventDto } from './dto/create-sla-event.dto';
import { RecordNotificationEventDto } from './dto/record-notification-event.dto';
import { SlaMissedEventDto } from './dto/sla-missed-event.dto';
import { SlaRespondedEventDto } from './dto/sla-responded-event.dto';

export interface SlaMissedEventResult {
  sla: SlaResponseDto;
  /**
   * The CEO/team Notification rows fanned out by this transition (empty
   * if the incident had already settled — see SlaService.miss). n8n reads
   * these to know exactly who to message and with what, rather than
   * reconstructing business state itself (see docs/api-contract.md).
   */
  notifications: NotificationResponseDto[];
}

/**
 * The n8n → NestJS event boundary (docs/api-contract.md "n8n Events").
 * Every method here is a thin translation layer: validate/resolve input,
 * delegate the actual business rule to the owning domain service
 * (IssuesService/SlaService/EodService — unchanged from Phase 2C/2D), and
 * return that service's existing public response shape. No business rule
 * is duplicated here.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly issuesService: IssuesService,
    private readonly slaService: SlaService,
    private readonly eodService: EodService,
    private readonly groupsService: GroupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createIssueEvent(
    dto: CreateIssueEventDto,
  ): Promise<IssueDetailResponseDto> {
    const issue = await this.issuesService.createFromEvent({
      messageId: dto.messageId,
      groupId: dto.groupId,
      senderPhone: dto.senderPhone,
      message: dto.message,
      createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
    });
    return this.issuesService.findOne(issue.id);
  }

  /**
   * The backend — never n8n — computes `slaDeadline`, from the group's
   * configured `slaMinutes` (see Group entity). This is deliberate: if
   * n8n's own timer calculated a deadline too, the two could disagree:
   * the persisted deadline here is always authoritative.
   */
  async createSlaEvent(dto: CreateSlaEventDto): Promise<SlaResponseDto> {
    const group = await this.groupsService.getEntityOrThrow(dto.groupId);
    const createdAt = dto.createdAt ? new Date(dto.createdAt) : new Date();
    const slaDeadline = new Date(
      createdAt.getTime() + group.slaMinutes * 60_000,
    );

    const incident = await this.slaService.createFromEvent({
      messageId: dto.messageId,
      groupId: dto.groupId,
      triggerType: dto.triggerType,
      senderPhone: dto.senderPhone,
      message: dto.message,
      slaDeadline,
      issueId: dto.issueId ?? null,
      // Always pass the same `createdAt` used to compute slaDeadline above —
      // leaving this undefined would let the DB's own now() set createdAt a
      // few milliseconds later than the value the deadline was derived
      // from, so `slaDeadline - createdAt` would no longer equal exactly
      // group.slaMinutes.
      createdAt,
    });
    return this.slaService.findOne(incident.id);
  }

  async markSlaResponded(
    messageId: string,
    dto: SlaRespondedEventDto,
  ): Promise<SlaResponseDto> {
    const incident = await this.findSlaByMessageIdOrThrow(messageId);
    return this.slaService.respond(
      incident.id,
      dto.respondedBy,
      dto.responseAt ? new Date(dto.responseAt) : undefined,
    );
  }

  async markSlaMissed(
    messageId: string,
    dto: SlaMissedEventDto,
  ): Promise<SlaMissedEventResult> {
    const incident = await this.findSlaByMessageIdOrThrow(messageId);
    // SlaService.miss() only actually fans out notifications on a genuine
    // OPEN → MISSED transition (see its own idempotency check) — capture
    // that here too, so a duplicate/idempotent call reports back an empty
    // notifications array instead of re-listing already-fanned-out rows,
    // which would otherwise invite n8n to re-send the same WhatsApp
    // message on every replayed webhook.
    const wasAlreadySettled = incident.status !== SlaStatus.OPEN;

    const sla = await this.slaService.miss(
      incident.id,
      dto.missedAt ? new Date(dto.missedAt) : undefined,
    );

    if (wasAlreadySettled) {
      return { sla, notifications: [] };
    }

    const notifications = await this.notificationsService.findForSlaIncident(
      incident.id,
    );
    return {
      sla,
      notifications: notifications.map(toNotificationResponseDto),
    };
  }

  async createEodEvent(dto: CreateEodEventDto): Promise<EodDetailResponseDto> {
    const report = await this.eodService.createFromEvent({
      messageId: dto.messageId,
      memberId: dto.memberId,
      groupId: dto.groupId,
      reportContent: dto.reportContent,
      submittedAt: new Date(dto.submittedAt),
    });
    return this.eodService.findOne(report.id);
  }

  async recordNotificationDispatch(
    dto: RecordNotificationEventDto,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationsService.updateDispatchStatus(
      dto.notificationId,
      dto.status,
      dto.sentAt ? new Date(dto.sentAt) : new Date(),
    );
    return toNotificationResponseDto(notification);
  }

  private async findSlaByMessageIdOrThrow(
    messageId: string,
  ): Promise<SlaIncident> {
    const incident = await this.slaService.findByMessageId(messageId);
    if (!incident) {
      throw new NotFoundException(
        `No SLA incident found for message ${messageId}`,
      );
    }
    return incident;
  }
}
