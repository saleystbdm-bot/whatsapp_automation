import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { TrimString } from '../../common/validators/trim-string.decorator';

/**
 * n8n → POST /events/eod, once a team member posts their EOD report in an
 * INTERNAL group. The backend (EodService.createFromEvent) owns
 * ON_TIME/LATE calculation from `submittedAt` vs. the business deadline —
 * n8n never sets `status` directly. Also enforces: INTERNAL groups only,
 * active member, active membership. `messageId` is the idempotency key.
 */
export class CreateEodEventDto {
  @ApiProperty({ description: 'WhatsApp message id (idempotency key)' })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId: string;

  @ApiProperty({ example: '1. Fixed payment API issue\n2. Tested deployment' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  reportContent: string;

  @ApiProperty({ description: 'When the report was actually sent.' })
  @IsISO8601()
  submittedAt: string;
}
