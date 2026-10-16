import { API_BASE_URL } from '../lib/api';
import { ApiError, fallbackMessageFor, kindForStatus } from './errors';

export type QueryParams = Record<string, unknown>;

function buildUrl(path: string, params?: object): string {
  if (!API_BASE_URL) {
    throw new ApiError('VITE_API_BASE_URL is not configured', null, 'unknown');
  }
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params as QueryParams)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseErrorBody(response: Response): Promise<{ message: string; details: unknown }> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const rawMessage = record.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(' ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : fallbackMessageFor(kindForStatus(response.status));
      return { message, details: body };
    }
  } catch {
    // response had no JSON body — fall through to the generic message
  }
  return { message: fallbackMessageFor(kindForStatus(response.status)), details: undefined };
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options?: { params?: object; body?: unknown },
): Promise<T> {
  const url = buildUrl(path, options?.params);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: options?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(fallbackMessageFor('network'), null, 'network');
  }

  if (!response.ok) {
    const { message, details } = await parseErrorBody(response);
    throw new ApiError(message, response.status, kindForStatus(response.status), details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, params?: object) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
