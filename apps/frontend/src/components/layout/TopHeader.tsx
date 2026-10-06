import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellIcon, ChevronDownIcon } from '../ui/icons';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/groups': 'Groups',
  '/sla': 'SLA Monitor',
  '/issues': 'Issues',
  '/eod': 'EOD Reports',
};

export function TopHeader() {
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const title = PAGE_TITLES[location.pathname] ?? 'WhatsApp Operations';

  return (
    <header className="top-header">
      <span className="top-header-title">{title}</span>
      <div className="top-header-actions">
        <button type="button" className="icon-button" aria-label="Notifications">
          <BellIcon aria-hidden="true" />
          <span className="notification-dot" aria-hidden="true" />
        </button>
        <div className="profile-menu">
          <button
            type="button"
            className="profile-menu-trigger"
            aria-haspopup="true"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="profile-avatar" aria-hidden="true">
              CEO
            </span>
            <span className="profile-name">CEO</span>
            <ChevronDownIcon aria-hidden="true" />
          </button>
          {profileOpen && (
            <div className="profile-menu-panel" role="menu">
              <span className="profile-menu-item" role="menuitem">
                ceo@whatsappoperations.com
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
