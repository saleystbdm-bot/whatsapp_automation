import type { Issue, IssueStatus } from '../../types/domain';
import { formatTime } from '../../lib/format';
import { Drawer } from '../ui/Drawer';
import { IssueStatusBadge, SlaStatusBadge } from '../ui/StatusBadge';

interface IssueDetailDrawerProps {
  issue: Issue;
  onClose: () => void;
  onStatusChange: (issue: Issue, status: IssueStatus) => void;
}

export function IssueDetailDrawer({ issue, onClose, onStatusChange }: IssueDetailDrawerProps) {
  return (
    <Drawer
      title={
        <div className="drawer-title-block">
          <span className="drawer-title-main">{issue.title}</span>
          <IssueStatusBadge status={issue.status} />
        </div>
      }
      onClose={onClose}
      footer={
        <div className="drawer-footer-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled>
            Assign
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={issue.status !== 'OPEN'}
            onClick={() => onStatusChange(issue, 'IN_PROGRESS')}
          >
            Mark In Progress
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={issue.status === 'RESOLVED'}
            onClick={() => onStatusChange(issue, 'RESOLVED')}
          >
            Mark Resolved
          </button>
        </div>
      }
    >
      <p className="detail-message">{issue.message}</p>

      <dl className="detail-list">
        <div className="detail-list-item">
          <dt>Group</dt>
          <dd>{issue.groupName}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Group type</dt>
          <dd>{issue.groupType}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Reported by</dt>
          <dd className="detail-mono">{issue.reportedBy}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Reported</dt>
          <dd>{formatTime(issue.reportedAt)}</dd>
        </div>
        <div className="detail-list-item">
          <dt>SLA status</dt>
          <dd>
            <SlaStatusBadge status={issue.slaStatus} />
          </dd>
        </div>
      </dl>

      <section className="detail-section">
        <h3>Responsible Team</h3>
        <ul className="chip-list">
          {issue.responsibleTeam.map((member) => (
            <li key={member.id} className="chip">
              {member.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3>Conversation Timeline</h3>
        <ol className="conversation-timeline">
          {issue.conversation.map((event) => (
            <li key={event.id} className="conversation-item">
              <div className="conversation-meta">
                <span className="conversation-actor">{event.actor}</span>
                <span className="conversation-time">{formatTime(event.timestamp)}</span>
              </div>
              <p className="conversation-message">{event.message}</p>
            </li>
          ))}
        </ol>
      </section>
    </Drawer>
  );
}
