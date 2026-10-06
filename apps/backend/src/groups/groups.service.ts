import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../common/database/postgres-error.util';
import { TeamMembersService } from '../team-members/team-members.service';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupQueryDto } from './dto/group-query.dto';
import { UpdateGroupMemberDto } from './dto/update-group-member.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupMember } from './entities/group-member.entity';
import { Group } from './entities/group.entity';
import {
  GroupMemberSummaryDto,
  GroupResponseDto,
  toGroupResponseDto,
} from './serializers/group.serializer';

const DETAIL_RELATIONS = {
  groupMembers: { member: true },
  keywords: true,
} as const;

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groups: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly groupMembers: Repository<GroupMember>,
    private readonly teamMembersService: TeamMembersService,
  ) {}

  async findAll(query: GroupQueryDto = {}): Promise<GroupResponseDto[]> {
    const where: Record<string, unknown> = {};
    if (query.active !== undefined) where.active = query.active;
    if (query.type !== undefined) where.type = query.type;
    if (query.search) where.name = ILike(`%${query.search}%`);

    // One query with joined relations for the whole list — avoids N+1
    // even though the response embeds members/keywords per group.
    const groups = await this.groups.find({
      where,
      relations: DETAIL_RELATIONS,
      order: { createdAt: 'ASC' },
    });
    return groups.map(toGroupResponseDto);
  }

  async findOne(id: string): Promise<GroupResponseDto> {
    const group = await this.getEntityOrThrow(id);
    return toGroupResponseDto(group);
  }

  /** Internal helper for other services/controllers that need the raw entity (e.g. existence checks). */
  async getEntityOrThrow(id: string): Promise<Group> {
    const group = await this.groups.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!group) {
      throw new NotFoundException(`Group ${id} not found`);
    }
    return group;
  }

  async findByWhatsappGroupId(whatsappGroupId: string): Promise<Group | null> {
    return this.groups.findOneBy({ whatsappGroupId });
  }

  async create(dto: CreateGroupDto): Promise<GroupResponseDto> {
    // A newly created group is never auto-monitored — the user must
    // explicitly enable monitoring via PATCH /groups/:id { active: true }.
    const group = this.groups.create({
      whatsappGroupId: dto.whatsappGroupId,
      name: dto.name,
      type: dto.type,
      slaMinutes: dto.slaMinutes,
      active: false,
    });

    try {
      const saved = await this.groups.save(group);
      return toGroupResponseDto({ ...saved, groupMembers: [], keywords: [] });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A group with whatsappGroupId "${dto.whatsappGroupId}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateGroupDto): Promise<GroupResponseDto> {
    const group = await this.getEntityOrThrow(id);

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.type !== undefined) group.type = dto.type;
    if (dto.slaMinutes !== undefined) group.slaMinutes = dto.slaMinutes;
    if (dto.active !== undefined) group.active = dto.active;

    const saved = await this.groups.save(group);
    return toGroupResponseDto(saved);
  }

  /**
   * Physically deletes a group. Groups with historical Issues, SLA
   * incidents, or EOD reports cannot be deleted — those tables reference
   * groups with ON DELETE RESTRICT precisely so this never silently
   * destroys history. Callers who want to stop monitoring a group without
   * deleting it should use PATCH /groups/:id { active: false } instead.
   */
  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    try {
      await this.groups.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Cannot delete this group because it has historical issues, SLA incidents, or EOD reports. ' +
            'Disable monitoring instead: PATCH /groups/:id { "active": false }.',
        );
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------
  // Group membership
  // -------------------------------------------------------------------

  async addMember(
    groupId: string,
    dto: AddGroupMemberDto,
  ): Promise<GroupMemberSummaryDto> {
    await this.getEntityOrThrow(groupId);
    const member = await this.teamMembersService.findById(dto.memberId);
    if (!member) {
      throw new NotFoundException(`Team member ${dto.memberId} not found`);
    }

    const membership = this.groupMembers.create({
      groupId,
      memberId: dto.memberId,
      responsibility: dto.responsibility ?? null,
      active: dto.active ?? true,
    });

    try {
      const saved = await this.groupMembers.save(membership);
      return this.toMemberSummary({ ...saved, member });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Team member ${dto.memberId} is already a member of group ${groupId}`,
        );
      }
      throw error;
    }
  }

  async findMembersForGroup(groupId: string): Promise<GroupMemberSummaryDto[]> {
    await this.getEntityOrThrow(groupId);
    const memberships = await this.groupMembers.find({
      where: { groupId },
      relations: { member: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map((membership) => this.toMemberSummary(membership));
  }

  async updateMember(
    groupId: string,
    memberId: string,
    dto: UpdateGroupMemberDto,
  ): Promise<GroupMemberSummaryDto> {
    const membership = await this.getMembershipOrThrow(groupId, memberId);

    if (dto.responsibility !== undefined)
      membership.responsibility = dto.responsibility;
    if (dto.active !== undefined) membership.active = dto.active;

    const saved = await this.groupMembers.save(membership);
    return this.toMemberSummary(saved);
  }

  async removeMember(groupId: string, memberId: string): Promise<void> {
    const membership = await this.getMembershipOrThrow(groupId, memberId);
    await this.groupMembers.delete(membership.id);
  }

  private async getMembershipOrThrow(
    groupId: string,
    memberId: string,
  ): Promise<GroupMember> {
    await this.getEntityOrThrow(groupId);
    const membership = await this.groupMembers.findOne({
      where: { groupId, memberId },
      relations: { member: true },
    });
    if (!membership) {
      throw new NotFoundException(
        `Team member ${memberId} is not a member of group ${groupId}`,
      );
    }
    return membership;
  }

  private toMemberSummary(membership: GroupMember): GroupMemberSummaryDto {
    return {
      id: membership.id,
      memberId: membership.memberId,
      name: membership.member?.name,
      phone: membership.member?.phone,
      role: membership.member?.role ?? null,
      responsibility: membership.responsibility,
      active: membership.active,
    };
  }
}
