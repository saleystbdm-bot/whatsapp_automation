import type { SlaIncident } from '../../types/domain';
import { SlaStatusBadge } from '../ui/StatusBadge';

interface SlaRowProps {
  incident: SlaIncident;
  onView: (incident: SlaIncident) => void;
}

export function SlaRow({ incident, onView }: SlaRowProps) {
  return (
    <tr
      className="data-table-row-interactive"
      tabIndex={0}
      role="button"
      aria-label={`View SLA details for ${incident.issueTitle}`}
      onClick={() => onView(incident)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onView(incident);
        }
      }}
    >
      <td className="data-table-primary">{incident.issueTitle}</td>
      <td>{incident.groupName}</td>
      <td>{incident.groupType}</td>
      <td>{incident.elapsedMinutes}m</td>
      <td>{incident.slaMinutes}m</td>
      <td>
        <SlaStatusBadge status={incident.status} />
      </td>
      <td>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(event) => {
            event.stopPropagation();
            onView(incident);
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}
