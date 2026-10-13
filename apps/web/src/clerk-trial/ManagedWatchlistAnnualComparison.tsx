import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import { ListingIdentity } from "./ManagedListingIdentity";
import { SecAnnualSourceDetails } from "../features/research/SecAnnualEvidenceResult";
import {
  SecAnnualCashSourceBody,
  SecAnnualCashValueContent,
} from "../features/research/SecAnnualCashGeneration";
import type {
  ManagedWatchlistAnnualComparison as ComparisonModel,
  ManagedWatchlistAnnualComparisonState as ComparisonState,
} from "./managed-watchlist-annual-comparison";
import { projectAnnualComparison } from "./managed-annual-comparison-display";
import { managedAnnualBasisLabel } from "../features/research/managed-annual-basis-label";
import {
  ManagedWatchlistAnnualComparisonNoteAction,
  type ManagedWatchlistAnnualComparisonNoteActions,
} from "./ManagedWatchlistAnnualComparisonNoteAction";
import "./managed-annual-comparison.css";

type Side = "left" | "right";
type Projection = ReturnType<typeof projectAnnualComparison>;
type BasisChoice = { handle: symbol | null; basis: string | undefined };
const sides = ["left", "right"] as const;
const sideLabel = (side: Side) => (side === "left" ? "First" : "Second");

