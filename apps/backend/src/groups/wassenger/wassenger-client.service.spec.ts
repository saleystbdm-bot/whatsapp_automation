import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WassengerClientService } from './wassenger-client.service';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function makeGroups(
  count: number,
  offset = 0,
): { wid: string; name: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    wid: `${offset + i}@g.us`,
    name: `Group ${offset + i}`,
  }));
}

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

describe('WassengerClientService', () => {
  const baseConfig = {
    WASSENGER_API_KEY: 'test-key',
    WASSENGER_DEVICE_ID: 'device-1',
    WASSENGER_API_BASE_URL: 'https://api.wassenger.com/v1',
  };

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('paginates until a short page is returned', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeGroups(100, 0)))
      .mockResolvedValueOnce(jsonResponse(makeGroups(44, 100)))
      .mockResolvedValueOnce(jsonResponse(makeGroups(0, 0)));

    const client = new WassengerClientService(configWith(baseConfig));
    const groups = await client.fetchAllGroups();

    // The empty 3rd page is never requested, since page 1 (44 < 100)
    // already signaled "last page".
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(groups).toHaveLength(144);
    expect(groups[0].wid).toBe('0@g.us');
    expect(groups[143].wid).toBe('143@g.us');
  });

  it('stops immediately when the first page is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const client = new WassengerClientService(configWith(baseConfig));
    const groups = await client.fetchAllGroups();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(groups).toEqual([]);
  });

  it('deduplicates groups that appear on more than one page, keeping the latest name', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([
          ...makeGroups(99, 0),
          { wid: '0@g.us', name: 'Renamed Group 0' },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse(makeGroups(10, 100)));

    const client = new WassengerClientService(configWith(baseConfig));
    const groups = await client.fetchAllGroups();

    const group0 = groups.find((g) => g.wid === '0@g.us');
    expect(group0?.name).toBe('Renamed Group 0');
    // 99 unique wids on page 0 (0..98, with "0@g.us" deduplicated to its
    // later/renamed occurrence) + 10 unique wids on page 1.
    expect(groups).toHaveLength(109);
  });

  it('silently drops malformed entries but still continues pagination based on the raw page size', async () => {
    const page0 = [...makeGroups(99, 0), { wid: 123, name: 'bad wid type' }]; // 100 raw, 99 valid
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page0))
      .mockResolvedValueOnce(jsonResponse(makeGroups(5, 100)));

    const client = new WassengerClientService(configWith(baseConfig));
    const groups = await client.fetchAllGroups();

    // Must still have fetched page 1 — the raw page-0 size was 100, not 99.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(groups).toHaveLength(104); // 99 valid from page 0 + 5 from page 1
  });

  it('skips a group with a blank/whitespace-only name instead of failing the whole sync', async () => {
    // Observed in real Wassenger data: at least one group comes back with
    // name: "" — the groups table requires a non-blank name
    // (chk_groups_name_not_empty), so this must be dropped, not passed
    // through to the database.
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { wid: 'a@g.us', name: 'Valid Group A' },
        { wid: 'b@g.us', name: '' },
        { wid: 'c@g.us', name: '   ' },
        { wid: 'd@g.us', name: 'Valid Group D' },
      ]),
    );

    const client = new WassengerClientService(configWith(baseConfig));
    const groups = await client.fetchAllGroups();

    expect(groups.map((g) => g.wid).sort()).toEqual(['a@g.us', 'd@g.us']);
  });

  it('trims surrounding whitespace from an otherwise valid name', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ wid: 'a@g.us', name: '  Padded Name  ' }]),
    );

    const client = new WassengerClientService(configWith(baseConfig));
    const groups = await client.fetchAllGroups();

    expect(groups[0].name).toBe('Padded Name');
  });

  it('throws BadGatewayException on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 500));

    const client = new WassengerClientService(configWith(baseConfig));
    await expect(client.fetchAllGroups()).rejects.toThrow(BadGatewayException);
  });

  it('throws BadGatewayException when the response is not a JSON array', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ not: 'an array' }));

    const client = new WassengerClientService(configWith(baseConfig));
    await expect(client.fetchAllGroups()).rejects.toThrow(BadGatewayException);
  });

  it('throws InternalServerErrorException when WASSENGER_API_KEY is missing', async () => {
    const client = new WassengerClientService(
      configWith({ WASSENGER_DEVICE_ID: 'device-1' }),
    );
    await expect(client.fetchAllGroups()).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws InternalServerErrorException when WASSENGER_DEVICE_ID is missing', async () => {
    const client = new WassengerClientService(
      configWith({ WASSENGER_API_KEY: 'test-key' }),
    );
    await expect(client.fetchAllGroups()).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never includes the API key in a request made over fetch other than the Token header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const client = new WassengerClientService(configWith(baseConfig));
    await client.fetchAllGroups();

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).not.toContain('test-key');
    expect((init.headers as Record<string, string>).Token).toBe('test-key');
  });
});
