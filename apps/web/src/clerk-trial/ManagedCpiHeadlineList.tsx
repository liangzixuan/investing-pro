import type { ManagedCpiHeadlinesState } from "./managed-cpi-headlines";
interface Props {
  state: ManagedCpiHeadlinesState;
  filter: string;
  disabled: boolean;
  onKeep: (url: string, target: HTMLElement) => void;
}
export function ManagedCpiHeadlineList({
  state,
  filter,
  disabled,
  onKeep,
}: Props) {
  const rows =
    state.headlines?.items.filter((item) =>
      item.title.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
    ) ?? [];
  return !state.headlines ? (
    <p>CPI headlines have not been loaded.</p>
  ) : (
    <>
      <p>Retrieved (UTC): {state.headlines.fetchedAt}</p>
      <p>
        Feed-level updated time: {state.headlines.feedUpdatedAt ?? "Unknown"}
      </p>
      <p>
        Showing {rows.length} filtered of {state.headlines.items.length}{" "}
        admitted headlines; {state.headlines.availableItemCount} available in
        this feed response. This is bounded feed coverage, not a complete
        archive.
      </p>
      {state.headlines.items.length === 0 ? (
        <p>Checked: no CPI headlines were returned.</p>
      ) : rows.length === 0 ? (
        <p>No loaded CPI headlines match this filter.</p>
      ) : (
        <ul>
          {rows.map((item) => (
            <li key={item.url}>
              <h3>{item.title}</h3>
              <p>Feed published time: {item.publishedAt ?? "Unknown"}</p>
              <p>Feed updated time: {item.updatedAt ?? "Unknown"}</p>
              <p>Source entry ID: {item.sourceId}</p>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.url}
              </a>
              <button
                type="button"
                className="trial-secondary"
                disabled={disabled}
                onClick={(e) => onKeep(item.url, e.currentTarget)}
              >
                Keep a dated check
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
