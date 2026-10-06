import { SearchIcon } from './icons';

interface SearchInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ id, label, placeholder, value, onChange }: SearchInputProps) {
  return (
    <div className="search-input">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon className="search-input-icon" aria-hidden="true" />
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
