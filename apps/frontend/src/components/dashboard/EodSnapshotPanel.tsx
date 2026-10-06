import { useNavigate } from 'react-router-dom';
import type { EodSnapshot } from '../../types/domain';
import { formatTime } from '../../lib/format';
import { ProgressBar } from '../ui/ProgressBar';
import { ChevronRightIcon } from '../ui/icons';

interface EodSnapshotPanelProps {
  snapshot: EodSnapshot;
}

export function EodSnapshotPanel({ snapshot }: EodSnapshotPanelProps) {
  const navigate = useNavigate();

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>EOD Reports</h2>
        <button type="button" className="link-button" onClick={() => navigate('/eod')}>
          View EOD
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
      <p className="eod-snapshot-headline">
        {snapshot.submitted} / {snapshot.total} submitted
      </p>
      <ProgressBar value={snapshot.submitted} max={snapshot.total} label="EOD submissions" tone="success" />
      <dl className="eod-snapshot-metrics">
        <div>
          <dt>Submitted</dt>
          <dd>{snapshot.submitted}</dd>
        </div>
        <div>
          <dt>Late</dt>
          <dd>{snapshot.late}</dd>
        </div>
        <div>
          <dt>Missing</dt>
          <dd>{snapshot.missing}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{formatTime(snapshot.deadline)}</dd>
        </div>
      </dl>
    </div>
  );
}
