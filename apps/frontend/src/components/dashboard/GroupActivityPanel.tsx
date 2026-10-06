import type { GroupActivityItem } from '../../types/domain';

interface GroupActivityPanelProps {
  items: GroupActivityItem[];
}

export function GroupActivityPanel({ items }: GroupActivityPanelProps) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Group Activity</h2>
      </div>
      <ul className="group-activity-list">
        {items.map((item) => (
          <li key={item.groupName} className="group-activity-row">
            <span className="group-activity-name">{item.groupName}</span>
            <span className="group-activity-bar-track">
              <span
                className="group-activity-bar-fill"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </span>
            <span className="group-activity-count">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
