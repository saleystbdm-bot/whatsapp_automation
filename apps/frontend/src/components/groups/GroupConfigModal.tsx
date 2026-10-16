import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { configureGroupMonitoring, getGroupKeywords } from '../../data/repository';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { GroupType, MonitoredGroup } from '../../types/domain';
import { Modal } from '../ui/Modal';
import { CloseIcon, PlusIcon } from '../ui/icons';

interface GroupConfigModalProps {
  groupId: string;
  groupName: string;
  /**
   * 'monitor': the group is not yet active — saving also sets active=true,
   * but only after category/SLA/keywords have all saved successfully.
   * 'edit': the group is already monitored — `active` is never touched.
   */
  mode: 'monitor' | 'edit';
  initialType?: GroupType;
  initialSlaMinutes?: number;
  onClose: () => void;
  onSaved: (group: MonitoredGroup) => void;
}

interface KeywordDraft {
  /** null for a keyword the user added this session (not yet persisted). */
  id: string | null;
  text: string;
}

export function GroupConfigModal({
  groupId,
  groupName,
  mode,
  initialType,
  initialSlaMinutes,
  onClose,
  onSaved,
}: GroupConfigModalProps) {
  // A re-monitored group may have been configured before (and still have
  // its keywords from that configuration) even though it's not active
  // right now — always load the real current list, for both modes.
  const { data: existingKeywords, loading: loadingKeywords } = useAsyncData(
    () => getGroupKeywords(groupId),
    [groupId],
  );

  // A freshly-imported Wassenger group is stored as type INTERNAL purely
  // as a placeholder default — pre-selecting it here would mean
  // "assuming" a category the user never actually chose. Only pre-fill
  // from the group's real stored value when editing an already-monitored
  // (so, actually configured) group.
  const [type, setType] = useState<GroupType | null>(mode === 'edit' ? (initialType ?? null) : null);
  const [slaMinutes, setSlaMinutes] = useState(String(initialSlaMinutes ?? 30));
  const [keywords, setKeywords] = useState<KeywordDraft[]>([]);
  const [keywordsSeeded, setKeywordsSeeded] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [errors, setErrors] = useState<{ type?: string; slaMinutes?: string; keyword?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed the editable list from the fetched keywords once, the first
  // render after they arrive (React's documented alternative to a
  // useEffect for "derive local editable state from async data").
  if (existingKeywords && !keywordsSeeded) {
    setKeywords(existingKeywords.map((keyword) => ({ id: keyword.id, text: keyword.keyword })));
    setKeywordsSeeded(true);
  }

  function addKeyword() {
    const text = keywordInput.trim();
    if (!text) {
      setErrors((prev) => ({ ...prev, keyword: 'Enter a keyword.' }));
      return;
    }
    if (keywords.some((keyword) => keyword.text.toLowerCase() === text.toLowerCase())) {
      setErrors((prev) => ({ ...prev, keyword: 'That keyword is already in the list.' }));
      return;
    }
    setKeywords((prev) => [...prev, { id: null, text }]);
    setKeywordInput('');
    setErrors((prev) => ({ ...prev, keyword: undefined }));
  }

  function removeKeyword(index: number) {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeywordInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addKeyword();
    }
  }

  function validate(): boolean {
    const nextErrors: typeof errors = {};
    if (!type) nextErrors.type = 'Select a category.';
    const slaValue = Number(slaMinutes);
    if (!slaMinutes.trim() || Number.isNaN(slaValue) || !Number.isInteger(slaValue) || slaValue < 1) {
      nextErrors.slaMinutes = 'Enter a whole number of minutes, 1 or more.';
    }
    setErrors((prev) => ({ ...prev, type: nextErrors.type, slaMinutes: nextErrors.slaMinutes }));
    return !nextErrors.type && !nextErrors.slaMinutes;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || !type) return;

    const currentTextsLower = new Set(keywords.map((keyword) => keyword.text.toLowerCase()));
    const keywordIdsToRemove = (existingKeywords ?? [])
      .filter((keyword) => !currentTextsLower.has(keyword.keyword.toLowerCase()))
      .map((keyword) => keyword.id);
    const keywordsToAdd = keywords.filter((keyword) => keyword.id === null).map((keyword) => keyword.text);

    setSubmitError(null);
    setSubmitting(true);
    try {
      const saved = await configureGroupMonitoring(groupId, {
        type,
        slaMinutes: Number(slaMinutes),
        keywordsToAdd,
        keywordIdsToRemove,
        activate: mode === 'monitor',
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save group configuration.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={mode === 'monitor' ? 'Configure Group Monitoring' : 'Edit Group Configuration'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <p className="form-group-name">{groupName}</p>

        <fieldset className="form-field">
          <legend>Group Category</legend>
          <div className="checkbox-group" role="radiogroup" aria-label="Group category">
            <label className="checkbox-option">
              <input
                type="radio"
                name="group-category"
                checked={type === 'INTERNAL'}
                onChange={() => setType('INTERNAL')}
              />
              Internal
            </label>
            <label className="checkbox-option">
              <input
                type="radio"
                name="group-category"
                checked={type === 'CLIENT'}
                onChange={() => setType('CLIENT')}
              />
              Client
            </label>
          </div>
          {errors.type && <span className="form-error">{errors.type}</span>}
        </fieldset>

        <div className="form-field">
          <label htmlFor="group-config-sla">SLA Duration (minutes)</label>
          <input
            id="group-config-sla"
            type="number"
            min={1}
            step={1}
            value={slaMinutes}
            onChange={(event) => setSlaMinutes(event.target.value)}
            aria-invalid={Boolean(errors.slaMinutes)}
            aria-describedby={errors.slaMinutes ? 'group-config-sla-error' : undefined}
          />
          <span className="form-hint">
            {Number.isInteger(Number(slaMinutes)) && Number(slaMinutes) > 0
              ? `${Number(slaMinutes)} minute${Number(slaMinutes) === 1 ? '' : 's'}`
              : 'Default: 30 minutes'}
          </span>
          {errors.slaMinutes && (
            <span id="group-config-sla-error" className="form-error">
              {errors.slaMinutes}
            </span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="group-config-keyword">Issue Keywords</label>
          {loadingKeywords && <span className="form-hint">Loading existing keywords…</span>}
          <ul className="chip-list">
            {keywords.map((keyword, index) => (
              <li key={keyword.id ?? `new-${keyword.text.toLowerCase()}`} className="chip chip-removable">
                {keyword.text}
                <button
                  type="button"
                  className="chip-remove-btn"
                  aria-label={`Remove keyword ${keyword.text}`}
                  onClick={() => removeKeyword(index)}
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
          <div className="form-row-inline">
            <input
              id="group-config-keyword"
              type="text"
              placeholder="e.g. payment"
              value={keywordInput}
              disabled={loadingKeywords}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleKeywordInputKeyDown}
              aria-invalid={Boolean(errors.keyword)}
            />
            <button type="button" className="btn btn-secondary btn-sm" disabled={loadingKeywords} onClick={addKeyword}>
              <PlusIcon aria-hidden="true" />
              Add
            </button>
          </div>
          {errors.keyword && <span className="form-error">{errors.keyword}</span>}
          <span className="form-hint">Used to detect issue messages in this group.</span>
        </div>

        {submitError && <span className="form-error">{submitError}</span>}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'monitor' ? 'Save & Start Monitoring' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
