import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { E164_PHONE_REGEX } from '../../common/constants/phone.constant';

/**
 * n8n → PATCH /events/sla/:messageId/responded, once a team reply is
 * detected. The backend (SlaService.respond) owns the resulting status —
 * n8n never sets `status` directly. A response arriving after the
 * incident is already MISSED is still recorded (so it's known *when* the
 * late reply happened) but never "un-misses" it.
 */
export class SlaRespondedEventDto {
  @ApiPropertyOptional({ example: '+919566800001' })
  @IsOptional()
  @Matches(E164_PHONE_REGEX, {
    message: 'respondedBy must be in E.164 format, e.g. +919566831192',
  })
  respondedBy?: string;

  @ApiPropertyOptional({
    description: 'When the reply was sent. Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  responseAt?: string;
}
