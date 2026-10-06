import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  getBusinessTimeZone,
  getEodDeadline,
} from '../common/config/business-config.util';
import { isUniqueViolation } from '../common/database/postgres-error.util';
import {
  getBusinessDayDeadline,
  getBusinessDayRange,
  isValidDateOnly,
  toBusinessDateString,
} from '../common/date/business-day.util';
import { GroupType } from '../common/enums/group-type.enum';
import { GroupMember } from '../groups/entities/group-member.entity';
import { GroupsService } from '../groups/groups.service';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { TeamMembersService } from '../team-members/team-members.service';
import { EodQueryDto } from './dto/eod-query.dto';
import { EodSummaryQueryDto } from './dto/eod-summary-query.dto';
import { EodReport } from './entities/eod-report.entity';
import { EOD_PENDING, EodDisplayStatus } from './enums/eod-display-status';
import { EodStatus } from './enums/eod-status.enum';
import {
  EodDetailResponseDto,
  EodReminderDto,
  EodResponseDto,
} from './serializers/eod.serializer';
import { EodSummaryResponseDto } from './serializers/eod-summary.serializer';

export interface CreateEodFromEventInput {
  memberId: string;
  groupId: string;
  messageId: string;
  reportContent: string;
  submittedAt: Date;
}

interface EligibleMember {
  memberId: string;
  memberName: string;
  phone: string;
  /** A deterministic "home" group for display when no report has been submitted yet. */
  groupId: string;
  groupName: string;
  /** Every INTERNAL+active group this member has an active membership in — used for the groupId filter. */
  eligibleGroupIds: string[];
}

/**
 * EOD eligibility, member-based (see docs/api-contract.md "Member-based
 * counting"): a person with multiple active INTERNAL group memberships is
 * counted once, not once per group. `eod_reports` is still stored
 * per-(member, group, date) — a member is "submitted" for a date if ANY
 * of their eligible groups has a report for that date.
 */
