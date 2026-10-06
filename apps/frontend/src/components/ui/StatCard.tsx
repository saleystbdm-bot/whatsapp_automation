import type { ReactNode } from 'react';
import type { BadgeTone } from './StatusBadge';

interface StatCardProps {
  title: string;
  value: ReactNode;
  supportingText: string;
  icon: ReactNode;
  tone?: BadgeTone;
}

export function StatCard({ title, value, supportingText, icon, tone = 'neutral' }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-title">{title}</span>
        <span className={`stat-card-icon stat-card-icon-${tone}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="stat-card-value">{value}</div>
      <div className={`stat-card-supporting stat-card-supporting-${tone}`}>{supportingText}</div>
    </div>
  );
}
