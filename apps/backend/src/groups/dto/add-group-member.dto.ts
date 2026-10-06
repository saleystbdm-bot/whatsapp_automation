import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddGroupMemberDto {
  @ApiProperty({ description: 'TeamMember id', format: 'uuid' })
  @IsUUID()
  memberId: string;

  @ApiPropertyOptional({ example: 'PRIMARY', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  responsibility?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
