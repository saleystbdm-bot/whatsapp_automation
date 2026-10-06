import { ApiProperty } from '@nestjs/swagger';

export class SlaSummaryResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  open: number;

  @ApiProperty()
  responded: number;

  @ApiProperty()
  missed: number;

  @ApiProperty()
  escalated: number;

  @ApiProperty()
  resolved: number;

  @ApiProperty({
    nullable: true,
    description:
      'responded / (responded + missed), as a percentage 0–100. OPEN and ESCALATED incidents are ' +
      'excluded from both sides of this ratio — they have not yet reached a final response outcome. ' +
      'null when responded + missed = 0 (no completed incidents to measure yet).',
  })
  compliancePercentage: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Average of (firstResponseAt - createdAt) in minutes, across every incident that has a ' +
      'firstResponseAt set (including a MISSED incident that received a late response) — OPEN incidents ' +
      'and MISSED incidents with no response at all are excluded. null when no incident qualifies.',
  })
  averageResponseMinutes: number | null;
}
