import { eodStatusTone, groupTypeTone, issueStatusTone, slaStatusTone } from '../../lib/status-tone';
import { formatStatusLabel } from '../../lib/format';
import type { EodStatus, GroupType, IssueStatus, SlaStatus } from '../../types/domain';

export type BadgeTone = 'success' | 'warning' | 'critical' | 'primary' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone: BadgeTone;
  dot?: boolean;
}

export function StatusBadge({ label, tone, dot = true }: StatusBadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

export function SlaStatusBadge({ status }: { status: SlaStatus | null }) {
  if (status === null) {
    return <StatusBadge label="No SLA" tone="neutral" />;
  }
  return <StatusBadge label={formatStatusLabel(status)} tone={slaStatusTone(status)} />;
}

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <StatusBadge label={formatStatusLabel(status)} tone={issueStatusTone(status)} />;
}

export function EodStatusBadge({ status }: { status: EodStatus }) {
  return <StatusBadge label={formatStatusLabel(status)} tone={eodStatusTone(status)} />;
}

export function GroupTypeBadge({ type }: { type: GroupType }) {
  return <StatusBadge label={type} tone={groupTypeTone(type)} dot={false} />;
}
