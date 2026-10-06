import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';

export enum SlaAction {
  RESPOND = 'RESPOND',
  MISS = 'MISS',
}

/**
 * PATCH /sla/:id deliberately does NOT accept an arbitrary `status` field
 * — that would let any client rewrite SLA history directly. Instead it
 * accepts one of two controlled actions, each backed by a dedicated
 * service method (SlaService.respond / SlaService.miss) that enforces the
 * business rules (idempotency, "late response doesn't un-miss", etc).
 * Conceptually this is "RespondSlaDto | MissSlaDto"; `respondedBy` is
 * only meaningful (and only read) when `action` is RESPOND.
 */
export class UpdateSlaDto {
  @ApiProperty({ enum: SlaAction })
  @IsEnum(SlaAction)
  action: SlaAction;

  @ApiPropertyOptional({
    example: '+919566831192',
    description:
      'Who responded (E.164 phone). Only used when action = RESPOND.',
  })
  @IsOptional()
  @Matches(E164_PHONE_REGEX, {
    message: 'respondedBy must be in E.164 format, e.g. +919566831192',
  })
  respondedBy?: string;
}
