import type { BadgeTone } from '../components/ui/StatusBadge';
import type { EodStatus, GroupType, IssueStatus, SlaStatus } from '../types/domain';

export function slaStatusTone(status: SlaStatus | null): BadgeTone {
  switch (status) {
    case 'RESPONDED':
    case 'RESOLVED':
      return 'success';
    case 'OPEN':
      return 'warning';
    case 'MISSED':
    case 'ESCALATED':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function issueStatusTone(status: IssueStatus): BadgeTone {
  switch (status) {
    case 'RESOLVED':
      return 'success';
    case 'IN_PROGRESS':
      return 'primary';
    case 'OPEN':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function eodStatusTone(status: EodStatus): BadgeTone {
  switch (status) {
    case 'ON_TIME':
      return 'success';
    case 'LATE':
      return 'warning';
    case 'MISSING':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function groupTypeTone(type: GroupType): BadgeTone {
  return type === 'INTERNAL' ? 'primary' : 'neutral';
}
