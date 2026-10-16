import { ConfigService } from '@nestjs/config';
import { N8nForwarderService } from './n8n-forwarder.service';

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('N8nForwarderService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('posts to N8N_WASSENGER_FORWARD_URL with the shared secret header', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const forwarder = new N8nForwarderService(
      configWith({
        N8N_WASSENGER_FORWARD_URL: 'https://example.n8n.cloud/webhook/x',
        N8N_WEBHOOK_SHARED_SECRET: 'shh',
      }),
    );

    const result = await forwarder.forward({ hello: 'world' });

    expect(result).toEqual({ ok: true, status: 200 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.n8n.cloud/webhook/x');
    expect(
      (init.headers as Record<string, string>)['X-N8N-Webhook-Secret'],
    ).toBe('shh');
    expect(JSON.parse(init.body as string)).toEqual({ hello: 'world' });
  });

  it('fails without calling fetch when N8N_WASSENGER_FORWARD_URL is not configured', async () => {
    const forwarder = new N8nForwarderService(configWith({}));
    const result = await forwarder.forward({ hello: 'world' });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failure (not an exception) when n8n responds with a non-2xx status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    const forwarder = new N8nForwarderService(
      configWith({ N8N_WASSENGER_FORWARD_URL: 'https://x/y' }),
    );
    const result = await forwarder.forward({});
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.error).toContain('502');
  });

  it('reports a timeout as a failure rather than letting it hang or throw', async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    const forwarder = new N8nForwarderService(
      configWith({ N8N_WASSENGER_FORWARD_URL: 'https://x/y' }),
    );

    const result = await forwarder.forward({});
    expect(result).toEqual({ ok: false, error: 'timed out' });
  });

  it('reports a network error (connection refused, DNS failure, etc.) as a failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const forwarder = new N8nForwarderService(
      configWith({ N8N_WASSENGER_FORWARD_URL: 'https://x/y' }),
    );

    const result = await forwarder.forward({});
    expect(result).toEqual({ ok: false, error: 'network error' });
  });
});
