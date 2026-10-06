import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../common/database/postgres-error.util';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { TeamMemberQueryDto } from './dto/team-member-query.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { TeamMember } from './entities/team-member.entity';
import {
  TeamMemberResponseDto,
  toTeamMemberResponseDto,
} from './serializers/team-member.serializer';

export interface CreateTeamMemberInput {
  name: string;
  phone: string;
  role?: string | null;
  active?: boolean;
}

@Injectable()
export class TeamMembersService {
  constructor(
    @InjectRepository(TeamMember)
    private readonly teamMembers: Repository<TeamMember>,
  ) {}

  async findAll(
    query: TeamMemberQueryDto = {},
  ): Promise<TeamMemberResponseDto[]> {
    if (query.search) {
      const term = `%${query.search}%`;
      const qb = this.teamMembers
        .createQueryBuilder('member')
        .where('(member.name ILIKE :term OR member.phone ILIKE :term)', {
          term,
        });
      if (query.active !== undefined) {
        qb.andWhere('member.active = :active', { active: query.active });
      }
      qb.orderBy('member.name', 'ASC');
      const members = await qb.getMany();
      return members.map(toTeamMemberResponseDto);
    }

    const where: Record<string, unknown> = {};
    if (query.active !== undefined) where.active = query.active;
    const members = await this.teamMembers.find({
      where,
      order: { name: 'ASC' },
    });
    return members.map(toTeamMemberResponseDto);
  }

  async findOne(id: string): Promise<TeamMemberResponseDto> {
    const member = await this.getEntityOrThrow(id);
    return toTeamMemberResponseDto(member);
  }

  async getEntityOrThrow(id: string): Promise<TeamMember> {
    const member = await this.teamMembers.findOneBy({ id });
    if (!member) {
      throw new NotFoundException(`Team member ${id} not found`);
    }
    return member;
  }

  /** Internal helper (e.g. GroupsService validating a membership target). Returns null instead of throwing. */
  findById(id: string): Promise<TeamMember | null> {
    return this.teamMembers.findOneBy({ id });
  }

  findByPhone(phone: string): Promise<TeamMember | null> {
    return this.teamMembers.findOneBy({ phone });
  }

  async create(
    input: CreateTeamMemberDto | CreateTeamMemberInput,
  ): Promise<TeamMemberResponseDto> {
    const member = this.teamMembers.create({
      name: input.name,
      phone: input.phone,
      role: input.role ?? null,
      active: input.active ?? true,
    });

    try {
      const saved = await this.teamMembers.save(member);
      return toTeamMemberResponseDto(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A team member with phone "${input.phone}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateTeamMemberDto,
  ): Promise<TeamMemberResponseDto> {
    const member = await this.getEntityOrThrow(id);

    if (dto.name !== undefined) member.name = dto.name;
    if (dto.phone !== undefined) member.phone = dto.phone;
    if (dto.role !== undefined) member.role = dto.role;
    if (dto.active !== undefined) member.active = dto.active;

    try {
      const saved = await this.teamMembers.save(member);
      return toTeamMemberResponseDto(saved);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A team member with phone "${dto.phone}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Physically deletes a team member. EOD reports reference team members
   * with ON DELETE RESTRICT, so a member with historical EOD reports
   * cannot be deleted — deactivate instead (PATCH { "active": false }).
   * Current group memberships (group_members) DO cascade-delete: removing
   * the person removes their current responsibility assignments, which is
   * not "historical data" in the same sense.
   */
  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    try {
      await this.teamMembers.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'Cannot delete this team member because they have historical EOD reports. ' +
            'Deactivate instead: PATCH /team-members/:id { "active": false }.',
        );
      }
      throw error;
    }
  }
}
