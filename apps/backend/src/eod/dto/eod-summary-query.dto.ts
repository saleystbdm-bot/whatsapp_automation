import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class EodSummaryQueryDto {
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
}
