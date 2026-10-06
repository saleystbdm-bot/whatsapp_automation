import { QueryFailedError } from 'typeorm';

/**
 * Services translate expected PostgreSQL constraint failures (from the
 * migration in src/database/migrations) into domain-level API errors
 * (ConflictException, etc.) — callers of these services, and ultimately
 * the frontend, must never see a raw QueryFailedError or a PostgreSQL
 * error code.
 *
 * Relevant PostgreSQL error codes:
 *   23505 unique_violation
 *   23503 foreign_key_violation
 *   23514 check_violation
 */
interface PgDriverError {
  code?: string;
  constraint?: string;
}

function pgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as PgDriverError | undefined)?.code;
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23503';
}

export function isCheckViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23514';
}
