import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getBusinessTimeZone } from '../common/config/business-config.util';
import { isUniqueViolation } from '../common/database/postgres-error.util';
import { getBusinessDayRange } from '../common/date/business-day.util';
import { GroupsService } from '../groups/groups.service';
import { IssuesService } from '../issues/issues.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { SlaQueryDto } from './dto/sla-query.dto';
import { SlaSummaryQueryDto } from './dto/sla-summary-query.dto';
import { SlaIncident } from './entities/sla-incident.entity';
import { SlaStatus } from './enums/sla-status.enum';
import { SlaTriggerType } from './enums/sla-trigger-type.enum';
import { SlaSummaryResponseDto } from './serializers/sla-summary.serializer';
import { SlaResponseDto, toSlaResponseDto } from './serializers/sla.serializer';

export interface CreateSlaFromEventInput {
  messageId: string;
  groupId: string;
  triggerType: SlaTriggerType;
  senderPhone: string;
  message: string;
  slaDeadline: Date;
  issueId?: string | null;
  /** Defaults to now. Lets a replayed/backfilled event carry its original timestamp. */
  createdAt?: Date;
}

const DEFAULT_CEO_PHONE = '+10000000000';

/**
 * Terminal/settled statuses that markResponded/markMissed must not
 * silently override — both operations are idempotent no-ops once the
 * incident has already reached one of these.
 */
const SETTLED_STATUSES = new Set<SlaStatus>([
  SlaStatus.RESPONDED,
  SlaStatus.MISSED,
  SlaStatus.ESCALATED,
  SlaStatus.RESOLVED,
]);

