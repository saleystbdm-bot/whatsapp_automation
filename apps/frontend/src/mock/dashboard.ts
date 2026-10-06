import type { DashboardData } from '../types/domain';

export const DASHBOARD_DATA: DashboardData = {
  kpis: {
    activeIssues: 12,
    activeIssuesDelta: '+4 today',
    slaCompliance: 94,
    slaComplianceContext: 'Today',
    slaMissed: 3,
    slaMissedContext: 'Needs attention',
    eodSubmitted: 18,
    eodTotal: 20,
    eodContext: '90% submitted',
  },
  liveOperations: [
    {
      id: 'live-payment-api',
      issueTitle: 'Payment API is not working',
      groupName: 'Test Whatsapp Automation',
      elapsedLabel: '34 minutes ago',
      status: 'MISSED',
    },
    {
      id: 'live-login-issue',
      issueTitle: 'Login issue',
      groupName: 'Client Support',
      elapsedLabel: '18 minutes elapsed',
      remainingLabel: '12 min remaining',
      status: 'OPEN',
    },
    {
      id: 'live-server-deployment',
      issueTitle: 'Server deployment issue',
      groupName: 'Production Team',
      elapsedLabel: 'Responded in 8 minutes',
      status: 'RESPONDED',
    },
  ],
  slaPerformance: {
    compliance: 94,
    totalIssues: 51,
    responded: 48,
    missed: 3,
    open: 6,
    averageResponseMinutes: 11,
    trend: [82, 85, 88, 90, 87, 91, 94],
  },
  groupActivity: [
    { groupName: 'Test Whatsapp Automation', count: 18 },
    { groupName: 'Client Support', count: 12 },
    { groupName: 'Production Team', count: 9 },
    { groupName: 'Sales Support', count: 6 },
  ],
  eodSnapshot: {
    submitted: 18,
    total: 20,
    late: 1,
    missing: 1,
    deadline: '7:00 PM',
  },
};
