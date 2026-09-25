"use client";
export interface WorkspaceSearchProps {
  readonly query: string;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onChange: (query: string, origin: HTMLInputElement) => void;
  readonly onSearch: (origin: HTMLFormElement) => void;
}
export function WorkspaceSearch({
  query,
  busy,
  disabled,
  onChange,
  onSearch,
}: WorkspaceSearchProps) {
  return (
    <form
      className="workspace-global-search"
      role="search"
      aria-label="Find a company"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && !busy) onSearch(event.currentTarget);
      }}
    >
      <label className="sr-only" htmlFor="workspace-company-query">
        Find a company
      </label>
      <input
        id="workspace-company-query"
        name="company"
        type="search"
        autoComplete="off"
        spellCheck={false}
        maxLength={128}
        placeholder="Search ticker or company"
        value={query}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value, event.currentTarget)}
      />
      <button type="submit" disabled={disabled || busy}>
        {busy ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
