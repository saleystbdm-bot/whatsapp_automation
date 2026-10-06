import { ApiProperty } from '@nestjs/swagger';
import { TeamMember } from '../entities/team-member.entity';

export class TeamMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ nullable: true })
  role: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export function toTeamMemberResponseDto(
  member: TeamMember,
): TeamMemberResponseDto {
  return {
    id: member.id,
    name: member.name,
    phone: member.phone,
    role: member.role,
    active: member.active,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}
