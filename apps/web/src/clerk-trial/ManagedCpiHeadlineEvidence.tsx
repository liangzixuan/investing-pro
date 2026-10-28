import type { CalendarSourceCapture } from "./managed-calendar-followup";
export function ManagedCpiHeadlineEvidence({
  capture,
}: {
  capture: CalendarSourceCapture;
}) {
  if (capture.source.kind !== "cpi") return null;
  const { item, packet, showingPrevious } = capture.source;
  return (
    <section aria-label="Selected CPI headline source">
      <h4>{item.title}</h4>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>
            {packet.source.name} · {packet.source.topic}
          </dd>
        </div>
        <div>
          <dt>Feed published time</dt>
          <dd>{item.publishedAt ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Feed updated time</dt>
          <dd>{item.updatedAt ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Feed-level updated time</dt>
          <dd>{packet.feedUpdatedAt ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Retrieved (UTC)</dt>
          <dd>{packet.fetchedAt}</dd>
        </div>
        <div>
          <dt>Source entry ID</dt>
          <dd>{item.sourceId}</dd>
        </div>
        <div>
          <dt>Original source URL</dt>
          <dd>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {item.url}
            </a>
          </dd>
        </div>
      </dl>
      {showingPrevious && (
        <p role="status">
          Retained previous source. This attempt has not confirmed newer data.
        </p>
      )}
      <p>
        Feed clocks are publisher metadata, not independently verified
        economic-release or embargo times. Unknown clocks stay unknown. The
        authored UTC due date is separate. This headline does not establish
        company relevance.
      </p>
    </section>
  );
}
