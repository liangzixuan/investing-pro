import type { ManagedEodHistoryResponseDto } from "@research-cockpit/contracts";
import { calculatePersonalRawCloseExtrema } from "@research-cockpit/personal-market-analytics";

/** Summarize only the admitted packet; the caller owns reads and its lifetime. */
export function ObservedRawCloseRange({
  response,
}: {
  response: ManagedEodHistoryResponseDto;
}) {
  const extrema = calculatePersonalRawCloseExtrema({ rows: response.rows });
  const first = response.rows[0];
  const last = response.rows.at(-1);
  if (extrema.status !== "available" || !first || !last) return null;
  return (
    <div
      className="managed-observed-close-range"
      role="group"
      aria-label="Observed raw-close range"
    >
      <dl>
        {(
          [
            ["Highest reported close · USD", extrema.highest],
            ["Lowest reported close · USD", extrema.lowest],
          ] as const
        ).map(([label, extreme]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="managed-observed-close-amount">
                {extreme.close}
              </span>{" "}
              <time dateTime={extreme.date}>{extreme.date}</time>
              {extreme.occurrences > 1 && (
                <small>
                  First of {extreme.occurrences} reported dates at this close.
                </small>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        Loaded request range:{" "}
        {response.range === "1y" ? "One year" : "One month"}. Among{" "}
        {response.rows.length} reported{" "}
        {response.rows.length === 1 ? "close" : "closes"} from {first.date} to{" "}
        {last.date}.
      </p>
      {response.rows.length === 1 && (
        <p>
          Only one reported close is available; both values use that
          observation.
        </p>
      )}
      <p>
        Missing trading dates may change these extremes. Raw closes are
        unadjusted for splits or dividends; these are not intraday highs or
        lows.
      </p>
    </div>
  );
}
