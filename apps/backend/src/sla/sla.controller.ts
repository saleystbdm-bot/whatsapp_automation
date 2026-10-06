import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SlaAction, UpdateSlaDto } from './dto/update-sla.dto';
import { SlaQueryDto } from './dto/sla-query.dto';
import { SlaSummaryQueryDto } from './dto/sla-summary-query.dto';
import { SlaService } from './sla.service';
import { SlaSummaryResponseDto } from './serializers/sla-summary.serializer';
import { SlaResponseDto } from './serializers/sla.serializer';

@ApiTags('sla')
@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get()
  @ApiOperation({ summary: 'List SLA incidents' })
  @ApiResponse({ status: 200, type: [SlaResponseDto] })
  findAll(@Query() query: SlaQueryDto): Promise<SlaResponseDto[]> {
    return this.slaService.findAll(query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'SLA performance summary (counts, compliance %, average response time)',
  })
  @ApiResponse({ status: 200, type: SlaSummaryResponseDto })
  summary(@Query() query: SlaSummaryQueryDto): Promise<SlaSummaryResponseDto> {
    return this.slaService.summary(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single SLA incident, with its timeline' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: SlaResponseDto })
  @ApiResponse({ status: 404, description: 'SLA incident not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SlaResponseDto> {
    return this.slaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Record a controlled SLA business action',
    description:
      'Does NOT accept an arbitrary status field. `{ "action": "RESPOND", "respondedBy"? }` records the ' +
      'first response (idempotent; a late response never un-misses an SLA). ' +
      '`{ "action": "MISS" }` marks the SLA missed and fans out CEO/team notifications (idempotent).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: SlaResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid action' })
  @ApiResponse({ status: 404, description: 'SLA incident not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSlaDto,
  ): Promise<SlaResponseDto> {
    switch (dto.action) {
      case SlaAction.RESPOND:
        return this.slaService.respond(id, dto.respondedBy);
      case SlaAction.MISS:
        return this.slaService.miss(id);
      default:
        throw new BadRequestException(
          `Unsupported action: ${String(dto.action)}`,
        );
    }
  }
}
