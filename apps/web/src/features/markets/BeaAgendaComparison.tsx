import type { BeaAgendaComparison as Comparison } from "./bea-agenda-comparison";

export function BeaAgendaComparison({
  comparison,
}: {
  comparison: Comparison;
}) {
  return (
    <div className="managed-bea-refresh-comparison">
      <p className="managed-bea-refresh-count">
        Not in the previous loaded agenda: {comparison.addedEvents.length} of{" "}
        {comparison.current.events.length} scheduled releases.
      </p>
      <details>
        <summary>Compared loaded agendas</summary>
        <p>
          Windows move with each load. An entry can appear because the window
          moved or the schedule changed. This comparison does not establish
          publication, rescheduling or a complete schedule history.
        </p>
        <dl>
          {(
            [
              ["Previous", comparison.previous],
              ["Current", comparison.current],
            ] as const
          ).map(([label, agenda]) => (
            <div key={label}>
              <dt>{label} agenda</dt>
              <dd>
                Retrieved{" "}
                <time dateTime={agenda.fetchedAt}>{agenda.fetchedAt}</time>
                {" · "}
                {agenda.events.length} scheduled releases. Window:{" "}
                <time dateTime={agenda.window.fromInclusive}>
                  {agenda.window.fromInclusive}
                </time>
                {" to "}
                <time dateTime={agenda.window.toExclusive}>
                  {agenda.window.toExclusive}
                </time>
                {" (UTC; end excluded)."}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
