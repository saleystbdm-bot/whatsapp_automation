import { useMemo, useState } from 'react';
import { SlaDetailDrawer } from '../components/sla/SlaDetailDrawer';
import { SlaRow } from '../components/sla/SlaRow';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar, FilterPills, FilterSelect } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { GaugeIcon } from '../components/ui/icons';
import { getGroups, getSlaIncidents } from '../data/repository';
import { useAsyncData } from '../hooks/useAsyncData';
import type { GroupType, SlaIncident, SlaStatus } from '../types/domain';

type StatusFilter = 'ALL' | Extract<SlaStatus, 'OPEN' | 'RESPONDED' | 'MISSED'>;
type TypeFilter = 'ALL' | GroupType;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'RESPONDED', label: 'Responded' },
  { value: 'MISSED', label: 'Missed' },
];

export function SlaPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<SlaIncident | null>(null);

  const { data: groups } = useAsyncData(() => getGroups(), []);

  const {
    data: incidents,
    loading,
    error,
    refetch,
  } = useAsyncData(
    () =>
      getSlaIncidents({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        groupId: groupFilter === 'ALL' ? undefined : groupFilter,
        groupType: typeFilter === 'ALL' ? undefined : typeFilter,
      }),
    [statusFilter, groupFilter, typeFilter],
  );

  const groupOptions = useMemo(() => {
    if (!groups) return [{ value: 'ALL', label: 'All Groups' }];
    return [{ value: 'ALL', label: 'All Groups' }, ...groups.map((group) => ({ value: group.id, label: group.name }))];
  }, [groups]);

  return (
    <section className="page">
      <PageHeader
        title="SLA Monitor"
        subtitle={
          <span className="live-indicator">
            <span className="live-dot" aria-hidden="true" />
            Live SLA status across monitored groups.
          </span>
        }
      />

      {loading && <LoadingState label="Loading SLA incidents…" />}
      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && incidents && (
        <>
          <FilterBar>
            <FilterPills label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            <FilterSelect id="sla-group-filter" label="Group" value={groupFilter} options={groupOptions} onChange={setGroupFilter} />
            <FilterSelect
              id="sla-type-filter"
              label="Type"
              value={typeFilter}
              options={[
                { value: 'ALL', label: 'All Types' },
                { value: 'INTERNAL', label: 'Internal' },
                { value: 'CLIENT', label: 'Client' },
              ]}
              onChange={(value) => setTypeFilter(value as TypeFilter)}
            />
            <FilterSelect
              id="sla-date-filter"
              label="Date"
              value="TODAY"
              options={[{ value: 'TODAY', label: 'Today' }]}
              onChange={() => undefined}
            />
          </FilterBar>

          {incidents.length === 0 ? (
            <EmptyState
              icon={<GaugeIcon />}
              title="No SLA incidents found."
              description="Try adjusting your filters."
            />
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Issue</th>
                    <th scope="col">Group</th>
                    <th scope="col">Type</th>
                    <th scope="col">Elapsed</th>
                    <th scope="col">SLA</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <SlaRow key={incident.id} incident={incident} onView={setSelectedIncident} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedIncident && (
        <SlaDetailDrawer incident={selectedIncident} onClose={() => setSelectedIncident(null)} />
      )}
    </section>
  );
}
