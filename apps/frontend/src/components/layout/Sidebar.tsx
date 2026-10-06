import { NavLink } from 'react-router-dom';
import { FlagIcon, CalendarCheckIcon, GaugeIcon, GridIcon, UsersGroupIcon } from '../ui/icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { to: '/groups', label: 'Groups', icon: UsersGroupIcon },
  { to: '/sla', label: 'SLA', icon: GaugeIcon },
  { to: '/issues', label: 'Issues', icon: FlagIcon },
  { to: '/eod', label: 'EOD', icon: CalendarCheckIcon },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          W
        </span>
        <span className="sidebar-brand-name">WhatsApp Operations</span>
      </div>
      <nav className="sidebar-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
            >
              <Icon aria-hidden="true" />
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-status">
        <span className="status-dot" aria-hidden="true" />
        System Online
      </div>
    </aside>
  );
}
