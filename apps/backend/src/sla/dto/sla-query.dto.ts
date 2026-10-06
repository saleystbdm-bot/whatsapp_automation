import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { GroupType } from '../../common/enums/group-type.enum';
import { SlaStatus } from '../enums/sla-status.enum';
import { SlaTriggerType } from '../enums/sla-trigger-type.enum';

export class SlaQueryDto {
  @ApiPropertyOptional({ enum: SlaStatus })
  @IsOptional()
  @IsEnum(SlaStatus)
  status?: SlaStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ enum: GroupType })
  @IsOptional()
  @IsEnum(GroupType)
  groupType?: GroupType;

  @ApiPropertyOptional({ enum: SlaTriggerType })
  @IsOptional()
  @IsEnum(SlaTriggerType)
  triggerType?: SlaTriggerType;

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
