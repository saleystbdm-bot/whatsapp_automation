import { EodStatus } from './eod-status.enum';

/**
 * `EodStatus` (ON_TIME/LATE/MISSING) is the *persisted* enum — it only
 * ever describes a submitted row's outcome. A member who simply hasn't
 * submitted yet, before the deadline, is neither MISSING (deadline
 * hasn't passed) nor any persisted status (no row exists) — there is no
 * "everything's fine, they still have time" value in the DB enum, and
 * this phase deliberately does not add one (no schema change was
 * genuinely required). `PENDING` exists only at the API/response layer
 * for exactly that computed, not-yet-resolved case.
 */
export const EOD_PENDING = 'PENDING' as const;
export type EodDisplayStatus = EodStatus | typeof EOD_PENDING;

export const EOD_DISPLAY_STATUS_VALUES: EodDisplayStatus[] = [
  EodStatus.ON_TIME,
  EodStatus.LATE,
  EodStatus.MISSING,
  EOD_PENDING,
];
