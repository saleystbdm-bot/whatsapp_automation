import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

const HEADER_NAME = 'x-n8n-webhook-secret';

/**
 * Machine-to-machine authentication for the n8n event boundary (see
 * docs/api-contract.md "n8n Events"). A single shared secret
 * (N8N_WEBHOOK_SHARED_SECRET), sent as a header — never in the URL, a
 * query parameter, or the body, so it never ends up in access logs or
 * browser history. Never exposed to the frontend.
 *
 * If the secret isn't configured at all, every request is rejected
 * (fail closed) rather than accidentally leaving the event endpoints
 * open — an empty configured value must never be treated as "no auth
 * required".
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredSecret = this.config.get<string>(
      'N8N_WEBHOOK_SHARED_SECRET',
      '',
    );

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const rawHeader = request.headers[HEADER_NAME];
    const provided = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (
      !configuredSecret ||
      !provided ||
      !safeEqual(provided, configuredSecret)
    ) {
      // Deliberately the same generic message whether the header was
      // missing or simply wrong — never reveal which.
      throw new UnauthorizedException('Invalid or missing webhook secret');
    }

    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
