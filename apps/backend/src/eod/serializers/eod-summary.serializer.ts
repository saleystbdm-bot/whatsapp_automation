import { ApiProperty } from '@nestjs/swagger';

export class EodSummaryResponseDto {
  @ApiProperty({
    description:
      'Eligible active internal team members (member-based, not group-membership-based — see docs)',
  })
  totalMembers: number;

  @ApiProperty({
    description:
      'Members with a submitted report for this business date (onTime + late)',
  })
  submitted: number;

  @ApiProperty()
  onTime: number;

  @ApiProperty()
  late: number;

  @ApiProperty({
    description:
      'Eligible members with no submission. Always 0 before the deadline has passed — see deadlinePassed.',
  })
  missing: number;

  @ApiProperty({ description: "UTC instant of this business date's deadline" })
  deadline: Date;

  @ApiProperty({
    description:
      'Whether the deadline instant has already passed at request time',
  })
  deadlinePassed: boolean;

  @ApiProperty({
    description:
      'round(submitted / totalMembers * 100, 1). 0 when totalMembers = 0.',
  })
  completionPercentage: number;
}
