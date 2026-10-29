import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";
import type { ManagedResearchFollowups } from "./managed-research-followups";
import {
  prepareFilingsAssessment,
  type FilingsAssessmentPort,
  type FilingsAssessmentPreview,
} from "./managed-filings-assessment";
import { ManagedFilingsSource } from "./ManagedFilingsSource";
import "./managed-filings-assessment.css";

export interface ManagedFilingsAssessmentActions {
  model: ManagedResearchFollowups;
  owner: object;
  isCurrent: () => boolean;
  getContext: (response: ManagedSecFilingsResponseDto) => {
    port: FilingsAssessmentPort | null;
    reason: string | null;
  };
}
interface Props {
  response: ManagedSecFilingsResponseDto;
  actions: ManagedFilingsAssessmentActions;
}
interface State {
  open: boolean;
  accession: string;
  preview: FilingsAssessmentPreview | null;
  message: string | null;
}
interface Lifetime {
  token: object;
  preview: FilingsAssessmentPreview | null;
  busy: boolean;
}
interface Render extends Props {
  state: State;
  token: object;
}
const EMPTY: State = {
  open: false,
  accession: "",
  preview: null,
  message: null,
};
function retire(lifetime: Lifetime) {
  lifetime.token = {};
  const preview = lifetime.preview;
  lifetime.preview = null;
  preview?.cancel();
}
function useAssessment(props: Props) {
  const { model } = props.actions;
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const [state, setState] = useState<State>(EMPTY);
  const lifetime = useRef<Lifetime>({
    token: {},
    preview: null,
    busy: false,
  }).current;
  const committed = useRef<Render | null>(null);
  const render: Render = { ...props, state, token: lifetime.token };
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  useLayoutEffect(() => {
    render.token = lifetime.token;
    setState(EMPTY);
    return () => retire(lifetime);
  }, [props.response, props.actions.owner, model, lifetime]);
  const current = () =>
    committed.current === render &&
    lifetime.token === render.token &&
    render.actions.isCurrent();
  const currentHost = () =>
    committed.current?.response === render.response &&
    committed.current.actions.owner === render.actions.owner &&
    committed.current.actions.model === model &&
    committed.current.actions.isCurrent();
  const controls = { render, lifetime, current, currentHost, setState };
  const preview = state.preview?.isCurrent() ? state.preview : null;
  const stale = state.preview !== null && preview === null;
  useLayoutEffect(() => {
    if (stale) {
      retire(lifetime);
      render.token = lifetime.token;
    }
  }, [stale, lifetime]);
  return { state, preview, stale, controls };
}
type Controls = ReturnType<typeof useAssessment>["controls"];
function change(controls: Controls, patch: Partial<State>) {
  if (!controls.current()) return;
  retire(controls.lifetime);
  controls.setState({
    ...controls.render.state,
    preview: null,
    message: null,
    ...patch,
  });
}
function prepare(controls: Controls) {
  if (
    !controls.current() ||
    controls.lifetime.busy ||
    !controls.render.state.open
  )
    return;
  const { render, lifetime } = controls;
  const filing = render.response.issuer.filings.find(
    (row) => row.accessionNumber === render.state.accession,
  );
  if (!filing) return;
  lifetime.busy = true;
  retire(lifetime);
  const token = lifetime.token;
  render.token = token;
  const formCurrent = () => controls.currentHost() && lifetime.token === token;
  try {
    const context = render.actions.getContext(render.response);
    const result = context.port
      ? prepareFilingsAssessment(context.port, filing, formCurrent)
      : { preview: null, reason: context.reason };
    if (!formCurrent()) {
      result.preview?.cancel();
      return;
    }
    lifetime.preview = result.preview;
    controls.setState({
      ...render.state,
      preview: result.preview,
      message: result.reason,
    });
  } finally {
    lifetime.busy = false;
  }
}
function apply(controls: Controls, preview: FilingsAssessmentPreview) {
  if (
    !controls.current() ||
    controls.lifetime.busy ||
    controls.lifetime.preview !== preview
  )
    return;
  controls.lifetime.busy = true;
  try {
    const applied = preview.apply();
    if (controls.lifetime.preview !== preview) return;
    retire(controls.lifetime);
    if (!controls.currentHost()) return;
    controls.setState({
      ...controls.render.state,
      preview: null,
      message: applied
        ? "Citation applied to this assessment draft. Review, complete and Save follow-ups separately."
        : "This preview is no longer current. Prepare the cited assessment again.",
    });
  } finally {
    controls.lifetime.busy = false;
  }
}
function assessmentIdentity(value: FilingsAssessmentPreview) {
  return (
    <dl>
      {[
        ["Check", value.entry.id],
        ["Question", value.entry.check],
        ["State", value.entry.status],
        ["Completed on", value.entry.completedOn ?? "Not completed"],
        ["Due date (UTC)", value.entry.dueOn],
        ["Company", value.listing.issuerName],
        ["Issuer", value.listing.issuerId],
        ["Country", value.listing.country],
        ["Instrument type", value.listing.instrumentType],
        ["Symbol", value.listing.symbol],
        ["Listing", value.listing.listingId],
        [
          "Security",
          `${value.listing.securityName} · ${value.listing.securityId}`,
        ],
        [
          "Share class",
          `${value.listing.shareClassName} · ${value.listing.shareClassId}`,
        ],
        ["Exchange", value.listing.exchangeMic],
        ["Catalog", value.catalogSnapshotSha256],
      ].map(([label, text]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
function AssessmentPreview({
  value,
  onApply,
}: {
  value: FilingsAssessmentPreview;
  onApply: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (result.current) {
      result.current.style.height = "auto";
      result.current.style.height = `${result.current.scrollHeight}px`;
    }
    heading.current?.focus();
  }, [value]);
  return (
    <section
      className="filings-assessment-preview"
      aria-label="Cited assessment preview"
    >
      <h4 id="filings-assessment-preview-heading" ref={heading} tabIndex={-1}>
        Review the complete cited assessment
      </h4>
      <p>
        Your assessment is authored text. The citation records filing metadata;
        filing contents were not fetched.
      </p>
      <label htmlFor="filings-assessment-result">
        Complete assessment and citation
      </label>
      <textarea
        id="filings-assessment-result"
        ref={result}
        readOnly
        rows={8}
        value={value.result}
      />
      <p>{Array.from(value.result).length} / 2,000 Unicode characters</p>
      {assessmentIdentity(value)}
      <h5>Your authored assessment</h5>
      <p className="filings-assessment-authored">{value.entry.result}</p>
      <h5>Source citation</h5>
      <p className="filings-assessment-citation">{value.citation}</p>
      <a href={value.filing.sourceUrl} target="_blank" rel="noreferrer">
        Form {value.filing.form} · {value.filing.accessionNumber}
      </a>
      {value.showingPrevious && (
        <p>
          This is a retained previous response. Its original source dates remain
          unchanged.
        </p>
      )}
      <ManagedFilingsSource response={value.response} />
      <button id="filings-assessment-apply" type="button" onClick={onApply}>
        Apply citation to assessment
      </button>
    </section>
  );
}
function filingSelection(props: Props, state: State, controls: Controls) {
  const context = props.actions.getContext(props.response);
  return (
    <>
      <label htmlFor="filings-assessment-filing">Filing reference</label>
      <select
        id="filings-assessment-filing"
        value={state.accession}
        onChange={(event) =>
          change(controls, { accession: event.currentTarget.value })
        }
      >
        <option value="">Choose a loaded filing</option>
        {props.response.issuer.filings.map((filing) => (
          <option key={filing.accessionNumber} value={filing.accessionNumber}>
            Form {filing.form} · {filing.accessionNumber} · Filed{" "}
            {filing.filingDate} · Report {filing.reportDate ?? "Not reported"}
          </option>
        ))}
      </select>
      <button
        id="filings-assessment-preview"
        type="button"
        disabled={!state.accession || !context.port?.isCurrent()}
        onClick={() => prepare(controls)}
      >
        Preview complete assessment
      </button>
    </>
  );
}
export function ManagedFilingsAssessment(props: Props) {
  const { state, preview, stale, controls } = useAssessment(props);
  const context = props.actions.getContext(props.response);
  return (
    <details
      id="filings-assessment"
      className="filings-assessment"
      open={state.open}
    >
      <summary
        id="filings-assessment-toggle"
        onClick={(event) => {
          event.preventDefault();
          change(controls, { open: !state.open, accession: "" });
        }}
      >
        Cite a filing in this assessment
      </summary>
      {state.open && (
        <>
          <p>
            Write your assessment in Record assessment. Select a filing from
            this loaded response, then review the whole cited result. This
            changes only the existing check's assessment draft.
          </p>
          {filingSelection(props, state, controls)}
          {preview && (
            <AssessmentPreview
              value={preview}
              onApply={() => apply(controls, preview)}
            />
          )}
          <button
            id="filings-assessment-cancel"
            type="button"
            className="trial-secondary"
            onClick={() => change(controls, {})}
          >
            Cancel preview
          </button>
          <p id="filings-assessment-status" role="status" aria-live="polite">
            {stale
              ? "This preview no longer matches the current filing, visit or draft. Prepare it again."
              : (state.message ?? context.reason)}
          </p>
          <p>
            Apply does not complete or save the check. Use Review follow-ups or
            Back, then complete and Save follow-ups separately.
          </p>
        </>
      )}
    </details>
  );
}
