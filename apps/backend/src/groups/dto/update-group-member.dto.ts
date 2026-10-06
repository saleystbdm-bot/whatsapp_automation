import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGroupMemberDto {
  @ApiPropertyOptional({ example: 'SECONDARY', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  responsibility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
