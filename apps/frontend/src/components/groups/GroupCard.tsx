import type { MonitoredGroup, WhatsAppGroup } from '../../types/domain';
import { GroupTypeBadge } from '../ui/StatusBadge';
import { UsersIcon } from '../ui/icons';

interface AvailableGroupCardProps {
  group: WhatsAppGroup;
  onMonitor: (group: WhatsAppGroup) => void;
}

export function AvailableGroupCard({ group, onMonitor }: AvailableGroupCardProps) {
  return (
    <div className="group-card">
      <div className="group-card-icon" aria-hidden="true">
        {group.name.charAt(0)}
      </div>
      <div className="group-card-body">
        <span className="group-card-name">{group.name}</span>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onMonitor(group)}>
        Monitor
      </button>
    </div>
  );
}

interface MonitoredGroupCardProps {
  group: MonitoredGroup;
  onOpenDetails: (group: MonitoredGroup) => void;
  onRemove: (group: MonitoredGroup) => void;
}

export function MonitoredGroupCard({ group, onOpenDetails, onRemove }: MonitoredGroupCardProps) {
  return (
    <div
      className="group-card group-card-interactive"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${group.name}`}
      onClick={() => onOpenDetails(group)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails(group);
        }
      }}
    >
      <div className="group-card-icon" aria-hidden="true">
        {group.name.charAt(0)}
      </div>
      <div className="group-card-body">
        <span className="group-card-name">{group.name}</span>
        <span className="group-card-meta">
          <GroupTypeBadge type={group.type} />
          <span>
            <UsersIcon aria-hidden="true" />
            {group.memberCount} members
          </span>
          <span>SLA: {group.slaMinutes} min</span>
        </span>
        <span className={`active-indicator${group.active ? ' active-indicator-on' : ''}`}>
          <span className="active-indicator-dot" aria-hidden="true" />
          {group.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-danger-ghost btn-sm"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(group);
        }}
      >
        Remove
      </button>
    </div>
  );
}
