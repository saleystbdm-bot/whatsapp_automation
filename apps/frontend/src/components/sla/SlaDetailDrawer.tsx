import type { SlaIncident } from '../../types/domain';
import { formatTime } from '../../lib/format';
import { slaStatusTone } from '../../lib/status-tone';
import { Drawer } from '../ui/Drawer';
import { SlaStatusBadge } from '../ui/StatusBadge';
import { Timeline } from '../ui/Timeline';

interface SlaDetailDrawerProps {
  incident: SlaIncident;
  onClose: () => void;
}

export function SlaDetailDrawer({ incident, onClose }: SlaDetailDrawerProps) {
  return (
    <Drawer
      title={
        <div className="drawer-title-block">
          <span className="drawer-eyebrow">SLA Incident</span>
          <span className="drawer-title-main">{incident.issueTitle}</span>
        </div>
      }
      onClose={onClose}
    >
      <div className="detail-status-row">
        <SlaStatusBadge status={incident.status} />
      </div>

      <dl className="detail-list">
        <div className="detail-list-item">
          <dt>Group</dt>
          <dd>{incident.groupName}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Type</dt>
          <dd>{incident.groupType}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Triggered</dt>
          <dd>{formatTime(incident.triggeredAt)}</dd>
        </div>
        <div className="detail-list-item">
          <dt>SLA Deadline</dt>
          <dd>{formatTime(incident.slaDeadline)}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Response</dt>
          <dd>{incident.responseAt ? formatTime(incident.responseAt) : 'No response'}</dd>
        </div>
        <div className="detail-list-item">
          <dt>CEO Notification</dt>
          <dd>{incident.ceoNotified === null ? 'Not available' : incident.ceoNotified ? 'Sent ✓' : 'Not sent'}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Team Notification</dt>
          <dd>{incident.teamNotified === null ? 'Not available' : incident.teamNotified ? 'Sent ✓' : 'Not sent'}</dd>
        </div>
      </dl>

      <section className="detail-section">
        <h3>Timeline</h3>
        <Timeline
          items={incident.timeline.map((step) => ({
            id: step.id,
            label: step.label,
            timestamp: formatTime(step.timestamp),
            tone: slaStatusTone(incident.status),
          }))}
        />
      </section>
    </Drawer>
  );
}