@Injectable()
export class EodService {
  constructor(
    @InjectRepository(EodReport)
    private readonly eodReports: Repository<EodReport>,
    @InjectRepository(GroupMember)
    private readonly groupMembers: Repository<GroupMember>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly teamMembersService: TeamMembersService,
    private readonly groupsService: GroupsService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------
  // Event-facing creation (no public POST /eod — see docs/api-contract.md)
  // -------------------------------------------------------------------

  async createFromEvent(input: CreateEodFromEventInput): Promise<EodReport> {
    if (!input.messageId?.trim()) {
      throw new BadRequestException('messageId is required');
    }
    if (
      !(input.submittedAt instanceof Date) ||
      Number.isNaN(input.submittedAt.getTime())
    ) {
      throw new BadRequestException('submittedAt must be a valid date');
    }
    const reportContent = input.reportContent?.trim() ?? '';
    if (!reportContent) {
      throw new BadRequestException('reportContent must not be empty');
    }

    // Idempotency, step 1: a prior successful delivery of this exact message.
    const existingByMessage = await this.eodReports.findOneBy({
      messageId: input.messageId,
    });
    if (existingByMessage) return existingByMessage;

    const member = await this.teamMembersService.getEntityOrThrow(
      input.memberId,
    );
    if (!member.active) {
      throw new BadRequestException(
        `Team member ${input.memberId} is not active`,
      );
    }

    const group = await this.groupsService.getEntityOrThrow(input.groupId);
    if (group.type !== GroupType.INTERNAL) {
      throw new BadRequestException(
        'EOD reports can only be submitted for INTERNAL groups',
      );
    }

    const membership = await this.groupMembers.findOneBy({
      memberId: input.memberId,
      groupId: input.groupId,
    });
    if (!membership || !membership.active) {
      throw new BadRequestException(
        `Team member ${input.memberId} is not an active member of group ${input.groupId}`,
      );
    }

    const timeZone = getBusinessTimeZone(this.config);
    const deadlineHhMm = getEodDeadline(this.config);
    const reportDate = toBusinessDateString(input.submittedAt, timeZone);
    const deadline = getBusinessDayDeadline(reportDate, timeZone, deadlineHhMm);
    const status =
      input.submittedAt.getTime() <= deadline.getTime()
        ? EodStatus.ON_TIME
        : EodStatus.LATE;

    // Idempotency, step 2: the (member, group, date) unique constraint —
    // guards a resubmission carrying a *different* messageId.
    const existingByComposite = await this.eodReports.findOneBy({
      memberId: input.memberId,
      groupId: input.groupId,
      reportDate,
    });
    if (existingByComposite) return existingByComposite;

    const report = this.eodReports.create({
      memberId: input.memberId,
      groupId: input.groupId,
      reportDate,
      messageId: input.messageId,
      reportContent,
      submittedAt: input.submittedAt,
      status,
    });

    try {
      return await this.eodReports.save(report);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a race with a concurrent delivery — either unique
        // constraint could be the one that fired.
        const raced =
          (await this.eodReports.findOneBy({ messageId: input.messageId })) ??
          (await this.eodReports.findOneBy({
            memberId: input.memberId,
            groupId: input.groupId,
            reportDate,
          }));
        if (raced) return raced;
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------

  async findAll(query: EodQueryDto = {}): Promise<EodResponseDto[]> {
    const date = query.date ?? this.todayBusinessDate();
    return this.getDateStatus(date, {
      groupId: query.groupId,
      status: query.status,
      memberId: query.memberId,
    });
  }

  /**
   * Returns the full EOD picture for one business date: every eligible
   * active-internal team member, each resolved to a real submitted row
   * (ON_TIME/LATE) or a *computed* row (MISSING once the deadline has
   * passed, PENDING before it) — no synthetic row is ever written to the
   * database for the computed case. See docs/api-contract.md.
   */
  async getDateStatus(
    date: string,
    filters: {
      groupId?: string;
      status?: EodDisplayStatus;
      memberId?: string;
    } = {},
  ): Promise<EodResponseDto[]> {
    if (!isValidDateOnly(date)) {
      throw new BadRequestException(
        `Invalid date "${date}", expected YYYY-MM-DD`,
      );
    }

    const timeZone = getBusinessTimeZone(this.config);
    const deadlineHhMm = getEodDeadline(this.config);
    const deadline = getBusinessDayDeadline(date, timeZone, deadlineHhMm);
    const deadlinePassed = Date.now() >= deadline.getTime();

    const { eligible, groupNameById } = await this.loadEligibleMembers();
    let scoped = eligible;
    if (filters.memberId)
      scoped = scoped.filter((member) => member.memberId === filters.memberId);
    if (filters.groupId) {
      scoped = scoped.filter((member) =>
        member.eligibleGroupIds.includes(filters.groupId!),
      );
    }

    const memberIds = scoped.map((member) => member.memberId);
    const reports = memberIds.length
      ? await this.eodReports.find({
          where: { reportDate: date, memberId: In(memberIds) },
        })
      : [];
    const reportByMember = new Map(
      reports.map((report) => [report.memberId, report]),
    );

    let rows: EodResponseDto[] = scoped.map((member) => {
      const report = reportByMember.get(member.memberId);
      if (report) {
        return {
          id: report.id,
          memberId: member.memberId,
          memberName: member.memberName,
          phone: member.phone,
          groupId: report.groupId,
          groupName: groupNameById.get(report.groupId) ?? member.groupName,
          reportDate: report.reportDate,
          submittedAt: report.submittedAt,
          status: report.status,
          reportContent: report.reportContent,
          deadline,
          missing: false,
        };
      }
      return {
        id: null,
        memberId: member.memberId,
        memberName: member.memberName,
        phone: member.phone,
        groupId: member.groupId,
        groupName: member.groupName,
        reportDate: date,
        submittedAt: null,
        status: deadlinePassed ? EodStatus.MISSING : EOD_PENDING,
        reportContent: null,
        deadline,
        missing: deadlinePassed,
      };
    });

    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }

    return rows;
  }

  async findOne(id: string): Promise<EodDetailResponseDto> {
    const report = await this.eodReports.findOne({
      where: { id },
      relations: { member: true, group: true },
    });
    if (!report) {
      throw new NotFoundException(`EOD report ${id} not found`);
    }

    const timeZone = getBusinessTimeZone(this.config);
    const deadlineHhMm = getEodDeadline(this.config);
    const deadline = getBusinessDayDeadline(
      report.reportDate,
      timeZone,
      deadlineHhMm,
    );

    const reminders = await this.findReminders(
      report.member.phone,
      report.reportDate,
      timeZone,
    );

    return {
      id: report.id,
      memberId: report.memberId,
      memberName: report.member.name,
      phone: report.member.phone,
      groupId: report.groupId,
      groupName: report.group.name,
      reportDate: report.reportDate,
      submittedAt: report.submittedAt,
      status: report.status,
      reportContent: report.reportContent,
      deadline,
      missing: false,
      reminders,
    };
  }

  async summary(
    query: EodSummaryQueryDto = {},
  ): Promise<EodSummaryResponseDto> {
    const date = query.date ?? this.todayBusinessDate();
    const rows = await this.getDateStatus(date, { groupId: query.groupId });

    const timeZone = getBusinessTimeZone(this.config);
    const deadlineHhMm = getEodDeadline(this.config);
    const deadline = getBusinessDayDeadline(date, timeZone, deadlineHhMm);
    const deadlinePassed = Date.now() >= deadline.getTime();

    const totalMembers = rows.length;
    const onTime = rows.filter(
      (row) => row.status === EodStatus.ON_TIME,
    ).length;
    const late = rows.filter((row) => row.status === EodStatus.LATE).length;
    const missing = rows.filter(
      (row) => row.status === EodStatus.MISSING,
    ).length;
    const submitted = onTime + late;

    const completionPercentage =
      totalMembers > 0 ? Math.round((submitted / totalMembers) * 1000) / 10 : 0;

    return {
      totalMembers,
      submitted,
      onTime,
      late,
      missing,
      deadline,
      deadlinePassed,
      completionPercentage,
    };
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  /**
   * Loads every active group_members row with its member/group joined,
   * and reduces it to one row per distinct member (member-based
   * eligibility — see class-level doc comment). `groupNameById` covers
   * every group referenced by any membership, active or not, so a
   * historical submitted report can always resolve its group's name even
   * if that particular group has since been deactivated.
   */
  private async loadEligibleMembers(): Promise<{
    eligible: EligibleMember[];
    groupNameById: Map<string, string>;
  }> {
    const memberships = await this.groupMembers.find({
      relations: { member: true, group: true },
      order: { createdAt: 'ASC' },
    });

    const groupNameById = new Map<string, string>();
    const byMember = new Map<string, EligibleMember>();

    for (const membership of memberships) {
      if (!membership.group || !membership.member) continue;
      groupNameById.set(membership.groupId, membership.group.name);

      const isEligibleMembership =
        membership.active &&
        membership.member.active &&
        membership.group.active &&
        membership.group.type === GroupType.INTERNAL;
      if (!isEligibleMembership) continue;

      const existing = byMember.get(membership.memberId);
      if (existing) {
        existing.eligibleGroupIds.push(membership.groupId);
        continue;
      }
      byMember.set(membership.memberId, {
        memberId: membership.memberId,
        memberName: membership.member.name,
        phone: membership.member.phone,
        groupId: membership.groupId,
        groupName: membership.group.name,
        eligibleGroupIds: [membership.groupId],
      });
    }

    return { eligible: [...byMember.values()], groupNameById };
  }

  /**
   * EOD_REMINDER notifications for this member on this business date.
   * Always empty today — nothing in the system creates EOD_REMINDER
   * notifications yet (that's n8n's job, a later integration phase) —
   * this is real plumbing against the existing Notification entity, not
   * a fabricated result. Matched by recipientPhone + createdAt falling
   * within the business date, since Notification has no direct EOD
   * report reference (member's phone is the natural join key here, same
   * as SLA notifications join via slaId).
   */
  private async findReminders(
    phone: string,
    reportDate: string,
    timeZone: string,
  ): Promise<EodReminderDto[]> {
    const { start, end } = getBusinessDayRange(reportDate, timeZone);
    const rows = await this.notifications
      .createQueryBuilder('notification')
      .where('notification.type = :type', {
        type: NotificationType.EOD_REMINDER,
      })
      .andWhere('notification.recipientPhone = :phone', { phone })
      .andWhere(
        'notification.createdAt >= :start AND notification.createdAt < :end',
        { start, end },
      )
      .orderBy('notification.createdAt', 'ASC')
      .getMany();
    return rows.map((row) => ({
      id: row.id,
      sentAt: row.sentAt,
      status: row.status,
      message: row.message,
    }));
  }

  private todayBusinessDate(): string {
    return toBusinessDateString(new Date(), getBusinessTimeZone(this.config));
  }
}
