import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

/**
 * n8n → PATCH /events/sla/:messageId/missed, once its SLA timer fires
 * with no on-time reply detected. The backend (SlaService.miss) owns the
 * MISSED transition, idempotency, and CEO/team notification fan-out — a
 * duplicate timer firing never creates a second SLA incident or
 * double-notifies anyone.
 */
export class SlaMissedEventDto {
  @ApiPropertyOptional({
    description:
      'When the deadline was determined to have passed. Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  missedAt?: string;
}
