import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WassengerWebhookAuthGuard } from './wassenger-webhook-auth.guard';

function contextWithQuery(query: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ query }),
    }),
  } as unknown as ExecutionContext;
}

function configWith(secret: string): ConfigService {
  return { get: () => secret } as unknown as ConfigService;
}

describe('WassengerWebhookAuthGuard', () => {
  it('accepts a request whose ?secret matches the configured value', () => {
    const guard = new WassengerWebhookAuthGuard(configWith('correct-secret'));
    expect(
      guard.canActivate(contextWithQuery({ secret: 'correct-secret' })),
    ).toBe(true);
  });

  it('rejects a request with the wrong secret', () => {
    const guard = new WassengerWebhookAuthGuard(configWith('correct-secret'));
    expect(() =>
      guard.canActivate(contextWithQuery({ secret: 'wrong' })),
    ).toThrow(/Invalid or missing webhook secret/);
  });

  it('rejects a request with no secret at all', () => {
    const guard = new WassengerWebhookAuthGuard(configWith('correct-secret'));
    expect(() => guard.canActivate(contextWithQuery({}))).toThrow(
      /Invalid or missing webhook secret/,
    );
  });

  it('fails closed when WASSENGER_WEBHOOK_SECRET is not configured, even if a secret is supplied', () => {
    const guard = new WassengerWebhookAuthGuard(configWith(''));
    expect(() =>
      guard.canActivate(contextWithQuery({ secret: 'anything' })),
    ).toThrow(/Invalid or missing webhook secret/);
  });
});
