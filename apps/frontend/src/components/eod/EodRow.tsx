import type { EodReport } from '../../types/domain';
import { formatTime } from '../../lib/format';
import { EodStatusBadge } from '../ui/StatusBadge';

interface EodRowProps {
  report: EodReport;
  onView: (report: EodReport) => void;
}

export function EodRow({ report, onView }: EodRowProps) {
  return (
    <tr
      className="data-table-row-interactive"
      tabIndex={0}
      role="button"
      aria-label={`View EOD report for ${report.member}`}
      onClick={() => onView(report)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(report);
        }
      }}
    >
      <td className="data-table-primary">{report.member}</td>
      <td>{report.submitted ? 'Yes' : 'No'}</td>
      <td>{report.submittedAt ? formatTime(report.submittedAt) : '—'}</td>
      <td>
        <EodStatusBadge status={report.status} />
      </td>
      <td>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              onView(report);
            }}
          >
            View
          </button>
          {report.status === 'MISSING' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled
              title="Reminder sending is not available yet"
              onClick={(event) => event.stopPropagation()}
            >
              Send
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
