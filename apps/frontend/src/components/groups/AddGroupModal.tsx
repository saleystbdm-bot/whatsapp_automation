import { useState, type FormEvent } from 'react';
import type { GroupType, MonitoredGroup } from '../../types/domain';
import { createGroup, fetchTeamMembers } from '../../data/repository';
import { useAsyncData } from '../../hooks/useAsyncData';
import { Modal } from '../ui/Modal';

interface AddGroupModalProps {
  onClose: () => void;
  onAdd: (group: MonitoredGroup) => void;
}

interface FormState {
  name: string;
  whatsappGroupId: string;
  type: GroupType;
  slaMinutes: string;
  responsibleTeam: string[];
  keywords: string;
}

const INITIAL_STATE: FormState = {
  name: '',
  whatsappGroupId: '',
  type: 'INTERNAL',
  slaMinutes: '30',
  responsibleTeam: [],
  keywords: '',
};

export function AddGroupModal({ onClose, onAdd }: AddGroupModalProps) {
  const { data: teamMembers, loading: loadingTeam } = useAsyncData(fetchTeamMembers, []);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTeamMember(memberId: string) {
    setForm((prev) => ({
      ...prev,
      responsibleTeam: prev.responsibleTeam.includes(memberId)
        ? prev.responsibleTeam.filter((id) => id !== memberId)
        : [...prev.responsibleTeam, memberId],
    }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Group name is required.';
    if (!form.whatsappGroupId.trim()) nextErrors.whatsappGroupId = 'WhatsApp Group ID is required.';
    const slaValue = Number(form.slaMinutes);
    if (!form.slaMinutes.trim() || Number.isNaN(slaValue) || slaValue <= 0) {
      nextErrors.slaMinutes = 'Enter a valid SLA duration in minutes.';
    }
    if (form.responsibleTeam.length === 0) {
      nextErrors.responsibleTeam = 'Select at least one responsible team member.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const keywords = form.keywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    setSubmitError(null);
    setSubmitting(true);
    try {
      const newGroup = await createGroup({
        whatsappGroupId: form.whatsappGroupId.trim(),
        name: form.name.trim(),
        type: form.type,
        slaMinutes: Number(form.slaMinutes),
        memberIds: form.responsibleTeam,
        keywords,
      });
      onAdd(newGroup);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add Group" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="group-name">Group Name</label>
          <input
            id="group-name"
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'group-name-error' : undefined}
          />
          {errors.name && (
            <span id="group-name-error" className="form-error">
              {errors.name}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="group-whatsapp-id">WhatsApp Group ID</label>
          <input
            id="group-whatsapp-id"
            type="text"
            placeholder="120363xxxxxxxxxx@g.us"
            value={form.whatsappGroupId}
            onChange={(event) => updateField('whatsappGroupId', event.target.value)}
            aria-invalid={Boolean(errors.whatsappGroupId)}
            aria-describedby={errors.whatsappGroupId ? 'group-whatsapp-id-error' : undefined}
          />
          {errors.whatsappGroupId && (
            <span id="group-whatsapp-id-error" className="form-error">
              {errors.whatsappGroupId}
            </span>
          )}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="group-type">Group Type</label>
            <select
              id="group-type"
              value={form.type}
              onChange={(event) => updateField('type', event.target.value as GroupType)}
            >
              <option value="INTERNAL">INTERNAL</option>
              <option value="CLIENT">CLIENT</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="group-sla">SLA Duration (minutes)</label>
            <input
              id="group-sla"
              type="number"
              min={1}
              value={form.slaMinutes}
              onChange={(event) => updateField('slaMinutes', event.target.value)}
              aria-invalid={Boolean(errors.slaMinutes)}
              aria-describedby={errors.slaMinutes ? 'group-sla-error' : undefined}
            />
            {errors.slaMinutes && (
              <span id="group-sla-error" className="form-error">
                {errors.slaMinutes}
              </span>
            )}
          </div>
        </div>

        <fieldset className="form-field">
          <legend>Responsible Team</legend>
          <div className="checkbox-group">
            {loadingTeam && <span className="form-hint">Loading team…</span>}
            {(teamMembers ?? []).map((member) => (
              <label key={member.id} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={form.responsibleTeam.includes(member.id)}
                  onChange={() => toggleTeamMember(member.id)}
                />
                {member.name}
              </label>
            ))}
          </div>
          {errors.responsibleTeam && <span className="form-error">{errors.responsibleTeam}</span>}
        </fieldset>

        <div className="form-field">
          <label htmlFor="group-keywords">Keywords</label>
          <input
            id="group-keywords"
            type="text"
            placeholder="payment, error, urgent"
            value={form.keywords}
            onChange={(event) => updateField('keywords', event.target.value)}
          />
          <span className="form-hint">Comma-separated. Used to detect issue messages.</span>
        </div>

        {submitError && <span className="form-error">{submitError}</span>}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
