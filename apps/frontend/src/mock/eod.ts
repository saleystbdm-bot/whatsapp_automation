import type { EodReport } from '../types/domain';

export const EOD_DEADLINE_LABEL = '7:00 PM';

export const EOD_REPORTS: EodReport[] = [
  {
    id: 'eod-harish',
    memberId: 'member-harish',
    member: 'Harish',
    submitted: true,
    submittedAt: '2026-09-22T18:42:00+05:30',
    status: 'ON_TIME',
    content: [
      'Fixed payment API issue',
      'Reviewed pull requests for the SLA module',
      'Synced with Aakash on client onboarding',
    ],
    reminders: [],
  },
  {
    id: 'eod-aakash',
    memberId: 'member-aakash',
    member: 'Aakash',
    submitted: true,
    submittedAt: '2026-09-22T18:55:00+05:30',
    status: 'ON_TIME',
    content: [
      'Investigated login failures for Client Support',
      'Updated client on issue status',
      'Prepared EOD dashboard mockups',
    ],
    reminders: [],
  },
  {
    id: 'eod-raj',
    memberId: 'member-raj',
    member: 'Raj',
    submitted: true,
    submittedAt: '2026-09-22T19:18:00+05:30',
    status: 'LATE',
    content: [
      'Fixed payment API issue',
      'Tested deployment',
      'Updated client',
      'Pending database migration',
    ],
    reminders: [
      { id: 'rem-1', timestamp: '2026-09-22T19:00:00+05:30', label: 'Reminder sent' },
      { id: 'rem-2', timestamp: '2026-09-22T19:05:00+05:30', label: 'Reminder sent' },
    ],
  },
  {
    id: 'eod-kiran',
    memberId: 'member-kiran',
    member: 'Kiran',
    submitted: false,
    submittedAt: null,
    status: 'MISSING',
    content: [],
    reminders: [{ id: 'rem-3', timestamp: '2026-09-22T19:00:00+05:30', label: 'Reminder sent' }],
  },
];
