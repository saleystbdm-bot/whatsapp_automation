import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeEqual } from '../../common/security/safe-equal.util';

const QUERY_PARAM = 'secret';

/**
 * Authenticates incoming Wassenger webhook calls.
 *
 * This is deliberately NOT an HMAC/signature check: Wassenger's own
 * `/v1/webhooks` registration object (inspected directly against this
 * project's live account) has no secret/signing-key field at all —
 * there is no payload-signing mechanism exposed to verify against. The
 * only lever Wassenger actually gives you is control over the
 * destination URL itself (configured once, in their dashboard or via
 * their webhook API), so the secret is carried there: register this
 * endpoint as `.../webhooks/wassenger?secret=<WASSENGER_WEBHOOK_SECRET>`
 * and every genuine delivery will carry it. This is a shared-secret
 * pattern, not a cryptographic signature of the body — documented here
 * so it's never mistaken for one.
 *
 * Fails closed: if the secret isn't configured, every request is
 * rejected rather than left open.
 */
@Injectable()
export class WassengerWebhookAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredSecret = this.config.get<string>(
      'WASSENGER_WEBHOOK_SECRET',
      '',
    );

    const request = context
      .switchToHttp()
      .getRequest<{ query: Record<string, unknown> }>();
    const provided = request.query[QUERY_PARAM];

    if (
      !configuredSecret ||
      typeof provided !== 'string' ||
      !safeEqual(provided, configuredSecret)
    ) {
      throw new UnauthorizedException('Invalid or missing webhook secret');
    }

    return true;
  }
}
