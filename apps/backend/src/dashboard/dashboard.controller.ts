import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardResponseDto } from './serializers/dashboard.serializer';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'CEO operations dashboard for a business date',
    description:
      'Aggregates Issues, SLA, Groups, and EOD into the KPIs / Live Operations / SLA Performance / ' +
      'Group Activity / EOD Snapshot sections the frontend Dashboard page renders. Read-only — this ' +
      'endpoint never creates or mutates domain data. Defaults to today (BUSINESS_TIMEZONE).',
  })
  @ApiResponse({ status: 200, type: DashboardResponseDto })
  @ApiResponse({
    status: 400,
    description: 'date is not a valid YYYY-MM-DD date',
  })
  getDashboard(
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardResponseDto> {
    return this.dashboardService.getDashboard(query.date);
  }
}
