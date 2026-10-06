import { ApiProperty } from '@nestjs/swagger';
import { GroupType } from '../../common/enums/group-type.enum';
import { Group } from '../entities/group.entity';

export class GroupMemberSummaryDto {
  @ApiProperty({
    description: 'Group membership id (not the team member id)',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({ format: 'uuid' })
  memberId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ nullable: true })
  role: string | null;

  @ApiProperty({ nullable: true })
  responsibility: string | null;

  @ApiProperty()
  active: boolean;
}

export class KeywordSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  keyword: string;

  @ApiProperty()
  active: boolean;
}

export class GroupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  whatsappGroupId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: GroupType })
  type: GroupType;

  @ApiProperty({ description: 'true = monitored, false = not monitored' })
  active: boolean;

  @ApiProperty()
  slaMinutes: number;

  @ApiProperty({ description: 'Count of active responsible team members' })
  memberCount: number;

  @ApiProperty({ type: [GroupMemberSummaryDto] })
  members: GroupMemberSummaryDto[];

  @ApiProperty({ type: [KeywordSummaryDto] })
  keywords: KeywordSummaryDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Maps a Group entity (with `groupMembers.member` and `keywords` relations
 * loaded) to the stable public response shape. Only *active* memberships
 * are surfaced as `members`/`memberCount` — a deactivated membership means
 * that person is no longer responsible for the group.
 */
export function toGroupResponseDto(group: Group): GroupResponseDto {
  const activeMembers = (group.groupMembers ?? []).filter((gm) => gm.active);

  return {
    id: group.id,
    whatsappGroupId: group.whatsappGroupId,
    name: group.name,
    type: group.type,
    active: group.active,
    slaMinutes: group.slaMinutes,
    memberCount: activeMembers.length,
    members: activeMembers.map((gm) => ({
      id: gm.id,
      memberId: gm.memberId,
      name: gm.member?.name,
      phone: gm.member?.phone,
      role: gm.member?.role ?? null,
      responsibility: gm.responsibility,
      active: gm.active,
    })),
    keywords: (group.keywords ?? [])
      .filter((keyword) => keyword.active)
      .map((keyword) => ({
        id: keyword.id,
        keyword: keyword.keyword,
        active: keyword.active,
      })),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}
