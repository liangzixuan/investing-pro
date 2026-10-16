import chart from "./icons/chart-bar.svg?raw";
import search from "./icons/search.svg?raw";
import bookmark from "./icons/bookmark.svg?raw";

const icons = {
  markets: chart,
  portfolio: chart,
  discover: search,
  watchlist: bookmark,
};

/** The three Tabler assets retain their shipped MIT notice. */
export function ManagedIcon({
  name,
}: {
  name: keyof typeof icons | "followups";
}) {
  if (name === "followups")
    return (
      <svg
        className="managed-icon"
        viewBox="0 0 24 24"
        width={22}
        height={22}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 6h10M10 12h10M10 18h10M3 5l2 2 3-4M3 11l2 2 3-4M3 17l2 2 3-4" />
      </svg>
    );
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
