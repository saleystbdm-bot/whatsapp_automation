export type ApiErrorKind = 'validation' | 'not_found' | 'conflict' | 'server' | 'network' | 'unknown';

export class ApiError extends Error {
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  readonly details: unknown;

  constructor(message: string, status: number | null, kind: ApiErrorKind, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.details = details;
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 400) return 'validation';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server';
  return 'unknown';
}

const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  validation: 'The request was invalid.',
  not_found: 'The requested item was not found.',
  conflict: 'This action conflicts with existing data.',
  server: 'The server encountered an error. Please try again.',
  network: 'Unable to reach the server. Please check your connection.',
  unknown: 'Something went wrong.',
};

export function fallbackMessageFor(kind: ApiErrorKind): string {
  return FALLBACK_MESSAGES[kind];
}