@Injectable()
export class SlaService {
  constructor(
    @InjectRepository(SlaIncident)
    private readonly slaIncidents: Repository<SlaIncident>,
    private readonly groupsService: GroupsService,
    private readonly issuesService: IssuesService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent creation for the (future) n8n event path — mirrors
   * IssuesService.createFromEvent. `messageId` is the idempotency key: a
   * single WhatsApp message maps to at most one SLA incident. `issueId`
   * is optional — a MENTION-triggered SLA is not required to have an
   * Issue behind it.
   */
  async createFromEvent(input: CreateSlaFromEventInput): Promise<SlaIncident> {
    const existing = await this.slaIncidents.findOneBy({
      messageId: input.messageId,
    });
    if (existing) return existing;

    const group = await this.groupsService.getEntityOrThrow(input.groupId);

    if (input.issueId) {
      const issue = await this.issuesService.findById(input.issueId);
      if (!issue) {
        throw new NotFoundException(`Issue ${input.issueId} not found`);
      }
    }

    const incident = this.slaIncidents.create({
      messageId: input.messageId,
      issueId: input.issueId ?? null,
      groupId: group.id,
      groupName: group.name,
      groupType: group.type,
      triggerType: input.triggerType,
      senderPhone: input.senderPhone,
      message: input.message,
      slaDeadline: input.slaDeadline,
      status: SlaStatus.OPEN,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    });

    try {
      return await this.slaIncidents.save(incident);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.slaIncidents.findOneBy({
          messageId: input.messageId,
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  async findAll(query: SlaQueryDto = {}): Promise<SlaResponseDto[]> {
    const qb = this.buildFilteredQuery(query);
    qb.orderBy('sla.createdAt', 'DESC');
    const incidents = await qb.getMany();
    return incidents.map(toSlaResponseDto);
  }

  async findOne(id: string): Promise<SlaResponseDto> {
    const incident = await this.getEntityOrThrow(id);
    return toSlaResponseDto(incident);
  }

  /** Internal helper for the n8n event boundary (looks up by WhatsApp messageId, not id). */
  findByMessageId(messageId: string): Promise<SlaIncident | null> {
    return this.slaIncidents.findOneBy({ messageId });
  }

  /**
   * Records the first response to an SLA-tracked message.
   *
   * - Idempotent: if `firstResponseAt` is already set, this is a no-op —
   *   only the *first* response establishes it, later calls never
   *   overwrite it (per product requirement).
   * - If the incident is already MISSED/ESCALATED/RESOLVED, the response
   *   timestamp is still recorded (so we know *when* the late reply
   *   happened) but the status is left as-is — a late response must never
   *   flip a missed SLA back to RESPONDED.
   * - Otherwise, the response time is compared against `slaDeadline`: on
   *   time → RESPONDED; already past the deadline (e.g. no separate
   *   `miss()` call ever arrived) → MISSED, and this is treated as a
   *   fresh miss for notification purposes (see markMissedNotifications).
   */
  async respond(
    id: string,
    respondedBy?: string,
    responseAt: Date = new Date(),
  ): Promise<SlaResponseDto> {
    const incident = await this.getEntityOrThrow(id);

    if (incident.firstResponseAt) {
      return toSlaResponseDto(incident);
    }

    incident.firstResponseAt = responseAt;
    incident.respondedBy = respondedBy ?? null;

    const wasOpen = incident.status === SlaStatus.OPEN;
    if (SETTLED_STATUSES.has(incident.status)) {
      // Already MISSED/ESCALATED/RESOLVED — record the late response, keep the status.
    } else if (responseAt.getTime() <= incident.slaDeadline.getTime()) {
      incident.status = SlaStatus.RESPONDED;
    } else {
      incident.status = SlaStatus.MISSED;
      incident.escalatedAt = incident.escalatedAt ?? responseAt;
    }

    const saved = await this.slaIncidents.save(incident);

    if (wasOpen && saved.status === SlaStatus.MISSED) {
      await this.fanOutMissedNotifications(saved);
    }

    return toSlaResponseDto(saved);
  }

  /**
   * Marks an SLA-tracked message as missed. Idempotent: a no-op if the
   * incident has already settled (RESPONDED/MISSED/ESCALATED/RESOLVED) —
   * in particular, an incident that was already RESPONDED in time is
   * never retroactively marked MISSED by a stale/out-of-order event.
   * Only an actual OPEN → MISSED transition fans out notifications, so
   * duplicate "missed" events never double-notify the CEO/team.
   */
  async miss(id: string, missedAt: Date = new Date()): Promise<SlaResponseDto> {
    const incident = await this.getEntityOrThrow(id);

    if (SETTLED_STATUSES.has(incident.status)) {
      return toSlaResponseDto(incident);
    }

    incident.status = SlaStatus.MISSED;
    incident.escalatedAt = missedAt;
    const saved = await this.slaIncidents.save(incident);

    await this.fanOutMissedNotifications(saved);

    return toSlaResponseDto(saved);
  }

  async summary(
    query: SlaSummaryQueryDto = {},
  ): Promise<SlaSummaryResponseDto> {
    const qb = this.buildFilteredQuery(query);
    const incidents = await qb.getMany();

    const counts = {
      total: incidents.length,
      open: 0,
      responded: 0,
      missed: 0,
      escalated: 0,
      resolved: 0,
    };
    for (const incident of incidents) {
      switch (incident.status) {
        case SlaStatus.OPEN:
          counts.open++;
          break;
        case SlaStatus.RESPONDED:
          counts.responded++;
          break;
        case SlaStatus.MISSED:
          counts.missed++;
          break;
        case SlaStatus.ESCALATED:
          counts.escalated++;
          break;
        case SlaStatus.RESOLVED:
          counts.resolved++;
          break;
      }
    }

    const complianceDenominator = counts.responded + counts.missed;
    const compliancePercentage =
      complianceDenominator > 0
        ? Math.round((counts.responded / complianceDenominator) * 1000) / 10
        : null;

    const responseDurationsMinutes = incidents
      .filter((incident) => incident.firstResponseAt !== null)
      .map(
        (incident) =>
          (incident.firstResponseAt!.getTime() - incident.createdAt.getTime()) /
          60_000,
      )
      // Guard against corrupt/invalid data (a response timestamp before creation).
      .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);

    const averageResponseMinutes =
      responseDurationsMinutes.length > 0
        ? Math.round(
            (responseDurationsMinutes.reduce(
              (sum, minutes) => sum + minutes,
              0,
            ) /
              responseDurationsMinutes.length) *
              10,
          ) / 10
        : null;

    return { ...counts, compliancePercentage, averageResponseMinutes };
  }

  private async getEntityOrThrow(id: string): Promise<SlaIncident> {
    const incident = await this.slaIncidents.findOneBy({ id });
    if (!incident) {
      throw new NotFoundException(`SLA incident ${id} not found`);
    }
    return incident;
  }

  private buildFilteredQuery(query: SlaQueryDto | SlaSummaryQueryDto) {
    const qb = this.slaIncidents.createQueryBuilder('sla');
    if ('status' in query && query.status !== undefined) {
      qb.andWhere('sla.status = :status', { status: query.status });
    }
    if (query.groupId !== undefined) {
      qb.andWhere('sla.groupId = :groupId', { groupId: query.groupId });
    }
    if (query.groupType !== undefined) {
      qb.andWhere('sla.groupType = :groupType', { groupType: query.groupType });
    }
    if ('triggerType' in query && query.triggerType !== undefined) {
      qb.andWhere('sla.triggerType = :triggerType', {
        triggerType: query.triggerType,
      });
    }
    if (query.date) {
      const { start, end } = getBusinessDayRange(
        query.date,
        this.businessTimeZone(),
      );
      qb.andWhere('sla.createdAt >= :start AND sla.createdAt < :end', {
        start,
        end,
      });
    }
    return qb;
  }

  /**
   * Fans out notification records for a newly-missed SLA incident: one
   * CEO_SLA_ALERT plus one TEAM_SLA_REMINDER per active responsible team
   * member of the group. This creates Notification rows only — it never
   * creates another SlaIncident, and it never sends a real WhatsApp
   * message (that remains n8n/Wassenger's job in a later phase).
   */
  private async fanOutMissedNotifications(
    incident: SlaIncident,
  ): Promise<void> {
    const ceoPhone = this.config.get<string>(
      'CEO_PHONE_NUMBER',
      DEFAULT_CEO_PHONE,
    );
    const summary = `SLA missed in ${incident.groupName}: ${incident.message}`;

    await this.notificationsService.create({
      type: NotificationType.CEO_SLA_ALERT,
      recipientPhone: ceoPhone,
      message: summary,
      slaId: incident.id,
      issueId: incident.issueId,
    });

    const members = await this.groupsService.findMembersForGroup(
      incident.groupId,
    );
    const activePhones = new Set(
      members.filter((member) => member.active).map((member) => member.phone),
    );
    for (const phone of activePhones) {
      await this.notificationsService.create({
        type: NotificationType.TEAM_SLA_REMINDER,
        recipientPhone: phone,
        message: summary,
        slaId: incident.id,
        issueId: incident.issueId,
      });
    }
  }

  private businessTimeZone(): string {
    return getBusinessTimeZone(this.config);
  }
}
