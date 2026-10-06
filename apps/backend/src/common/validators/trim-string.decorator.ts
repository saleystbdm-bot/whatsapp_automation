import { Transform } from 'class-transformer';

/**
 * Trims a string field before class-validator sees it, so
 * `@IsNotEmpty()` correctly rejects whitespace-only input (e.g. "   ")
 * instead of letting it through validation only to fail a database
 * `CHECK (length(btrim(...)) > 0)` constraint later and surface as a 500
 * instead of a 400.
 */
export function TrimString(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
