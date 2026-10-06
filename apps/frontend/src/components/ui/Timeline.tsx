import type { BadgeTone } from './StatusBadge';

export interface TimelineItem {
  id: string;
  label: string;
  timestamp: string;
  tone?: BadgeTone;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={item.id} className="timeline-item">
          <span className={`timeline-dot timeline-dot-${item.tone ?? 'neutral'}`} aria-hidden="true" />
          <div className="timeline-content">
            <span className="timeline-label">{item.label}</span>
            <span className="timeline-timestamp">{item.timestamp}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
