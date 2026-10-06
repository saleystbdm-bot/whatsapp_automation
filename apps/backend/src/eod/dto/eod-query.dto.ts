import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import {
  EOD_DISPLAY_STATUS_VALUES,
  EodDisplayStatus,
} from '../enums/eod-display-status';

export class EodQueryDto {
  @ApiPropertyOptional({
    description:
      'Business-calendar date (BUSINESS_TIMEZONE), not UTC. Defaults to today.',
    example: '2026-09-22',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    enum: EOD_DISPLAY_STATUS_VALUES,
    description:
      'PENDING is a computed status (not yet submitted, deadline not passed) — not persisted.',
  })
  @IsOptional()
  @IsIn(EOD_DISPLAY_STATUS_VALUES)
  status?: EodDisplayStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}
