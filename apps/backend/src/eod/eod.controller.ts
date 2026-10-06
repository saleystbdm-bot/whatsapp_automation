import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { isValidDateOnly } from '../common/date/business-day.util';
import { EodQueryDto } from './dto/eod-query.dto';
import { EodSummaryQueryDto } from './dto/eod-summary-query.dto';
import { EodService } from './eod.service';
import {
  EodDetailResponseDto,
  EodResponseDto,
} from './serializers/eod.serializer';
import { EodSummaryResponseDto } from './serializers/eod-summary.serializer';

/**
 * There is no public POST /eod — submission is event-driven
 * (EodService.createFromEvent(), called internally once the n8n event
 * endpoint exists in a later phase) — and no PATCH /eod/:id — status is
 * always derived from submittedAt vs the configured deadline, never set
 * directly by a client.
 */
@ApiTags('eod')
@Controller('eod')
export class EodController {
  constructor(private readonly eodService: EodService) {}

  @Get()
  @ApiOperation({
    summary: 'EOD state for a business date',
    description:
      'One row per eligible active-internal team member: a real submitted row (ON_TIME/LATE) or a ' +
      'computed row (MISSING once the deadline has passed, PENDING before it). Defaults to today.',
  })
  @ApiResponse({ status: 200, type: [EodResponseDto] })
  findAll(@Query() query: EodQueryDto): Promise<EodResponseDto[]> {
    return this.eodService.findAll(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'EOD completion summary for a business date' })
  @ApiResponse({ status: 200, type: EodSummaryResponseDto })
  summary(@Query() query: EodSummaryQueryDto): Promise<EodSummaryResponseDto> {
    return this.eodService.summary(query);
  }

  /**
   * A single `:param` route, not two separate `:date`/`:id` routes:
   * Express/Nest route matching can't disambiguate two path params by
   * shape, so whichever was declared first would silently swallow every
   * request meant for the other. Dispatching on the value's shape inside
   * one handler is the standard resolution (see docs/api-contract.md).
   */
  @Get(':param')
  @ApiOperation({
    summary: 'EOD state for a date, or a single EOD report by id',
    description:
      'Pass a YYYY-MM-DD date for the full per-member state on that business date (same shape as GET /eod), ' +
      "or a report UUID for one submitted report's detail (including reminder history).",
  })
  @ApiParam({ name: 'param', description: 'YYYY-MM-DD date, or a report UUID' })
  @ApiResponse({ status: 200, type: EodResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    description: 'param is neither a valid date nor a UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'EOD report not found (UUID form only)',
  })
  findByDateOrId(
    @Param('param') param: string,
  ): Promise<EodResponseDto[] | EodDetailResponseDto> {
    if (isValidDateOnly(param)) {
      return this.eodService.getDateStatus(param);
    }
    if (isUUID(param)) {
      return this.eodService.findOne(param);
    }
    throw new BadRequestException(
      `"${param}" is neither a valid YYYY-MM-DD date nor a UUID`,
    );
  }
}
