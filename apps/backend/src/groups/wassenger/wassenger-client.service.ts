import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_API_BASE_URL = 'https://api.wassenger.com/v1';
const PAGE_SIZE = 100;
/**
 * Hard ceiling on pages fetched in one sync, purely as a loop guard against
 * a misbehaving upstream API that never returns a short/empty page (e.g.
 * if it ignores the `page` parameter and always echoes page 0). At
 * PAGE_SIZE=100 this allows up to 100,000 groups — far beyond any real
 * WhatsApp account — while still bounding the worst case.
 */
const MAX_PAGES = 1000;
const REQUEST_TIMEOUT_MS = 15_000;

export interface WassengerGroup {
  wid: string;
  name: string;
}

interface RawWassengerGroup {
  wid?: unknown;
  name?: unknown;
}

/**
 * Validates and normalizes one raw entry. Rejects anything whose `wid` is
 * missing/empty or whose `name` is missing or blank-after-trim — the
 * `groups` table requires `length(btrim(name)) > 0` (migration
 * `chk_groups_name_not_empty`), and real Wassenger data has been observed
 * to include at least one group with an empty name. Returning `null`
 * here (rather than throwing) lets one bad record be skipped without
 * discarding the rest of the page.
 */
function toValidGroup(value: unknown): WassengerGroup | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as RawWassengerGroup;
  if (typeof candidate.wid !== 'string' || candidate.wid.length === 0)
    return null;
  if (typeof candidate.name !== 'string') return null;
  const name = candidate.name.trim();
  if (name.length === 0) return null;
  return { wid: candidate.wid, name };
}

/**
 * Thin client for the one Wassenger endpoint this application needs
 * (`GET /devices/:deviceId/groups`). Reads credentials from
 * ConfigService, never logs them, and never forwards them to the
 * frontend — callers only ever see the mapped `WassengerGroup[]`.
 */
@Injectable()
export class WassengerClientService {
  private readonly logger = new Logger(WassengerClientService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Fetches every WhatsApp group on the configured device, paginating
   * `size=100` requests starting at `page=0` until a page comes back
   * shorter than `size` (including empty), deduplicating by `wid` in case
   * the same group appears on more than one page.
   */
  async fetchAllGroups(): Promise<WassengerGroup[]> {
    const apiKey = this.config.get<string>('WASSENGER_API_KEY');
    const deviceId = this.config.get<string>('WASSENGER_DEVICE_ID');
    const baseUrl = this.config.get<string>(
      'WASSENGER_API_BASE_URL',
      DEFAULT_API_BASE_URL,
    );

    if (!apiKey) {
      throw new InternalServerErrorException(
        'WASSENGER_API_KEY is not configured',
      );
    }
    if (!deviceId) {
      throw new InternalServerErrorException(
        'WASSENGER_DEVICE_ID is not configured',
      );
    }

    const byWid = new Map<string, WassengerGroup>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const { groups, rawCount } = await this.fetchPage(
        baseUrl,
        deviceId,
        apiKey,
        page,
      );
      for (const group of groups) {
        byWid.set(group.wid, group);
      }
      // The *raw* page size decides whether to continue, not how many of
      // its entries passed validation — a page with a few malformed
      // records (but still 100 of them) is not the last page.
      if (rawCount < PAGE_SIZE) {
        return [...byWid.values()];
      }
    }

    this.logger.warn(
      `Wassenger group sync stopped after ${MAX_PAGES} pages without a short page — possible API loop`,
    );
    return [...byWid.values()];
  }

  private async fetchPage(
    baseUrl: string,
    deviceId: string,
    apiKey: string,
    page: number,
  ): Promise<{ groups: WassengerGroup[]; rawCount: number }> {
    const url = new URL(
      `${baseUrl.replace(/\/+$/, '')}/devices/${deviceId}/groups`,
    );
    url.searchParams.set('kind', 'group');
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(PAGE_SIZE));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Token: apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (error) {
      // Never log `error` directly here — on some runtimes a fetch
      // AbortError/TypeError can echo back request init, which would
      // include the Token header.
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'timed out'
          : 'network error';
      this.logger.error(
        `Wassenger groups request (page ${page}) failed: ${reason}`,
      );
      throw new BadGatewayException(`Unable to reach Wassenger (${reason})`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.error(
        `Wassenger groups request (page ${page}) returned HTTP ${response.status}`,
      );
      throw new BadGatewayException(
        `Wassenger API returned HTTP ${response.status}`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new BadGatewayException(
        'Wassenger API returned a non-JSON response',
      );
    }

    if (!Array.isArray(body)) {
      throw new BadGatewayException(
        'Wassenger API returned an unexpected response shape',
      );
    }

    const groups = body
      .map(toValidGroup)
      .filter((group): group is WassengerGroup => group !== null);
    if (groups.length < body.length) {
      this.logger.warn(
        `Wassenger groups page ${page}: skipped ${body.length - groups.length} of ${body.length} entries (missing wid or blank name)`,
      );
    }

    return { groups, rawCount: body.length };
  }
}
