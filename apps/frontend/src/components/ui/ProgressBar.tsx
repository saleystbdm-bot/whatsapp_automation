interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'critical';
}

export function ProgressBar({ value, max, label, tone = 'primary' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="progress-bar-wrapper">
      <div
        className="progress-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={`progress-bar-fill progress-bar-fill-${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
