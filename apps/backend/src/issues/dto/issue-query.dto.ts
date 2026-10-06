import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { GroupType } from '../../common/enums/group-type.enum';
import { IssueStatus } from '../enums/issue-status.enum';

export class IssueQueryDto {
  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: GroupType })
  @IsOptional()
  @IsEnum(GroupType)
  groupType?: GroupType;

  @ApiPropertyOptional({
    description: 'Case-insensitive search over the issue message',
    example: 'payment',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Business-calendar date (BUSINESS_TIMEZONE), not UTC',
    example: '2026-09-22',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;
}
