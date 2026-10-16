import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WassengerWebhookAuthGuard } from './guards/wassenger-webhook-auth.guard';
import {
  WassengerWebhookOutcome,
  WassengerWebhookService,
} from './wassenger-webhook.service';

/**
 * Receives Wassenger webhook events directly (not via n8n) so the
 * backend — the authoritative source for monitoring status — can decide
 * whether an event is even eligible before n8n ever sees it:
 *
 *   Wassenger → this endpoint → PostgreSQL monitored-group check → n8n
 *
 * No `@Body()` DTO is used here deliberately — see
 * dto/wassenger-webhook-payload.ts for why a strict class-validator DTO
 * would be unsafe against the global ValidationPipe's
 * `forbidNonWhitelisted: true`.
 */
@ApiTags('webhooks')
@UseGuards(WassengerWebhookAuthGuard)
@Controller('webhooks/wassenger')
export class WassengerWebhookController {
  constructor(private readonly webhookService: WassengerWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // machine-to-machine; the secret lives in the URL, keep it out of public Swagger
  @ApiOperation({ summary: 'Receive a Wassenger webhook event' })
  @ApiResponse({
    status: 200,
    description: 'Processed — forwarded, skipped, or a known duplicate',
  })
  @ApiResponse({
    status: 400,
    description: 'Malformed payload (no message id)',
  })
  @ApiResponse({ status: 401, description: 'Missing/invalid webhook secret' })
  @ApiResponse({
    status: 503,
    description: 'Forwarding to n8n failed — Wassenger should retry',
  })
  receive(@Body() body: unknown): Promise<WassengerWebhookOutcome> {
    return this.webhookService.handle(body);
  }
}
