import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EodDetailResponseDto } from '../eod/serializers/eod.serializer';
import { IssueDetailResponseDto } from '../issues/serializers/issue.serializer';
import { NotificationResponseDto } from '../notifications/serializers/notification.serializer';
import { SlaResponseDto } from '../sla/serializers/sla.serializer';
import { CreateEodEventDto } from './dto/create-eod-event.dto';
import { CreateIssueEventDto } from './dto/create-issue-event.dto';
import { CreateSlaEventDto } from './dto/create-sla-event.dto';
import { RecordNotificationEventDto } from './dto/record-notification-event.dto';
import { SlaMissedEventDto } from './dto/sla-missed-event.dto';
import { SlaRespondedEventDto } from './dto/sla-responded-event.dto';
import { EventsService, SlaMissedEventResult } from './events.service';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';

/**
 * Machine-to-machine boundary called by n8n, never the frontend (see
 * docs/architecture.md). Every route requires the X-N8N-Webhook-Secret
 * header (N8N_WEBHOOK_SHARED_SECRET) — WebhookSecretGuard rejects
 * unauthenticated calls before any handler runs. Each handler is a thin
 * translation to the existing domain services (Issues/SLA/EOD) — n8n's
 * own detection/timer/reply-check logic in the existing workflow is
 * unchanged; this module is only the new call-out point.
 */
@ApiTags('events')
@ApiHeader({
  name: 'X-N8N-Webhook-Secret',
  required: true,
  description: 'Shared secret configured via N8N_WEBHOOK_SHARED_SECRET',
})
@UseGuards(WebhookSecretGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('issues')
  @ApiOperation({
    summary: 'Record a detected issue message',
    description:
      'Idempotent on messageId — a replayed webhook returns the existing Issue.',
  })
  @ApiResponse({ status: 201, type: IssueDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed payload' })
  @ApiResponse({ status: 404, description: 'Unknown group' })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  createIssue(
    @Body() dto: CreateIssueEventDto,
  ): Promise<IssueDetailResponseDto> {
    return this.eventsService.createIssueEvent(dto);
  }

  @Post('sla')
  @ApiOperation({
    summary: 'Start an SLA incident (mention or message trigger)',
    description:
      "Idempotent on messageId. The backend computes slaDeadline from the group's configured slaMinutes — it is never accepted from the caller.",
  })
  @ApiResponse({ status: 201, type: SlaResponseDto })
  @ApiResponse({ status: 400, description: 'Malformed payload' })
  @ApiResponse({ status: 404, description: 'Unknown group or issue' })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  createSla(@Body() dto: CreateSlaEventDto): Promise<SlaResponseDto> {
    return this.eventsService.createSlaEvent(dto);
  }

  @Patch('sla/:messageId/responded')
  @ApiOperation({
    summary: 'Mark an SLA incident as responded',
    description:
      'Looks up the incident by messageId, then calls SlaService.respond() — the backend owns the resulting status; a late response never un-misses an already-MISSED incident.',
  })
  @ApiParam({ name: 'messageId' })
  @ApiResponse({ status: 200, type: SlaResponseDto })
  @ApiResponse({
    status: 404,
    description: 'No SLA incident for this messageId',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  markResponded(
    @Param('messageId') messageId: string,
    @Body() dto: SlaRespondedEventDto,
  ): Promise<SlaResponseDto> {
    return this.eventsService.markSlaResponded(messageId, dto);
  }

  @Patch('sla/:messageId/missed')
  @ApiOperation({
    summary: 'Mark an SLA incident as missed',
    description:
      'Looks up the incident by messageId, then calls SlaService.miss() — idempotent, and fans out exactly one CEO + one-per-team-member Notification on a genuine OPEN→MISSED transition. Response includes those notifications so n8n knows exactly who to message.',
  })
  @ApiParam({ name: 'messageId' })
  @ApiResponse({
    status: 200,
    description: 'SLA incident + fanned-out notifications',
  })
  @ApiResponse({
    status: 404,
    description: 'No SLA incident for this messageId',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  markMissed(
    @Param('messageId') messageId: string,
    @Body() dto: SlaMissedEventDto,
  ): Promise<SlaMissedEventResult> {
    return this.eventsService.markSlaMissed(messageId, dto);
  }

  @Post('eod')
  @ApiOperation({
    summary: 'Record a submitted EOD report',
    description:
      'Idempotent on messageId. The backend computes ON_TIME/LATE from submittedAt vs. the business deadline, and enforces INTERNAL-group + active-member + active-membership eligibility — it never accepts status directly.',
  })
  @ApiResponse({ status: 201, type: EodDetailResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Malformed payload, non-INTERNAL group, or ineligible member',
  })
  @ApiResponse({ status: 404, description: 'Unknown group or member' })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  createEod(@Body() dto: CreateEodEventDto): Promise<EodDetailResponseDto> {
    return this.eventsService.createEodEvent(dto);
  }

  @Post('notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record the outcome of an actual WhatsApp send attempt',
    description:
      'Transitions an existing PENDING Notification (created by the SLA-missed fan-out) to SENT/FAILED — never creates a new Notification, so this never loops with the notification-creation step.',
  })
  @ApiResponse({ status: 200, type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Unknown notificationId' })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  recordNotification(
    @Body() dto: RecordNotificationEventDto,
  ): Promise<NotificationResponseDto> {
    return this.eventsService.recordNotificationDispatch(dto);
  }
}
