import { useLayoutEffect, useRef, type RefObject } from "react";
import type { ManagedValuationWorkbench } from "./managed-valuation-workbench";
import { isResearchFollowupDueDate } from "./managed-research-followups-date";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import {
  useValuationFollowupReview,
  type ManagedValuationFollowupActions,
} from "./use-valuation-followup-review";
import "./managed-valuation-followup.css";

export type { ManagedValuationFollowupActions } from "./use-valuation-followup-review";
interface Props {
  valuation: ManagedValuationWorkbench;
  actions: ManagedValuationFollowupActions;
  owner: object;
  navigationPending: boolean;
}
type Controls = ReturnType<typeof useValuationFollowupReview>;
function Choices({ controls }: { controls: Controls }) {
  return (
    <div className="managed-valuation-followup-fields">
      <div>
        <label htmlFor="valuation-followup-model">Model (required)</label>
        <select
          id="valuation-followup-model"
          value={controls.form.model}
          disabled={controls.disabled}
          aria-describedby="valuation-followup-estimate valuation-followup-status"
          onChange={(event) =>
            controls.edit("model", event.currentTarget.value)
          }
        >
          <option value="">Choose a model</option>
          <option value="dcf">Cash flow DCF</option>
          <option value="exit">Exit EBITDA multiple</option>
        </select>
      </div>
      <div>
        <label htmlFor="valuation-followup-scenario">Scenario (required)</label>
        <select
          id="valuation-followup-scenario"
          value={controls.form.scenario}
          disabled={controls.disabled}
          aria-describedby="valuation-followup-estimate valuation-followup-status"
          onChange={(event) =>
            controls.edit("scenario", event.currentTarget.value)
          }
        >
          <option value="">Choose a scenario</option>
          <option value="conservative">Conservative</option>
          <option value="base">Base</option>
          <option value="expansion">Expansion</option>
        </select>
      </div>
    </div>
  );
}
function Fields({ controls }: { controls: Controls }) {
  return (
    <>
      <div className="managed-valuation-followup-fields">
        <div>
          <label htmlFor="valuation-followup-question">
            Research question (required, one line)
          </label>
          <textarea
            id="valuation-followup-question"
            rows={3}
            value={controls.form.question}
            disabled={controls.disabled}
            aria-describedby="valuation-followup-help valuation-followup-status"
            onChange={(event) =>
              controls.edit("question", event.currentTarget.value)
            }
          />
        </div>
        <div>
          <label htmlFor="valuation-followup-due">
            Due date (required, UTC, YYYY-MM-DD)
          </label>
          <input
            id="valuation-followup-due"
            type="text"
            placeholder="YYYY-MM-DD"
            value={controls.form.dueOn}
            disabled={controls.disabled}
            aria-invalid={
              controls.form.dueOn !== "" &&
              !isResearchFollowupDueDate(controls.form.dueOn)
            }
            aria-describedby="valuation-followup-help valuation-followup-status"
            onChange={(event) =>
              controls.edit("dueOn", event.currentTarget.value)
            }
          />
        </div>
      </div>
      <p id="valuation-followup-help">
        Enter a question on one line. The complete saved check, including the
        estimate summary, must fit 500 Unicode characters. Invalid or oversized
        text stays visible for correction; nothing is clipped.
      </p>
    </>
  );
}
function Preview({
  controls,
  heading,
}: {
  controls: Controls;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  if (!controls.preview) return null;
  const preview = controls.preview;
  return (
    <section
      className="managed-valuation-followup-preview"
      aria-label="Valuation follow-up preview"
    >
      <h4 ref={heading} tabIndex={-1}>
        Review the complete dated check
      </h4>
      <label htmlFor="valuation-followup-check">
        Complete saved check preview
      </label>
      <textarea
        id="valuation-followup-check"
        rows={5}
        readOnly
        value={preview.check}
      />
      <p>Due date (UTC): {preview.dueOn}</p>
      <p>
        <ListingIdentity member={preview.listing} />
      </p>
      <details>
        <summary>Complete listing identity</summary>
        <dl>
          <div>
            <dt>Catalog snapshot</dt>
            <dd id="valuation-followup-catalog">
              {preview.catalogSnapshotSha256}
            </dd>
          </div>
          {Object.entries(identityLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{preview.listing[key as keyof typeof identityLabels]}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p>
        This is an authored estimate summary. Inputs and source evidence are not
        included. Create changes only the Follow-ups draft. Save follow-ups
        remains separate.
      </p>
      <button
        id="valuation-followup-create"
        type="button"
        className="trial-secondary"
        disabled={controls.disabled}
        onClick={controls.create}
      >
        Create follow-up draft
      </button>
    </section>
  );
}
function Load({ controls }: { controls: Controls }) {
  if (controls.saved.draft !== null) return null;
  return (
    <>
      <button
        id="valuation-followup-load"
        type="button"
        className="trial-secondary"
        disabled={!controls.canLoad}
        onClick={controls.load}
      >
        {controls.saved.phase === "loading"
          ? "Loading follow-ups…"
          : "Load follow-ups for this question"}
      </button>
      {controls.saved.message && <p role="status">{controls.saved.message}</p>}
    </>
  );
}
export function ManagedValuationFollowup(props: Props) {
  const controls = useValuationFollowupReview(props);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const previewButton = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const source = controls.lifetime.focusFrom;
    controls.lifetime.focusFrom = null;
    if (
      !controls.preview ||
      !source?.isConnected ||
      source.ownerDocument.activeElement !== source
    )
      return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [controls.preview, controls.lifetime]);
  return (
    <details
      className="managed-valuation-followup"
      onToggle={(event) => {
        if (!event.currentTarget.open) controls.cancel();
      }}
    >
      <summary>Keep a dated valuation check</summary>
      <p>
        Choose one calculated authored scenario and add your own dated question.
        Opening this section makes no request or calculation.
      </p>
      <Choices controls={controls} />
      <p id="valuation-followup-estimate">
        {controls.summary
          ? controls.summary.text
          : "No available authored estimate selected. Choose a model and scenario after calculating explicitly."}
      </p>
      <p>Summary only; inputs and source evidence are not included.</p>
      <Fields controls={controls} />
      <Load controls={controls} />
      <button
        id="valuation-followup-preview"
        ref={previewButton}
        type="button"
        className="trial-secondary"
        disabled={!controls.canPrepare}
        onClick={controls.prepare}
      >
        Preview dated check
      </button>
      <Preview controls={controls} heading={heading} />
      <button
        id="valuation-followup-cancel"
        type="button"
        className="trial-secondary"
        disabled={controls.disabled}
        onClick={(event) => {
          const source = event.currentTarget;
          const restore = source.ownerDocument.activeElement === source;
          if (controls.cancel() && restore)
            previewButton.current?.focus({ preventScroll: true });
        }}
      >
        Cancel preview
      </button>
      <p id="valuation-followup-status" role="status" aria-live="polite">
        {controls.message}
      </p>
    </details>
  );
}
