import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const FORWARD_TIMEOUT_MS = 10_000;

export interface ForwardResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * Sends an eligible (already monitoring-filtered) event to n8n. This is
 * the only place in the backend that calls out to n8n for inbound
 * WhatsApp events — never the frontend, and never unconditionally
 * (WassengerWebhookService only calls this after confirming the group
 * is monitored).
 */
@Injectable()
export class N8nForwarderService {
  private readonly logger = new Logger(N8nForwarderService.name);

  constructor(private readonly config: ConfigService) {}

  async forward(payload: unknown): Promise<ForwardResult> {
    const url = this.config.get<string>('N8N_WASSENGER_FORWARD_URL');
    if (!url) {
      this.logger.error(
        'N8N_WASSENGER_FORWARD_URL is not configured — cannot forward event',
      );
      return {
        ok: false,
        error: 'N8N_WASSENGER_FORWARD_URL is not configured',
      };
    }
    const secret = this.config.get<string>('N8N_WEBHOOK_SHARED_SECRET', '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'X-N8N-Webhook-Secret': secret } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.error(`Forward to n8n failed: HTTP ${response.status}`);
        return {
          ok: false,
          status: response.status,
          error: `n8n responded with HTTP ${response.status}`,
        };
      }
      return { ok: true, status: response.status };
    } catch (error) {
      // Never log `error` directly — could echo request init, which
      // includes the X-N8N-Webhook-Secret header.
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'timed out'
          : 'network error';
      this.logger.error(`Forward to n8n failed: ${reason}`);
      return { ok: false, error: reason };
    } finally {
      clearTimeout(timeout);
    }
  }
}
