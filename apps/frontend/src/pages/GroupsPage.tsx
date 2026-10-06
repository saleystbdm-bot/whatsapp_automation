import { useMemo, useState } from 'react';
import { AddGroupModal } from '../components/groups/AddGroupModal';
import { AvailableGroupCard, MonitoredGroupCard } from '../components/groups/GroupCard';
import { GroupDetailsDrawer } from '../components/groups/GroupDetailsDrawer';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { InboxIcon, PlusIcon, UsersGroupIcon } from '../components/ui/icons';
import { fetchAllGroups, fetchMonitoredGroups, updateGroup } from '../data/repository';
import { useEditableAsyncData } from '../hooks/useEditableAsyncData';
import type { MonitoredGroup, WhatsAppGroup } from '../types/domain';

export function GroupsPage() {
  const {
    items: availableGroups,
    setItems: setAvailableGroups,
    loading: loadingAvailable,
    error: errorAvailable,
  } = useEditableAsyncData(fetchAllGroups, []);
  const {
    items: monitoredGroups,
    setItems: setMonitoredGroups,
    loading: loadingMonitored,
    error: errorMonitored,
  } = useEditableAsyncData(fetchMonitoredGroups, []);

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MonitoredGroup | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const filteredAvailableGroups = useMemo(() => {
    if (!availableGroups) return [];
    const term = search.trim().toLowerCase();
    if (!term) return availableGroups;
    return availableGroups.filter((group) => group.name.toLowerCase().includes(term));
  }, [availableGroups, search]);

  async function handleMonitor(group: WhatsAppGroup) {
    setMutationError(null);
    try {
      const updated = await updateGroup(group.id, { active: true });
      setAvailableGroups((prev) => prev?.filter((item) => item.id !== group.id) ?? prev);
      setMonitoredGroups((prev) => [...(prev ?? []), updated]);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to monitor group.');
    }
  }

  async function handleRemove(group: MonitoredGroup) {
    setMutationError(null);
    try {
      const updated = await updateGroup(group.id, { active: false });
      setMonitoredGroups((prev) => prev?.filter((item) => item.id !== group.id) ?? prev);
      setAvailableGroups((prev) => [...(prev ?? []), updated]);
      setSelectedGroup(null);
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to remove group from monitoring.');
    }
  }

  function handleAdd(group: MonitoredGroup) {
    // POST /groups always creates an unmonitored group (active: false), so
    // the new group belongs in "Available", not "Monitored" — enable
    // monitoring separately via the "Monitor" action.
    setAvailableGroups((prev) => [...(prev ?? []), group]);
  }

  const loading = loadingAvailable || loadingMonitored;
  const error = errorAvailable ?? errorMonitored;

  return (
    <section className="page">
      <PageHeader
        title="Groups"
        subtitle="Select the WhatsApp groups you want to monitor."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
            <PlusIcon aria-hidden="true" />
            Add Group
          </button>
        }
      />

      {loading && <LoadingState label="Loading groups…" />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && mutationError && <ErrorState message={mutationError} />}

      {!loading && !error && availableGroups && monitoredGroups && (
        <div className="groups-layout">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>All WhatsApp Groups</h2>
                <p className="panel-subtitle">Available groups</p>
              </div>
            </div>
            <SearchInput
              id="group-search"
              label="Search groups"
              placeholder="Search groups..."
              value={search}
              onChange={setSearch}
            />
            <div className="group-list">
              {filteredAvailableGroups.length === 0 ? (
                <EmptyState
                  icon={<UsersGroupIcon />}
                  title="No groups found"
                  description="Try a different search term."
                />
              ) : (
                filteredAvailableGroups.map((group) => (
                  <AvailableGroupCard key={group.id} group={group} onMonitor={handleMonitor} />
                ))
              )}
            </div>
          </div>

          <div className="panel panel-accent">
            <div className="panel-header">
              <div>
                <h2>Monitored Groups</h2>
                <p className="panel-subtitle">{monitoredGroups.length} groups monitored</p>
              </div>
            </div>
            <div className="group-list">
              {monitoredGroups.length === 0 ? (
                <EmptyState
                  icon={<InboxIcon />}
                  title="No monitored groups yet."
                  description="Monitor a group from the left panel to start tracking issues and SLAs."
                />
              ) : (
                monitoredGroups.map((group) => (
                  <MonitoredGroupCard
                    key={group.id}
                    group={group}
                    onOpenDetails={setSelectedGroup}
                    onRemove={handleRemove}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <GroupDetailsDrawer
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
          onRemove={handleRemove}
        />
      )}

      {isAddModalOpen && <AddGroupModal onClose={() => setAddModalOpen(false)} onAdd={handleAdd} />}
    </section>
  );
}
