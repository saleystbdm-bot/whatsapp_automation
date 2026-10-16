import { useMemo, useState } from 'react';
import { AddGroupModal } from '../components/groups/AddGroupModal';
import { AvailableGroupCard, MonitoredGroupCard } from '../components/groups/GroupCard';
import { GroupConfigModal } from '../components/groups/GroupConfigModal';
import { GroupDetailsDrawer } from '../components/groups/GroupDetailsDrawer';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { StatusBadge } from '../components/ui/StatusBadge';
import { InboxIcon, PlusIcon, RefreshIcon, UsersGroupIcon } from '../components/ui/icons';
import { fetchAllGroups, fetchMonitoredGroups, syncWassengerGroups, updateGroup } from '../data/repository';
import { useEditableAsyncData } from '../hooks/useEditableAsyncData';
import type { SyncWassengerResponse } from '../data/backend-types';
import type { MonitoredGroup, WhatsAppGroup } from '../types/domain';

type ConfigModalState =
  | { mode: 'monitor'; group: WhatsAppGroup }
  | { mode: 'edit'; group: MonitoredGroup };

export function GroupsPage() {
  const {
    items: availableGroups,
    setItems: setAvailableGroups,
    loading: loadingAvailable,
    error: errorAvailable,
    refetch: refetchAvailable,
  } = useEditableAsyncData(fetchAllGroups, []);
  const {
    items: monitoredGroups,
    setItems: setMonitoredGroups,
    loading: loadingMonitored,
    error: errorMonitored,
    refetch: refetchMonitored,
  } = useEditableAsyncData(fetchMonitoredGroups, []);

  function refetchGroups() {
    refetchAvailable();
    refetchMonitored();
  }

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MonitoredGroup | null>(null);
  const [configModal, setConfigModal] = useState<ConfigModalState | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isSyncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncWassengerResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const filteredAvailableGroups = useMemo(() => {
    if (!availableGroups) return [];
    const term = search.trim().toLowerCase();
    if (!term) return availableGroups;
    return availableGroups.filter((group) => group.name.toLowerCase().includes(term));
  }, [availableGroups, search]);

  function handleMonitor(group: WhatsAppGroup) {
    // Enabling monitoring requires configuring category/SLA/keywords
    // first — see GroupConfigModal. `active` is only set once that save
    // succeeds.
    setMutationError(null);
    setConfigModal({ mode: 'monitor', group });
  }

  function handleEditConfiguration(group: MonitoredGroup) {
    setSelectedGroup(null); // close the details drawer while editing
    setMutationError(null);
    setConfigModal({ mode: 'edit', group });
  }

  function handleConfigSaved(saved: MonitoredGroup) {
    if (configModal?.mode === 'monitor') {
      setAvailableGroups((prev) => prev?.filter((item) => item.id !== saved.id) ?? prev);
      setMonitoredGroups((prev) => [...(prev ?? []), saved]);
    } else {
      setMonitoredGroups((prev) => prev?.map((item) => (item.id === saved.id ? saved : item)) ?? prev);
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

  async function handleSyncWassenger() {
    if (isSyncing) return; // guard against a second click while one sync is in flight
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await syncWassengerGroups();
      setSyncResult(result);
      // Imported groups are always unmonitored (active: false), so they
      // only ever change the Available list — refetch both anyway so a
      // renamed *monitored* group's new name shows up too.
      refetchGroups();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync groups from Wassenger.');
    } finally {
      setSyncing(false);
    }
  }

  const loading = loadingAvailable || loadingMonitored;
  const error = errorAvailable ?? errorMonitored;

  return (
    <section className="page">
      <PageHeader
        title="Groups"
        subtitle="Select the WhatsApp groups you want to monitor."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => void handleSyncWassenger()} disabled={isSyncing}>
              <RefreshIcon aria-hidden="true" />
              {isSyncing ? 'Syncing…' : 'Sync WhatsApp Groups'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAddModalOpen(true)}>
              <PlusIcon aria-hidden="true" />
              Add Group
            </button>
          </>
        }
      />

      {loading && <LoadingState label="Loading groups…" />}
      {!loading && error && <ErrorState message={error} onRetry={refetchGroups} />}
      {!loading && !error && mutationError && <ErrorState message={mutationError} />}
      {!loading && !error && syncError && <ErrorState message={syncError} onRetry={handleSyncWassenger} />}
      {!loading && !error && syncResult && (
        <div className="panel" role="status">
          <StatusBadge tone="success" dot={false} label="Sync complete" />
          <p className="panel-subtitle">
            Fetched {syncResult.totalFetched} group{syncResult.totalFetched === 1 ? '' : 's'} from Wassenger —{' '}
            {syncResult.created} new, {syncResult.updated} renamed, {syncResult.unchanged} unchanged.
          </p>
        </div>
      )}

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
          onEditConfiguration={handleEditConfiguration}
        />
      )}

      {isAddModalOpen && <AddGroupModal onClose={() => setAddModalOpen(false)} onAdd={handleAdd} />}

      {configModal && (
        <GroupConfigModal
          groupId={configModal.group.id}
          groupName={configModal.group.name}
          mode={configModal.mode}
          initialType={configModal.mode === 'edit' ? configModal.group.type : undefined}
          initialSlaMinutes={configModal.mode === 'edit' ? configModal.group.slaMinutes : undefined}
          onClose={() => setConfigModal(null)}
          onSaved={handleConfigSaved}
        />
      )}
    </section>
  );
}
