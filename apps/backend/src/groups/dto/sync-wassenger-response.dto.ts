import { ApiProperty } from '@nestjs/swagger';

export class SyncWassengerResponseDto {
  @ApiProperty({
    description:
      'Distinct groups returned by Wassenger, after deduplication by wid',
  })
  totalFetched: number;

  @ApiProperty({
    description:
      'New groups inserted (always created unmonitored, type INTERNAL, 30-minute SLA)',
  })
  created: number;

  @ApiProperty({
    description: 'Existing groups whose name changed and was updated',
  })
  updated: number;

  @ApiProperty({
    description:
      'Existing groups already matching Wassenger — no write performed',
  })
  unchanged: number;
}
