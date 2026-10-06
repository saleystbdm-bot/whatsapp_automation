import type { Issue } from '../../types/domain';
import { formatTime } from '../../lib/format';
import { IssueStatusBadge, SlaStatusBadge } from '../ui/StatusBadge';

interface IssueRowProps {
  issue: Issue;
  onView: (issue: Issue) => void;
}

export function IssueRow({ issue, onView }: IssueRowProps) {
  return (
    <tr
      className="data-table-row-interactive"
      tabIndex={0}
      role="button"
      aria-label={`View details for ${issue.title}`}
      onClick={() => onView(issue)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(issue);
        }
      }}
    >
      <td className="data-table-primary">{issue.title}</td>
      <td>{issue.groupName}</td>
      <td>
        <IssueStatusBadge status={issue.status} />
      </td>
      <td>{formatTime(issue.reportedAt)}</td>
      <td>
        <SlaStatusBadge status={issue.slaStatus} />
      </td>
      <td>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(event) => {
            event.stopPropagation();
            onView(issue);
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}
