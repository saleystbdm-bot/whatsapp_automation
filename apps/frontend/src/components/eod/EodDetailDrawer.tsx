import type { EodReport } from '../../types/domain';
import { formatTime } from '../../lib/format';
import { Drawer } from '../ui/Drawer';
import { EodStatusBadge } from '../ui/StatusBadge';

interface EodDetailDrawerProps {
  report: EodReport;
  deadlineLabel: string;
  onClose: () => void;
}

export function EodDetailDrawer({ report, deadlineLabel, onClose }: EodDetailDrawerProps) {
  const isMissing = report.status === 'MISSING';

  return (
    <Drawer
      title={
        <div className="drawer-title-block">
          <span className="drawer-title-main">{report.member}</span>
          <EodStatusBadge status={report.status} />
        </div>
      }
      onClose={onClose}
      footer={
        isMissing ? (
          <button type="button" className="btn btn-primary btn-block" disabled title="Reminder sending is not available yet">
            Send Reminder
          </button>
        ) : undefined
      }
    >
      <dl className="detail-list">
        <div className="detail-list-item">
          <dt>Submission</dt>
          <dd>{report.submittedAt ? formatTime(report.submittedAt) : 'Not submitted'}</dd>
        </div>
        <div className="detail-list-item">
          <dt>Deadline</dt>
          <dd>{deadlineLabel}</dd>
        </div>
      </dl>

      {isMissing ? (
        <section className="detail-section">
          <h3>Reminder</h3>
          <p>{report.reminders.length > 0 ? 'Sent' : 'Not yet sent'}</p>
        </section>
      ) : (
        <section className="detail-section">
          <h3>EOD Report</h3>
          <ol className="eod-report-list">
            {report.content.map((line, index) => (
              <li key={`${report.memberId}-line-${index}`}>{line}</li>
            ))}
          </ol>
        </section>
      )}

      {report.reminders.length > 0 && (
        <section className="detail-section">
          <h3>Reminder History</h3>
          <ul className="reminder-history">
            {report.reminders.map((reminder) => (
              <li key={reminder.id}>
                <span className="reminder-time">{formatTime(reminder.timestamp)}</span>
                <span>{reminder.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Drawer>
  );
}
