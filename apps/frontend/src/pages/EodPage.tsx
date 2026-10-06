import { useMemo, useState } from 'react';
import { EodDetailDrawer } from '../components/eod/EodDetailDrawer';
import { EodRow } from '../components/eod/EodRow';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { ProgressBar } from '../components/ui/ProgressBar';
import { StatCard } from '../components/ui/StatCard';
import { CalendarCheckIcon, CheckCircleIcon, ClockIcon, WarningTriangleIcon } from '../components/ui/icons';
import { fetchEodReports, type EodData } from '../data/repository';
import { useEditableAsyncData } from '../hooks/useEditableAsyncData';

export function EodPage() {
  const { items: data, loading, error } = useEditableAsyncData<EodData>(fetchEodReports, []);
  const reports = data?.reports ?? null;
  const [selectedReportKey, setSelectedReportKey] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!reports) return { submitted: 0, late: 0, missing: 0, total: 0 };
    return {
      submitted: reports.filter((report) => report.status === 'ON_TIME' || report.status === 'LATE').length,
      late: reports.filter((report) => report.status === 'LATE').length,
      missing: reports.filter((report) => report.status === 'MISSING').length,
      total: reports.length,
    };
  }, [reports]);

  const selectedReport = reports?.find((report) => (report.id ?? report.memberId) === selectedReportKey) ?? null;

  return (
    <section className="page">
      <PageHeader
        title="EOD Reports"
        subtitle={
          <span className="page-subtitle-row">Today · Deadline: {data?.deadlineLabel ?? '7:00 PM'}</span>
        }
      />

      {loading && <LoadingState label="Loading EOD reports…" />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && reports && data && (
        <>
          <div className="kpi-grid kpi-grid-3">
            <StatCard
              title="Submitted"
              value={`${summary.submitted}`}
              supportingText={summary.total > 0 ? `${Math.round((summary.submitted / summary.total) * 100)}%` : '0%'}
              icon={<CheckCircleIcon />}
              tone="success"
            />
            <StatCard title="Late" value={`${summary.late}`} supportingText="Submitted after deadline" icon={<ClockIcon />} tone="warning" />
            <StatCard title="Missing" value={`${summary.missing}`} supportingText="No submission yet" icon={<WarningTriangleIcon />} tone="critical" />
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>
                {summary.submitted} / {summary.total} submitted
              </h2>
            </div>
            <ProgressBar value={summary.submitted} max={summary.total} label="EOD submission progress" tone="success" />
          </div>

          {reports.length === 0 ? (
            <EmptyState icon={<CalendarCheckIcon />} title="No EOD reports found." />
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Time</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <EodRow
                      key={report.id ?? report.memberId}
                      report={report}
                      onView={(item) => setSelectedReportKey(item.id ?? item.memberId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedReport && data && (
        <EodDetailDrawer
          report={selectedReport}
          deadlineLabel={data.deadlineLabel}
          onClose={() => setSelectedReportKey(null)}
        />
      )}
    </section>
  );
}