export function ManagedWatchlistAnnualComparison({
  model,
  active,
  editable,
  noteActions,
}: {
  model: ComparisonModel;
  active: boolean;
  editable: boolean;
  noteActions: ManagedWatchlistAnnualComparisonNoteActions;
}) {
  const id = useId();
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const [basis, setBasis] = useState<Record<Side, BasisChoice>>({
    left: { handle: null, basis: undefined },
    right: { handle: null, basis: undefined },
  });
  const currentBasis = {
    left: basisForSelection(basis.left, state.left.selected?.handle ?? null),
    right: basisForSelection(basis.right, state.right.selected?.handle ?? null),
  };
  if (currentBasis.left !== basis.left || currentBasis.right !== basis.right)
    setBasis(currentBasis);
  const loadButtons = useRef<Record<Side, HTMLButtonElement | null>>({
    left: null,
    right: null,
  });
  const focusRequest = useRef<{
    origin: HTMLButtonElement;
    target: HTMLButtonElement | null;
  } | null>(null);
  useLayoutEffect(() => {
    if (state.pending || !focusRequest.current) return;
    const { origin, target } = focusRequest.current;
    focusRequest.current = null;
    if (
      state.active &&
      target?.isConnected &&
      !target.disabled &&
      !target.closest("[hidden], [inert]") &&
      target.getClientRects().length > 0 &&
      (document.activeElement === origin ||
        document.activeElement === document.body)
    )
      target.focus();
  }, [state.pending, state.active]);

  const project = (side: Side) =>
    projectAnnualComparison(
      state[side].report.response,
      currentBasis[side].basis,
    );
  const projections = { left: project("left"), right: project("right") };
  return (
    <section
      className="managed-annual-comparison"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Compare annual results</h3>
      <p className="managed-annual-comparison-help">
        Choose two different companies from your full watchlist draft. Load each
        report explicitly. Fiscal periods and revenue bases may differ.
      </p>
      <div className="managed-annual-comparison-choices">
        {sides.map((side) => (
          <AnnualCompanyControls
            key={side}
            side={side}
            model={model}
            state={state}
            projection={projections[side]}
            setBasis={setBasis}
            loadButtons={loadButtons}
            focusRequest={focusRequest}
            id={id}
          />
        ))}
      </div>
      <p role="status" className="managed-annual-comparison-help">
        {state.message}
      </p>
      <p id={`${id}-scroll`} className="managed-annual-comparison-help">
        Exact, unscaled USD. Each company keeps its own reported period and
        basis. Scroll the results horizontally when needed, or focus them and
        use the arrow keys.
      </p>
      <div
        className="managed-annual-comparison-scroll"
        role="region"
        aria-label="Watchlist annual comparison results"
        aria-describedby={`${id}-scroll`}
        tabIndex={0}
      >
        <table className="managed-annual-comparison-table">
          <caption>Reported annual results · separate company filings</caption>
          <thead>
            <tr>
              <th scope="col">Reported measure</th>
              {sides.map((side) => (
                <th scope="col" key={side}>
                  {state[side].selected ? (
                    <ListingIdentity member={state[side].selected.listing} />
                  ) : (
                    `${sideLabel(side)} company not selected`
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label="Revenue / net income period"
              projections={projections}
            >
              {(p) =>
                p.current ? (
                  <Period start={p.current.startDate} end={p.current.endDate} />
                ) : (
                  unavailable(p)
                )
              }
            </ComparisonRow>
            <ComparisonRow label="Revenue basis" projections={projections}>
              {(p) =>
                p.selectedBasis === null
                  ? "Not loaded"
                  : managedAnnualBasisLabel(p.selectedBasis)
              }
            </ComparisonRow>
            <ComparisonRow label="Revenue · USD" projections={projections}>
              {(p) => p.current?.revenueUSD ?? unavailable(p)}
            </ComparisonRow>
            <ComparisonRow label="Net income · USD" projections={projections}>
              {(p) => p.current?.netIncomeUSD ?? unavailable(p)}
            </ComparisonRow>
            <ComparisonRow label="Net margin" projections={projections}>
              {(p) =>
                p.current
                  ? p.current.netMarginPercent === null
                    ? "Unavailable: revenue must be positive"
                    : `${p.current.netMarginPercent}%`
                  : unavailable(p)
              }
            </ComparisonRow>
            <ComparisonRow
              label="Reported revenue change"
              projections={projections}
            >
              {(p) =>
                p.revenueChange ? (
                  <>
                    {p.revenueChange.percentText}
                    <small>{p.revenueChange.differenceUSD} USD change</small>
                    <small>
                      Prior: {p.revenueChange.priorStartDate} to{" "}
                      {p.revenueChange.priorEndDate}
                    </small>
                    <small>
                      Current: {p.revenueChange.currentStartDate} to{" "}
                      {p.revenueChange.currentEndDate}
                    </small>
                  </>
                ) : (
                  (p.revenueChangeReason ?? "Not loaded")
                )
              }
            </ComparisonRow>
            <CashComparisonRows state={state} />
          </tbody>
        </table>
      </div>
      <p className="managed-annual-comparison-help">
        The app calculation subtracts purchases of property, plant and equipment
        from operating cash flow for the same filing and period. It does not
        adjust for leases, acquisitions or other investing cash flows.
      </p>
      <ManagedWatchlistAnnualComparisonNoteAction
        state={state}
        bases={{
          left: projections.left.selectedBasis,
          right: projections.right.selectedBasis,
        }}
        active={active}
        editable={editable}
        actions={noteActions}
      />
      <div className="managed-annual-comparison-sources">
        {sides.map((side) => {
          const p = projections[side];
          const response = state[side].report.response;
          return (
            <section
              className="managed-annual-comparison-source"
              key={side}
              aria-label={`${sideLabel(side)} company annual sources`}
            >
              {p.currentUse && (
                <p
                  className={
                    p.currentUse.eligible
                      ? "managed-annual-comparison-help"
                      : "discovery-warning"
                  }
                >
                  {p.currentUse.message}
                </p>
              )}
              {response && p.currentReason && (
                <p className="discovery-warning">
                  Revenue and net income unavailable. {p.currentReason}
                </p>
              )}
              {p.source && (
                <p>
                  SEC evidence · loaded{" "}
                  <time dateTime={p.source.generation.completedAt}>
                    {p.source.generation.completedAt}
                  </time>
                </p>
              )}
              {p.source?.target.status === "target" && (
                <p>
                  {p.source.target.form} · filed {p.source.target.filedDate} ·
                  report ending {p.source.target.reportDate}
                </p>
              )}
              {p.source?.filingUrl && (
                <a
                  href={p.source.filingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open {sideLabel(side).toLowerCase()} company filing index
                </a>
              )}
              {response && (
                <details>
                  <summary>
                    {sideLabel(side)} company source and validation details
                  </summary>
                  {p.selectedBasis !== null && (
                    <p data-annual-comparison-source-basis={side}>
                      Selected SEC revenue concept:{" "}
                      <code>{p.selectedBasis}</code>
                    </p>
                  )}
                  <SecAnnualSourceDetails response={response} />
                  <div
                    className="managed-annual-comparison-cash-source"
                    data-annual-comparison-cash-source={side}
                  >
                    <h4>Cash sources and calculation inputs</h4>
                    <SecAnnualCashSourceBody response={response} />
                  </div>
                </details>
              )}
            </section>
          );
        })}
      </div>
      <p className="managed-annual-comparison-help">
        These are reported amounts and changes, without adjustments for fiscal
        calendars, acquisitions or accounting differences. They do not rank the
        companies or establish comparable valuation. Loading and choosing a
        basis leave your notes and saved watchlist unchanged.
      </p>
    </section>
  );
}

function AnnualCompanyControls({
  side,
  model,
  state,
  projection,
  setBasis,
  loadButtons,
  focusRequest,
  id,
}: {
  side: Side;
  model: ComparisonModel;
  state: ComparisonState;
  projection: Projection;
  setBasis: Dispatch<SetStateAction<Record<Side, BasisChoice>>>;
  loadButtons: RefObject<Record<Side, HTMLButtonElement | null>>;
  focusRequest: RefObject<{
    origin: HTMLButtonElement;
    target: HTMLButtonElement | null;
  } | null>;
  id: string;
}) {
  const column = state[side];
  const selected = column.selected;
  const pending = state.pending;
  const other = state[side === "left" ? "right" : "left"].selected;
  return (
    <div className="managed-annual-comparison-choice" key={side}>
      <label htmlFor={`${id}-${side}-company`}>
        {sideLabel(side)} annual company
        <select
          id={`${id}-${side}-company`}
          value={selected?.listing.listingId ?? ""}
          disabled={!state.active || !state.canRead}
          onChange={(event) => {
            const member = state.memberships.find(
              (candidate) =>
                candidate.listing.listingId === event.currentTarget.value,
            );
            model.select(side, state, member ?? null);
          }}
        >
          <option value="">Choose a company</option>
          {state.memberships.map((member) => (
            <option
              key={member.listing.listingId}
              value={member.listing.listingId}
              disabled={member.listing.issuerId === other?.listing.issuerId}
            >
              {member.listing.symbol} · {member.listing.issuerName} ·{" "}
              {member.listing.shareClassName} · {member.listing.exchangeMic}
            </option>
          ))}
        </select>
      </label>
      <div className="trial-actions">
        <button
          type="button"
          ref={(button) => {
            loadButtons.current[side] = button;
          }}
          disabled={
            !state.active ||
            !state.canRead ||
            !selected ||
            pending !== null ||
            state.catalogChanged
          }
          onClick={() => {
            if (selected) void model.load(side, selected);
          }}
        >
          {column.report.running
            ? `Loading ${sideLabel(side).toLowerCase()} annual report…`
            : `${column.report.response ? "Refresh" : "Load"} ${sideLabel(side).toLowerCase()} annual report`}
        </button>
        {pending?.side === side && (
          <button
            type="button"
            className="trial-secondary"
            onClick={(event) => {
              if (model.getSnapshot().pending !== pending) return;
              if (document.activeElement === event.currentTarget)
                focusRequest.current = {
                  origin: event.currentTarget,
                  target: loadButtons.current[side],
                };
              pending.cancel();
            }}
          >
            Cancel {sideLabel(side).toLowerCase()} annual report
          </button>
        )}
      </div>
      <p role={column.report.error ? "alert" : "status"} aria-live="polite">
        {column.report.message}
      </p>
      {column.report.showingPrevious && column.report.response && (
        <p className="discovery-warning">
          Previous report, loaded{" "}
          <time
            dateTime={column.report.response.evidence.generation.completedAt}
          >
            {column.report.response.evidence.generation.completedAt}
          </time>
          . This attempt has not confirmed newer evidence.
        </p>
      )}
      {column.report.response && (
        <div>
          <label htmlFor={`${id}-${side}-basis`}>
            {sideLabel(side)} company revenue basis
            <select
              id={`${id}-${side}-basis`}
              aria-describedby={`${id}-${side}-selected-basis`}
              disabled={!state.active}
              value={projection.selectedBasis ?? ""}
              onChange={(event) => {
                const current = model.getSnapshot();
                if (!current.active || current[side].selected !== selected)
                  return;
                const value = event.currentTarget.value;
                setBasis((previous) => ({
                  ...previous,
                  [side]: {
                    handle: selected?.handle ?? null,
                    basis: value,
                  },
                }));
              }}
            >
              {!projection.selectedBasis && (
                <option value="">No revenue basis</option>
              )}
              {projection.selectedBasis &&
                !projection.basisChoices.some(
                  (choice) => choice.concept === projection.selectedBasis,
                ) && (
                  <option value={projection.selectedBasis}>
                    {managedAnnualBasisLabel(projection.selectedBasis)} ·
                    unavailable in this report
                  </option>
                )}
              {projection.basisChoices.map((choice) => (
                <option key={choice.concept} value={choice.concept}>
                  {managedAnnualBasisLabel(choice.concept)}
                  {choice.status !== "eligible" &&
                    " · unavailable in this report"}
                </option>
              ))}
            </select>
          </label>
          <p
            id={`${id}-${side}-selected-basis`}
            data-annual-comparison-selected-basis={side}
          >
            Selected basis:{" "}
            {projection.selectedBasis === null
              ? "No revenue basis"
              : managedAnnualBasisLabel(projection.selectedBasis)}
          </p>
        </div>
      )}
    </div>
  );
}

function basisForSelection(
  choice: BasisChoice,
  handle: symbol | null,
): BasisChoice {
  return choice.handle === handle ? choice : { handle, basis: undefined };
}

function unavailable(p: Projection) {
  return p.source ? "Unavailable" : "Not loaded";
}
function Period({ start, end }: { start: string | null; end: string }) {
  return (
    <>
      <time dateTime={start ?? undefined}>{start ?? "Start date unknown"}</time>
      to<time dateTime={end}>{end}</time>
    </>
  );
}
function ComparisonRow({
  label,
  projections,
  children,
}: {
  label: string;
  projections: Record<Side, Projection>;
  children: (projection: Projection) => ReactNode;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      {sides.map((side) => (
        <td key={side}>{children(projections[side])}</td>
      ))}
    </tr>
  );
}

const cashRows = [
  ["operatingCashFlow", "Operating cash flow", "Reported"],
  ["ppePurchases", "PP&E purchases", "Reported"],
  [
    "operatingCashFlowLessPpePurchases",
    "Operating cash flow less PP&E purchases",
    "App calculation",
  ],
] as const;

function CashComparisonRows({ state }: { state: ComparisonState }) {
  return cashRows.map(([metric, label, kind]) => (
    <tr key={metric} data-annual-comparison-cash={metric}>
      <th scope="row">
        {label}
        <small>{kind} · USD</small>
      </th>
      {sides.map((side) => {
        const response = state[side].report.response;
        return (
          <td key={side}>
            {response ? (
              <SecAnnualCashValueContent
                value={response.evidence.cashGeneration.resolution[metric]}
              />
            ) : (
              "Not loaded"
            )}
          </td>
        );
      })}
    </tr>
  ));
}
