import { EodSnapshotPanel } from '../components/dashboard/EodSnapshotPanel';
import { GroupActivityPanel } from '../components/dashboard/GroupActivityPanel';
import { LiveOperations } from '../components/dashboard/LiveOperations';
import { SlaPerformancePanel } from '../components/dashboard/SlaPerformancePanel';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterSelect } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { AlertIcon, CalendarCheckIcon, CheckCircleIcon, WarningTriangleIcon } from '../components/ui/icons';
import { fetchDashboardData } from '../data/repository';
import { useAsyncData } from '../hooks/useAsyncData';

export function DashboardPage() {
  const { data, loading, error, refetch } = useAsyncData(fetchDashboardData, []);

  return (
    <section className="page">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            <span className="page-greeting">Good morning, CEO</span>
            <span className="page-subtitle-row">
              Here&apos;s what&apos;s happening across your monitored WhatsApp groups.
            </span>
          </>
        }
        actions={
          <FilterSelect
            id="dashboard-date"
            label="Date"
            value="TODAY"
            options={[{ value: 'TODAY', label: 'Today' }]}
            onChange={() => undefined}
          />
        }
      />

      {loading && <LoadingState label="Loading dashboard…" />}
      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && data && (
        <>
          <div className="kpi-grid kpi-grid-4">
            <StatCard
              title="Active Issues"
              value={data.kpis.activeIssues}
              supportingText={data.kpis.activeIssuesDelta}
              icon={<AlertIcon />}
              tone="warning"
            />
            <StatCard
              title="SLA Compliance"
              value={`${data.kpis.slaCompliance}%`}
              supportingText={data.kpis.slaComplianceContext}
              icon={<CheckCircleIcon />}
              tone="success"
            />
            <StatCard
              title="SLA Missed"
              value={data.kpis.slaMissed}
              supportingText={data.kpis.slaMissedContext}
              icon={<WarningTriangleIcon />}
              tone="critical"
            />
            <StatCard
              title="EOD Reports"
              value={`${data.kpis.eodSubmitted} / ${data.kpis.eodTotal}`}
              supportingText={data.kpis.eodContext}
              icon={<CalendarCheckIcon />}
              tone="primary"
            />
          </div>

          <LiveOperations items={data.liveOperations} />

          <div className="dashboard-grid-2">
            <SlaPerformancePanel performance={data.slaPerformance} />
            <GroupActivityPanel items={data.groupActivity} />
          </div>

          <EodSnapshotPanel snapshot={data.eodSnapshot} />
        </>
      )}
    </section>
  );
}
