import type { Ref } from "react";
import type {
  ManagedEodIdentity,
  ManagedBlsCalendarDto,
  PersonalEconomicCalendarDto,
  ManagedCpiHeadlinesDto,
  PersonalMonetaryAnnouncementsDto,
} from "@research-cockpit/contracts";
import type { ManagedMarketsBriefingReading as Reading } from "./managed-markets-briefing";
import type {
  MarketsSourceOutcome,
  MarketsSourceReviewRow,
} from "./managed-markets-source-review-types";
import { calendarFollowupEvidence } from "./managed-calendar-followup";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { RawCloseChange } from "./RawCloseChange";
import { ManagedFedRefreshComparisonDetails } from "./ManagedFedRefreshComparisonDetails";
import { BeaAgendaComparison } from "../features/markets/BeaAgendaComparison";
import "./managed-markets-briefing-reading.css";

const outcomes: Record<MarketsSourceOutcome, string> = {
  not_attempted: "Not attempted",
  retained: "Retained previous evidence",
  running: "Reading source",
  checked: "Checked",
  checked_empty: "Checked empty",
  failed: "Failed",
  cancelled: "Cancelled",
};
function Identity({ listing }: { listing: ManagedEodIdentity }) {
  return (
    <>
      <p>
        <ListingIdentity member={listing} />
      </p>
      <details>
        <summary>Complete listing identity</summary>
        <dl>
          {Object.entries(identityLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{listing[key as keyof typeof identityLabels]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
function SourceRow({
  row,
  plan,
}: {
  row: MarketsSourceReviewRow;
  plan: boolean;
}) {
  return (
    <li data-briefing-source={row.id}>
      <h4>{row.label}</h4>
      <p>
        {plan
          ? `${row.mode === "refresh" ? "Refresh" : "Load"} selected before Start`
          : row.selected
            ? "Selected in this pass"
            : "Not selected in this pass"}
      </p>
      <p data-source-outcome={row.outcome}>
        {outcomes[row.outcome]}
        {plan ? " before Start" : ""}
      </p>
      <p>{row.evidence}</p>
      {!row.eligible && <p>Unavailable for this plan</p>}
      {row.identity && <Identity listing={row.identity} />}
    </li>
  );
}
function SourcePass({ pass }: { pass: Reading["pass"] }) {
  return (
    <details open>
      <summary>Source pass and original plan</summary>
      <p>Pass state: {pass.phase}</p>
      <p>{pass.message}</p>
      <p>
        Each result belongs to its named source. Retained sources that were not
        selected were not checked by this pass.
      </p>
      <ul>
        {pass.rows.map((row) => (
          <SourceRow key={row.id} row={row} plan={false} />
        ))}
      </ul>
      <h3>Selected source read plan before Start</h3>
      {pass.plan.length ? (
        <ol>
          {pass.plan.map((row) => (
            <SourceRow key={row.id} row={row} plan />
          ))}
        </ol>
      ) : (
        <p>No source read plan was captured.</p>
      )}
    </details>
  );
}
function Board({ board }: { board: Reading["board"] }) {
  return (
    <details>
      <summary>Complete company board and raw prices</summary>
      <p>{board.message}</p>
      <p>Catalog: {board.catalogSnapshotSha256 ?? "Not available"}</p>
      <p>
        Board prices are raw closes in USD, not adjusted for splits or
        dividends. Coverage is limited to the admitted board listings.
      </p>
      {board.rows.length === 0 && (
        <p>The company board had no admitted rows in this briefing.</p>
      )}
      <ul>
        {board.rows.map((row) => (
          <li key={row.listing.listingId}>
            <Identity listing={row.listing} />
            {board.selectedListingId === row.listing.listingId && (
              <p>Selected board listing</p>
            )}
            <p>{row.message}</p>
            {row.error && <p>Last price read failed.</p>}
            {row.showingPrevious && (
              <p>
                Retained previous history. The latest attempt did not confirm
                newer prices.
              </p>
            )}
            {!row.response ? (
              <p>Price history was not loaded.</p>
            ) : (
              <>
                <dl>
                  <div>
                    <dt>Provider / basis / currency</dt>
                    <dd>
                      {row.response.provider} / {row.response.priceBasis} /{" "}
                      {row.response.currency}
                    </dd>
                  </div>
                  <div>
                    <dt>Requested range</dt>
                    <dd>{row.response.range}</dd>
                  </div>
                  <div>
                    <dt>Window</dt>
                    <dd>
                      {row.response.window.startDate} to{" "}
                      {row.response.window.endDate}
                    </dd>
                  </div>
                  <div>
                    <dt>Request started</dt>
                    <dd>{row.response.requestStartedAt}</dd>
                  </div>
                  <div>
                    <dt>Completed</dt>
                    <dd>{row.response.completedAt}</dd>
                  </div>
                  <div>
                    <dt>Response catalog</dt>
                    <dd>{row.response.catalogSnapshotSha256}</dd>
                  </div>
                </dl>
                <RawCloseChange
                  rows={row.response.rows}
                  id={`briefing-change-${row.listing.listingId}`}
                />
                <table>
                  <caption>
                    All loaded raw closes for {row.listing.symbol}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Raw close (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.response.rows.map((item) => (
                      <tr key={item.date}>
                        <td>{item.date}</td>
                        <td>{item.close}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {row.response.rows.length === 0 && (
                  <p>Checked: no raw closes were returned.</p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
interface SourceState {
  readonly showingPrevious: boolean;
  readonly message: string;
  readonly error: string | null;
}
function Qualification({ state }: { state: SourceState }) {
  return (
    <>
      <p>{state.message}</p>
      {state.error && (
        <p>
          Last source read:{" "}
          {state.error === "invalid_response"
            ? "Response could not be verified"
            : "Source unavailable"}
          .
        </p>
      )}
      {state.showingPrevious && (
        <p>
          Retained previous packet. This attempt did not confirm newer data;
          original clocks remain unchanged.
        </p>
      )}
    </>
  );
}
function Schedule({
  name,
  packet,
  state,
}: {
  name: string;
  packet: ManagedBlsCalendarDto | PersonalEconomicCalendarDto | null;
  state: SourceState;
}) {
  return (
    <details>
      <summary>{name}: complete loaded schedule</summary>
      <Qualification state={state} />
      {!packet ? (
        <p>{name} was not loaded.</p>
      ) : (
        <>
          <p>
            {packet.source.name} · {packet.source.id}
          </p>
          <p>
            <a
              href={packet.source.scheduleUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {packet.source.scheduleUrl}
            </a>
          </p>
          <p>Source time zone: {packet.source.timeZone}</p>
          <p>Retrieved (UTC): {packet.fetchedAt}</p>
          <p>
            Window: {packet.window.fromInclusive} (inclusive) to{" "}
            {packet.window.toExclusive} (exclusive).
          </p>
          <p>
            Showing all {packet.events.length} scheduled items in this loaded
            window. Scheduled releases do not confirm publication or released
            values.
          </p>
          {!packet.events.length && (
            <p>Checked: no scheduled releases in this loaded window.</p>
          )}
          <ul>
            {packet.events.map((item) => (
              <li key={JSON.stringify([item.series, item.scheduledAt])}>
                <h4>{item.series}</h4>
                <p>Scheduled time: {item.scheduledAt}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
function Feed({
  packet,
  state,
  cpi,
}: {
  packet: ManagedCpiHeadlinesDto | PersonalMonetaryAnnouncementsDto | null;
  state: SourceState;
  cpi: boolean;
}) {
  const name = cpi
    ? "Published CPI headlines"
    : "Federal Reserve announcements";
  return (
    <details>
      <summary>{name}: complete loaded metadata</summary>
      <Qualification state={state} />
      {!packet ? (
        <p>{name} were not loaded.</p>
      ) : (
        <>
          <p>
            {packet.source.name} · {packet.source.id}
          </p>
          <p>
            <a
              href={packet.source.feedUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {packet.source.feedUrl}
            </a>
          </p>
          <p>
            Feed directory:{" "}
            <a
              href={packet.source.directoryUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {packet.source.directoryUrl}
            </a>
          </p>
          {"topic" in packet.source && <p>Topic: {packet.source.topic}</p>}
          <p>Source time zone: {packet.source.timeZone}</p>
          <p>Retrieved (UTC): {packet.fetchedAt}</p>
          {"feedUpdatedAt" in packet && (
            <p>Feed-level updated time: {packet.feedUpdatedAt ?? "Unknown"}</p>
          )}
          <p>
            All {packet.items.length} admitted of {packet.availableItemCount}{" "}
            available items in this feed response. Coverage is limited to ten
            admitted items; this is not a complete archive.
          </p>
          <p>
            No article bodies or economic values are loaded.{" "}
            {cpi
              ? "Feed clocks do not independently establish release or embargo times."
              : "Unknown publication times stay unknown."}
          </p>
          {!packet.items.length && <p>Checked: no items were returned.</p>}
          <ul>
            {packet.items.map((item) => (
              <li key={item.url}>
                <h4>{item.title}</h4>
                <p>
                  {cpi ? "Feed published time" : "Publication time"}:{" "}
                  {item.publishedAt ?? "Unknown"}
                </p>
                {"updatedAt" in item && (
                  <p>Feed updated time: {item.updatedAt ?? "Unknown"}</p>
                )}
                {"sourceId" in item && <p>Source entry ID: {item.sourceId}</p>}
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.url}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
function SelectedEvidence({ reading }: { reading: Reading }) {
  const evidence = calendarFollowupEvidence(reading.selected);
  if (!evidence) return <p>The selected source item could not be verified.</p>;
  return (
    <section
      aria-label="Selected briefing item"
      data-briefing-selected={reading.selected.kind}
    >
      <h3>Selected item: {evidence.title}</h3>
      <p>{evidence.sourceName}</p>
      <p>
        {evidence.timeKind === "scheduled"
          ? "Scheduled time"
          : evidence.timeKind === "feed-published"
            ? "Feed published time"
            : "Publication time"}
        : {evidence.instant ?? "Unknown"}
      </p>
      {reading.selected.kind === "cpi" && (
        <>
          <p>Feed updated time: {evidence.itemUpdatedAt ?? "Unknown"}</p>
          <p>Feed-level updated time: {evidence.feedUpdatedAt ?? "Unknown"}</p>
          <p>Source entry ID: {evidence.sourceId}</p>
        </>
      )}
      <p>Retrieved (UTC): {evidence.fetchedAt}</p>
      {evidence.window && (
        <p>
          Window: {evidence.window.fromInclusive} (inclusive) to{" "}
          {evidence.window.toExclusive} (exclusive).
        </p>
      )}
      <a href={evidence.url} target="_blank" rel="noopener noreferrer">
        {evidence.url}
      </a>
      {evidence.showingPrevious && (
        <p>Selected item belongs to the retained previous packet.</p>
      )}
      {reading.selection && (
        <p>
          Reading selection: date {reading.selection.date || "All loaded dates"}
          ; source {reading.selection.source || "All sources"}; title filter{" "}
          {reading.selection.title || "None"}.
        </p>
      )}
      <h3>Authored check captured with this briefing</h3>
      <Identity listing={reading.entry.listing} />
      <p>{reading.entry.check}</p>
      <p>Authored UTC due date: {reading.entry.dueOn}</p>
      <p>Check ID: {reading.entry.id}</p>
      <p>
        Follow-ups holds the editable check and its separate Save. This reading
        retains the original question and source, without inferring company
        relevance.
      </p>
    </section>
  );
}
/** Complete retained evidence without source-read or draft-mutation capabilities. */
export function ManagedMarketsBriefingReading({
  reading,
  headingRef,
}: {
  reading: Reading;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <section
      className="managed-markets-briefing-reading"
      aria-labelledby="managed-markets-briefing-heading"
    >
      <h2 id="managed-markets-briefing-heading" tabIndex={-1} ref={headingRef}>
        Retained Markets briefing
      </h2>
      <p>
        The same reading and selected item from before Follow-ups. Each source
        keeps its original clocks and qualifications. Returning does not read a
        source.
      </p>
      <SelectedEvidence reading={reading} />
      <SourcePass pass={reading.pass} />
      <Board board={reading.board} />
      <Schedule name="BLS" packet={reading.bls.calendar} state={reading.bls} />
      <Schedule name="BEA" packet={reading.bea.agenda} state={reading.bea} />
      {reading.bea.refreshComparison && (
        <BeaAgendaComparison comparison={reading.bea.refreshComparison} />
      )}
      <Feed
        cpi={false}
        packet={reading.fed.announcements}
        state={reading.fed}
      />
      {reading.fed.refreshComparison && (
        <ManagedFedRefreshComparisonDetails
          comparison={reading.fed.refreshComparison}
          showingPrevious={reading.fed.showingPrevious}
        />
      )}
      <Feed cpi packet={reading.cpi.headlines} state={reading.cpi} />
    </section>
  );
}
