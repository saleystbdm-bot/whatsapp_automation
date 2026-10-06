import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IssueQueryDto } from './dto/issue-query.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { IssuesService } from './issues.service';
import {
  IssueDetailResponseDto,
  IssueResponseDto,
} from './serializers/issue.serializer';

/**
 * Public read/lifecycle API for issues detected in monitored groups.
 * Issue *creation* is intentionally not exposed here — it happens via
 * IssuesService.createFromEvent(), called internally once the n8n event
 * endpoint (POST /events/issues) is added in a later phase.
 */
@ApiTags('issues')
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get()
  @ApiOperation({ summary: 'List issues' })
  @ApiResponse({ status: 200, type: [IssueResponseDto] })
  findAll(@Query() query: IssueQueryDto): Promise<IssueResponseDto[]> {
    return this.issuesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get a single issue, with SLA status, responsible team, and timeline',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: IssueDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IssueDetailResponseDto> {
    return this.issuesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update issue status',
    description:
      'Allowed transitions: OPEN→IN_PROGRESS, OPEN→RESOLVED, IN_PROGRESS→RESOLVED. RESOLVED is terminal.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: IssueDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Issue not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIssueDto,
  ): Promise<IssueDetailResponseDto> {
    return this.issuesService.updateStatus(id, dto);
  }
}
