import type { PropsWithChildren } from 'react';

export function FilterBar({ children }: PropsWithChildren) {
  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      {children}
    </div>
  );
}

interface FilterPillsProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterPills<T extends string>({ label, options, value, onChange }: FilterPillsProps<T>) {
  return (
    <div className="filter-pills" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filter-pill${option.value === value ? ' filter-pill-active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="filter-select">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
