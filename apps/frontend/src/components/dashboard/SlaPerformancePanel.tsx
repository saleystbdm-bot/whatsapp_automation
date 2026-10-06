import type { SlaPerformance } from '../../types/domain';

interface SlaPerformancePanelProps {
  performance: SlaPerformance;
}

function buildSparklinePoints(trend: number[], width: number, height: number): string {
  if (trend.length === 0) return '';
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const range = max - min || 1;
  return trend
    .map((value, index) => {
      const x = (index / (trend.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function SlaPerformancePanel({ performance }: SlaPerformancePanelProps) {
  const points = buildSparklinePoints(performance.trend, 160, 40);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>SLA Performance</h2>
      </div>
      <div className="sla-performance">
        <div className="sla-performance-headline">
          <span className="sla-performance-value">{performance.compliance}%</span>
          <span className="sla-performance-label">SLA Compliance</span>
          <svg
            className="sparkline"
            width="160"
            height="40"
            viewBox="0 0 160 40"
            role="img"
            aria-label={`SLA compliance trend, currently ${performance.compliance}%`}
          >
            <polyline points={points} fill="none" stroke="var(--color-success)" strokeWidth="2" />
          </svg>
        </div>
        <dl className="sla-performance-metrics">
          <div>
            <dt>Total Issues</dt>
            <dd>{performance.totalIssues}</dd>
          </div>
          <div>
            <dt>Responded</dt>
            <dd>{performance.responded}</dd>
          </div>
          <div>
            <dt>Missed</dt>
            <dd>{performance.missed}</dd>
          </div>
          <div>
            <dt>Open</dt>
            <dd>{performance.open}</dd>
          </div>
          <div>
            <dt>Average Response</dt>
            <dd>{performance.averageResponseMinutes} min</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
