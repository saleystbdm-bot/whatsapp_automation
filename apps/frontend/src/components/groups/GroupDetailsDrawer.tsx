import type { MonitoredGroup } from '../../types/domain';
import { Drawer } from '../ui/Drawer';
import { GroupTypeBadge } from '../ui/StatusBadge';

interface GroupDetailsDrawerProps {
  group: MonitoredGroup;
  onClose: () => void;
  onRemove: (group: MonitoredGroup) => void;
}

export function GroupDetailsDrawer({ group, onClose, onRemove }: GroupDetailsDrawerProps) {
  return (
    <Drawer
      title={
        <div className="drawer-title-block">
          <span className="drawer-title-main">{group.name}</span>
          <GroupTypeBadge type={group.type} />
        </div>
      }
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={() => {
            onRemove(group);
            onClose();
          }}
        >
          Remove Monitoring
        </button>
      }
    >
      <div className="detail-status-row">
        <span className={`active-indicator${group.active ? ' active-indicator-on' : ''}`}>
          <span className="active-indicator-dot" aria-hidden="true" />
          {group.active ? 'Monitoring Active' : 'Monitoring Paused'}
        </span>
      </div>

      <dl className="detail-list">
        <div className="detail-list-item">
          <dt>Group ID</dt>
          <dd className="detail-mono">{group.whatsappGroupId}</dd>
        </div>
        <div className="detail-list-item">
          <dt>SLA</dt>
          <dd>{group.slaMinutes} minutes</dd>
        </div>
      </dl>

      <section className="detail-section">
        <h3>Team</h3>
        <ul className="chip-list">
          {group.responsibleTeam.map((member) => (
            <li key={member.id} className="chip">
              {member.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h3>Issue Keywords</h3>
        <ul className="chip-list">
          {group.keywords.map((keyword) => (
            <li key={keyword} className="chip chip-muted">
              {keyword}
            </li>
          ))}
        </ul>
      </section>
    </Drawer>
  );
}
