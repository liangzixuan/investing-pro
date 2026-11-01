import {
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  ManagedFilingsReview,
  ManagedFilingsReviewState,
  ManagedFilingsReviewRow,
} from "./managed-filings-review";
import type {
  ManagedWatchlistDailyReviewCapture,
  WatchlistDailyReviewOutcomeStatus,
  WatchlistDailyReviewSource,
  WatchlistDailyReviewPlan,
  WatchlistDailyReviewState,
} from "./managed-watchlist-daily-review";
import { ListingIdentity } from "./ManagedListingIdentity";
import { ManagedWatchlistDailyReviewEvidence } from "./ManagedWatchlistDailyReviewEvidence";
import { useManagedWatchlistDailyReviewControls } from "./useManagedWatchlistDailyReviewControls";
import "./managed-watchlist-daily-review.css";

const labels: Record<WatchlistDailyReviewOutcomeStatus, string> = {
  retained: "Retained evidence; no request",
  unsupported: "Source not supported",
  "not-selected": "Source not selected",
  unattempted: "Not attempted",
  running: "Request in progress",
  loaded: "Loaded",
  "verified-empty": "Verified empty response",
  unavailable: "Source unavailable",
  failed: "Request failed",
  cooldown: "Source cooldown; no automatic retry",
  cancelled: "Cancelled",
};
export interface ManagedWatchlistDailyReviewProps {
  model: ManagedFilingsReview;
  state: ManagedFilingsReviewState;
  active: boolean;
  onViewDaily?: (
    capture: ManagedWatchlistDailyReviewCapture,
    opener: HTMLButtonElement,
  ) => void;
  dailyChecks?: ReactNode;
  onReset: (event: MouseEvent<HTMLButtonElement>) => void;
}

type DailyControls = ReturnType<typeof useManagedWatchlistDailyReviewControls>;
type HeadingRef = RefObject<HTMLHeadingElement | null>;
interface DailyLiveProps {
  model: ManagedFilingsReview;
  state: ManagedFilingsReviewState;
  controls: DailyControls;
  running: boolean;
}
interface DailySourceControlsProps extends DailyLiveProps {
  names: readonly WatchlistDailyReviewSource[];
  setNames: Dispatch<SetStateAction<readonly WatchlistDailyReviewSource[]>>;
  plan: WatchlistDailyReviewPlan | null;
  matches: boolean | null;
  previewHeading: HeadingRef;
}
export function DailySourceControls({
  model,
  state,
  controls,
  running,
  names,
  setNames,
  plan,
  matches,
  previewHeading,
}: DailySourceControlsProps) {
  return (
    <>
      <fieldset disabled={!controls.enabled || running}>
        <legend>Sources for this daily review</legend>
        {(["price", "filings"] as const).map((name) => (
          <label key={name}>
            <input
              type="checkbox"
              checked={names.includes(name)}
              onChange={() => {
                if (!controls.current() || running) return;
                setNames(
                  names.includes(name)
                    ? names.filter((value) => value !== name)
                    : [...names, name],
                );
              }}
            />
            {name === "price" ? "Price" : "Filings"}
          </label>
        ))}
      </fieldset>
      <div className="trial-actions">
        <button
          id="watchlist-daily-preview"
          type="button"
          disabled={!controls.enabled || running || !names.length}
          onClick={(event) => {
            controls.transition(event.currentTarget, previewHeading, () => {
              const prepared = model.prepareDaily(state, names);
              const installed = model.getSnapshot();
              return prepared && installed.daily?.plan === prepared
                ? installed
                : null;
            });
          }}
        >
          Preview daily source reads
        </button>
        <button
          id="watchlist-daily-run"
          type="button"
          disabled={
            !controls.enabled ||
            running ||
            !matches ||
            !plan ||
            !model.canRunDaily(state, plan)
          }
          onClick={() => {
            if (controls.current() && matches && plan)
              void model.runDaily(state, plan);
          }}
        >
          Run daily source reads
        </button>
        <button
          id="watchlist-daily-cancel"
          type="button"
          className="trial-secondary"
          disabled={!controls.enabled || !running}
          onClick={() => {
            if (controls.current() && running) model.cancelDaily();
          }}
        >
          Cancel daily source reads
        </button>
      </div>
    </>
  );
}
export function DailyPlanOutcomes({
  daily,
  finished,
  matches,
  previewHeading,
}: {
  daily: WatchlistDailyReviewState;
  finished: boolean;
  matches: boolean | null;
  previewHeading: HeadingRef;
}) {
  const plan = daily.plan;
  return plan ? (
    <section aria-labelledby="watchlist-daily-plan-heading">
      <h4 id="watchlist-daily-plan-heading" ref={previewHeading} tabIndex={-1}>
        Daily source plan and outcomes
      </h4>
      {!finished && !matches && (
        <p>Source choices changed. Preview them before Run.</p>
      )}
      <p>
        Only missing, supported, selected sources can make a request. A response
        does not complete an authored check.
      </p>
      <ol
        id="watchlist-daily-outcomes"
        aria-label="Ordered daily source outcomes"
      >
        {daily.outcomes.map((row) => (
          <li key={`${row.member.listing.listingId}:${row.source}`}>
            <ListingIdentity member={row.member.listing} />
            <p>
              {row.source === "price" ? "Price" : "Filings"}:{" "}
              {labels[row.status]}
            </p>
            <p>
              Preview:{" "}
              {row.disposition === "missing"
                ? "Missing evidence; selected for request"
                : labels[row.disposition]}
            </p>
          </li>
        ))}
      </ol>
    </section>
  ) : (
    <p>
      No source plan has been previewed. No source request has been made by this
      review.
    </p>
  );
}
export function DailyFinishedReading({
  rows,
  finishedHeading,
}: {
  rows: readonly ManagedFilingsReviewRow[];
  finishedHeading: HeadingRef;
}) {
  return (
    <section aria-labelledby="watchlist-daily-finished-heading">
      <h4
        id="watchlist-daily-finished-heading"
        ref={finishedHeading}
        tabIndex={-1}
      >
        Finished daily review
      </h4>
      <p>
        This complete reading is passive. Finish does not complete a check or
        save a resource.
      </p>
      <ol aria-label="All chosen daily review companies">
        {rows.map((row) => (
          <li key={row.member.listing.listingId}>
            <ManagedWatchlistDailyReviewEvidence row={row} />
          </li>
        ))}
      </ol>
    </section>
  );
}
interface DailyCompanyEvidenceProps extends DailyLiveProps {
  companyHeading: HeadingRef;
  canInspect: boolean;
  onViewDaily: ManagedWatchlistDailyReviewProps["onViewDaily"];
}
export function DailyCompanyEvidence({
  model,
  state,
  controls,
  running,
  companyHeading,
  canInspect,
  onViewDaily,
}: DailyCompanyEvidenceProps) {
  const selected = state.rows.find((row) => row.member === state.selected);
  return (
    <>
      <ol
        className="managed-filings-review-companies"
        aria-label="Companies in this daily review"
      >
        {state.rows.map((row) => (
          <li key={row.member.listing.listingId}>
            <button
              type="button"
              className="trial-secondary"
              disabled={!controls.enabled || running}
              aria-current={row.member === state.selected ? "true" : undefined}
              onClick={(event) =>
                controls.transition(event.currentTarget, companyHeading, () =>
                  model.select(state, row.member),
                )
              }
            >
              <ListingIdentity member={row.member.listing} />
            </button>
          </li>
        ))}
      </ol>
      {selected && (
        <section aria-labelledby="watchlist-daily-company-heading">
          <h4
            id="watchlist-daily-company-heading"
            ref={companyHeading}
            tabIndex={-1}
          >
            Selected company evidence
          </h4>
          <ManagedWatchlistDailyReviewEvidence row={selected} />
          <button
            id="watchlist-daily-inspect"
            type="button"
            disabled={!canInspect}
            onClick={(event) => {
              if (!controls.current()) return;
              const current = model.captureDaily(state);
              if (current && model.canAdmitDaily(current))
                onViewDaily?.(current, event.currentTarget);
            }}
          >
            Inspect Price and Filings in Research
          </button>
        </section>
      )}
    </>
  );
}

