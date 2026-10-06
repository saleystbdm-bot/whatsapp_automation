import { ConfigService } from '@nestjs/config';

/**
 * Single place for the two business-rule env vars shared by Issues, SLA,
 * and EOD (BUSINESS_TIMEZONE, EOD_DEADLINE) and their defaults, so the
 * fallback values live in one file instead of being repeated (and
 * potentially drifting) across services. See .env.example.
 */
const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_EOD_DEADLINE = '19:00';

export function getBusinessTimeZone(config: ConfigService): string {
  return config.get<string>('BUSINESS_TIMEZONE', DEFAULT_BUSINESS_TIMEZONE);
}

export function getEodDeadline(config: ConfigService): string {
  return config.get<string>('EOD_DEADLINE', DEFAULT_EOD_DEADLINE);
}
