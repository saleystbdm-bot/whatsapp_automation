import { useNavigate } from 'react-router-dom';
import type { LiveOperationItem, SlaStatus } from '../../types/domain';
import { SlaStatusBadge } from '../ui/StatusBadge';
import { ChevronRightIcon } from '../ui/icons';

interface LiveOperationsProps {
  items: LiveOperationItem[];
}

// The live-ops row only has CSS variants for -missed/-open/-responded; map
// the other real SLA statuses (and the no-SLA null case) onto those three.
function liveOpsRowVariant(status: SlaStatus | null): 'missed' | 'open' | 'responded' {
  if (status === 'MISSED') return 'missed';
  if (status === 'RESPONDED' || status === 'RESOLVED') return 'responded';
  return 'open';
}

export function LiveOperations({ items }: LiveOperationsProps) {
  const navigate = useNavigate();

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Live Operations</h2>
        <button type="button" className="link-button" onClick={() => navigate('/issues')}>
          View all
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
      <ul className="live-ops-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`live-ops-row live-ops-row-${liveOpsRowVariant(item.status)}`}
              onClick={() => navigate('/issues')}
            >
              <span className="live-ops-main">
                <span className="live-ops-title">{item.issueTitle}</span>
                <span className="live-ops-group">{item.groupName}</span>
              </span>
              <span className="live-ops-elapsed">
                <span>{item.elapsedLabel}</span>
                {item.remainingLabel && <span className="live-ops-remaining">{item.remainingLabel}</span>}
              </span>
              <SlaStatusBadge status={item.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
