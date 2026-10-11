import chart from "./icons/chart-bar.svg?raw";
import search from "./icons/search.svg?raw";
import bookmark from "./icons/bookmark.svg?raw";

const icons = { markets: chart, discover: search, watchlist: bookmark };

/** Unmodified Tabler outline assets; their MIT notice ships with the client. */
export function ManagedIcon({ name }: { name: keyof typeof icons }) {
  return (
    <img
      className="managed-icon"
      src={`data:image/svg+xml,${encodeURIComponent(icons[name])}`}
      alt=""
      aria-hidden="true"
      width={22}
      height={22}
    />
  );
}
