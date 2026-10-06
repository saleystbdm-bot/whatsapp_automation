import { useMemo, useState } from 'react';
import { IssueDetailDrawer } from '../components/issues/IssueDetailDrawer';
import { IssueRow } from '../components/issues/IssueRow';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { FilterBar, FilterPills, FilterSelect } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { FlagIcon } from '../components/ui/icons';
import { getGroups, getIssue, getIssues, updateIssueStatus } from '../data/repository';
import { useAsyncData } from '../hooks/useAsyncData';
import { useEditableAsyncData } from '../hooks/useEditableAsyncData';
import type { Issue, IssueStatus } from '../types/domain';

type StatusFilter = 'ALL' | IssueStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export function IssuesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: groups } = useAsyncData(() => getGroups(), []);

  const {
    items: issues,
    setItems: setIssues,
    loading,
    error,
  } = useEditableAsyncData(
    () =>
      getIssues({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        groupId: groupFilter === 'ALL' ? undefined : groupFilter,
        search: search.trim() || undefined,
      }),
    [statusFilter, groupFilter, search],
  );

  const groupOptions = useMemo(() => {
    if (!groups) return [{ value: 'ALL', label: 'All Groups' }];
    return [{ value: 'ALL', label: 'All Groups' }, ...groups.map((group) => ({ value: group.id, label: group.name }))];
  }, [groups]);

  const { items: issueDetail, setItems: setIssueDetail } = useEditableAsyncData(
    () => (selectedIssueId ? getIssue(selectedIssueId) : Promise.resolve(null)),
    [selectedIssueId],
  );

  const selectedIssueFromList = issues?.find((issue) => issue.id === selectedIssueId) ?? null;
  const selectedIssue = issueDetail ?? selectedIssueFromList;

  async function handleStatusChange(issue: Issue, status: IssueStatus) {
    setMutationError(null);
    try {
      const updated = await updateIssueStatus(issue.id, status);
      setIssues((prev) => prev?.map((item) => (item.id === issue.id ? updated : item)) ?? prev);
      setIssueDetail(updated);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update issue status.');
    }
  }

  return (
    <section className="page">
      <PageHeader title="Issues" subtitle="All issues detected from monitored WhatsApp groups." />

      {loading && <LoadingState label="Loading issues…" />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && mutationError && <ErrorState message={mutationError} />}

      {!loading && !error && issues && (
        <>
          <FilterBar>
            <FilterPills label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
            <SearchInput
              id="issue-search"
              label="Search issues"
              placeholder="Search issues..."
              value={search}
              onChange={setSearch}
            />
            <FilterSelect id="issue-group-filter" label="Group" value={groupFilter} options={groupOptions} onChange={setGroupFilter} />
            <FilterSelect
              id="issue-date-filter"
              label="Date"
              value="TODAY"
              options={[{ value: 'TODAY', label: 'Today' }]}
              onChange={() => undefined}
            />
          </FilterBar>

          {issues.length === 0 ? (
            <EmptyState icon={<FlagIcon />} title="No issues found." description="Try adjusting your filters." />
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Issue</th>
                    <th scope="col">Group</th>
                    <th scope="col">Status</th>
                    <th scope="col">Reported</th>
                    <th scope="col">SLA</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} onView={(item) => setSelectedIssueId(item.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedIssue && (
        <IssueDetailDrawer
          issue={selectedIssue}
          onClose={() => setSelectedIssueId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </section>
  );
}
