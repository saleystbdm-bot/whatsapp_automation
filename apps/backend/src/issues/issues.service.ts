import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { getBusinessTimeZone } from '../common/config/business-config.util';
import { getBusinessDayRange } from '../common/date/business-day.util';
import { GroupsService } from '../groups/groups.service';
import { SlaIncident } from '../sla/entities/sla-incident.entity';
import { IssueQueryDto } from './dto/issue-query.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { Issue } from './entities/issue.entity';
import { IssueStatus } from './enums/issue-status.enum';
import {
  IssueDetailResponseDto,
  IssueResponseDto,
  toIssueDetailResponseDto,
  toIssueResponseDto,
} from './serializers/issue.serializer';
import { isUniqueViolation } from '../common/database/postgres-error.util';

export interface CreateIssueFromEventInput {
  messageId: string;
  groupId: string;
  senderPhone: string;
  message: string;
  /** Defaults to now. Lets a replayed/backfilled event carry its original timestamp. */
  createdAt?: Date;
}

/**
 * Allowed Issue status transitions. RESOLVED is terminal in this phase —
 * no reopen feature yet, per product decision.
 */
const ALLOWED_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  [IssueStatus.OPEN]: [IssueStatus.IN_PROGRESS, IssueStatus.RESOLVED],
  [IssueStatus.IN_PROGRESS]: [IssueStatus.RESOLVED],
  [IssueStatus.RESOLVED]: [],
};

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly issues: Repository<Issue>,
    @InjectRepository(SlaIncident)
    private readonly slaIncidents: Repository<SlaIncident>,
    private readonly groupsService: GroupsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Idempotent creation for the (future) n8n event path. `messageId` is
   * the idempotency key: if an Issue for this message already exists,
   * it is returned as-is — a duplicate webhook delivery is not an error.
   * `groupType` is never accepted from the caller; it is always resolved
   * from the current Group row so the snapshot is authoritative.
   */
  async createFromEvent(input: CreateIssueFromEventInput): Promise<Issue> {
    const existing = await this.issues.findOneBy({
      messageId: input.messageId,
    });
    if (existing) return existing;

    const group = await this.groupsService.getEntityOrThrow(input.groupId);

    const issue = this.issues.create({
      messageId: input.messageId,
      groupId: group.id,
      groupType: group.type,
      senderPhone: input.senderPhone,
      message: input.message,
      status: IssueStatus.OPEN,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    });

    try {
      return await this.issues.save(issue);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a race with a concurrent delivery of the same message.
        const raced = await this.issues.findOneBy({
          messageId: input.messageId,
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  async findAll(query: IssueQueryDto = {}): Promise<IssueResponseDto[]> {
    const where: Record<string, unknown> = {};
    if (query.status !== undefined) where.status = query.status;
    if (query.groupId !== undefined) where.groupId = query.groupId;
    if (query.groupType !== undefined) where.groupType = query.groupType;
    if (query.search) where.message = ILike(`%${query.search}%`);

    const qb = this.issues
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.group', 'group');
    if (where.status !== undefined)
      qb.andWhere('issue.status = :status', { status: where.status });
    if (where.groupId !== undefined)
      qb.andWhere('issue.groupId = :groupId', { groupId: where.groupId });
    if (where.groupType !== undefined) {
      qb.andWhere('issue.groupType = :groupType', {
        groupType: where.groupType,
      });
    }
    if (query.search)
      qb.andWhere('issue.message ILIKE :search', {
        search: `%${query.search}%`,
      });
    if (query.date) {
      const { start, end } = getBusinessDayRange(
        query.date,
        this.businessTimeZone(),
      );
      qb.andWhere('issue.createdAt >= :start AND issue.createdAt < :end', {
        start,
        end,
      });
    }
    qb.orderBy('issue.createdAt', 'DESC');

    const issues = await qb.getMany();
    if (issues.length === 0) return [];

    const slaByIssueId = await this.slaIncidentsByIssueIds(
      issues.map((issue) => issue.id),
    );
    return issues.map((issue) =>
      toIssueResponseDto(
        issue,
        issue.group?.name ?? '',
        slaByIssueId.get(issue.id) ?? null,
      ),
    );
  }

  async findOne(id: string): Promise<IssueDetailResponseDto> {
    const issue = await this.getEntityOrThrow(id);
    const sla = await this.slaIncidents.findOne({
      where: { issueId: id },
      order: { createdAt: 'DESC' },
    });
    const members = await this.groupsService.findMembersForGroup(issue.groupId);
    const responsibleTeam = members
      .filter((member) => member.active)
      .map((member) => ({
        id: member.memberId,
        name: member.name,
        phone: member.phone,
      }));

    return toIssueDetailResponseDto(
      issue,
      issue.group?.name ?? '',
      sla ?? null,
      responsibleTeam,
    );
  }

  async updateStatus(
    id: string,
    dto: UpdateIssueDto,
  ): Promise<IssueDetailResponseDto> {
    const issue = await this.getEntityOrThrow(id);

    if (dto.status !== undefined && dto.status !== issue.status) {
      if (!ALLOWED_TRANSITIONS[issue.status].includes(dto.status)) {
        throw new BadRequestException(
          `Invalid issue status transition: ${issue.status} → ${dto.status}`,
        );
      }
      issue.status = dto.status;
      if (dto.status === IssueStatus.RESOLVED) {
        issue.resolvedAt = new Date();
        issue.resolvedBy = dto.resolvedBy ?? null;
      }
      await this.issues.save(issue);
    }

    return this.findOne(id);
  }

  /** Internal helper for other services (e.g. SlaService validating an issueId). */
  findById(id: string): Promise<Issue | null> {
    return this.issues.findOneBy({ id });
  }

  private async getEntityOrThrow(id: string): Promise<Issue> {
    const issue = await this.issues.findOne({
      where: { id },
      relations: { group: true },
    });
    if (!issue) {
      throw new NotFoundException(`Issue ${id} not found`);
    }
    return issue;
  }

  private async slaIncidentsByIssueIds(
    issueIds: string[],
  ): Promise<Map<string, SlaIncident>> {
    if (issueIds.length === 0) return new Map();
    const incidents = await this.slaIncidents.find({
      where: { issueId: In(issueIds) },
    });
    const map = new Map<string, SlaIncident>();
    // If more than one SLA incident somehow references the same issue, keep the most recent.
    for (const incident of incidents) {
      if (!incident.issueId) continue;
      const existing = map.get(incident.issueId);
      if (!existing || incident.createdAt > existing.createdAt) {
        map.set(incident.issueId, incident);
      }
    }
    return map;
  }

  private businessTimeZone(): string {
    return getBusinessTimeZone(this.config);
  }
}