export function ManagedWatchlistDailyReview({
  model,
  state,
  active,
  onViewDaily,
  dailyChecks,
  onReset,
}: ManagedWatchlistDailyReviewProps) {
  const [names, setNames] = useState<readonly WatchlistDailyReviewSource[]>(
    state.daily?.plan?.names ?? [],
  );
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const companyHeading = useRef<HTMLHeadingElement>(null);
  const finishedHeading = useRef<HTMLHeadingElement>(null);
  const controls = useManagedWatchlistDailyReviewControls({
    model,
    state,
    active,
  });
  const daily = state.daily;
  if (!daily) return null;
  const running = daily.phase === "running";
  const finished = daily.phase === "finished";
  const plan = daily.plan;
  const matches =
    plan &&
    plan.names.length === names.length &&
    plan.names.every((name) => names.includes(name));
  const capture = model.captureDaily(state);
  const canInspect =
    controls.enabled &&
    !running &&
    !finished &&
    !!onViewDaily &&
    capture !== null &&
    model.canAdmitDaily(capture);
  return (
    <div className="managed-watchlist-daily-review" aria-busy={running}>
      <p>
        Review the chosen listings in order. Price uses the existing one-month
        history; Filings uses the last 90 UTC dates. Preview and Run are
        separate. Existing evidence keeps its original times and is not
        refreshed by this pass.
      </p>
      {!finished && (
        <DailySourceControls
          model={model}
          state={state}
          controls={controls}
          running={running}
          names={names}
          setNames={setNames}
          plan={plan}
          matches={matches}
          previewHeading={previewHeading}
        />
      )}
      <DailyPlanOutcomes
        daily={daily}
        finished={finished}
        matches={matches}
        previewHeading={previewHeading}
      />
      {finished ? (
        <DailyFinishedReading
          rows={state.rows}
          finishedHeading={finishedHeading}
        />
      ) : (
        <DailyCompanyEvidence
          model={model}
          state={state}
          controls={controls}
          running={running}
          companyHeading={companyHeading}
          canInspect={canInspect}
          onViewDaily={onViewDaily}
        />
      )}
      {dailyChecks}
      <p>
        Research and Back retain this review without requesting these sources
        again. Watchlist Save and Follow-ups Save remain separate.
      </p>
      {finished ? (
        <button
          id="watchlist-daily-reset"
          type="button"
          disabled={!controls.enabled}
          onClick={onReset}
        >
          New daily review
        </button>
      ) : (
        <button
          id="watchlist-daily-finish"
          type="button"
          disabled={!controls.enabled || running}
          onClick={(event) =>
            controls.transition(event.currentTarget, finishedHeading, () =>
              model.finishDaily(state),
            )
          }
        >
          Finish daily review
        </button>
      )}
    </div>
  );
}
