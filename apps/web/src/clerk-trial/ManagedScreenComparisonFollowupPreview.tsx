import type { RefObject } from "react";
import type { ScreenComparisonFollowupControls } from "./use-screen-comparison-followup-review";
import { identityLabels, ListingIdentity } from "./ManagedListingIdentity";
import { ScreenComparisonReportSnapshot } from "./ScreenComparisonReportSnapshot";
import { useCompleteCheckSize } from "./ManagedCalendarFollowupFormSizing";

export function ManagedScreenComparisonFollowupPreview({
  controls: c,
  heading,
}: {
  controls: ScreenComparisonFollowupControls;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const preview = c.state.preview;
  const check = useCompleteCheckSize(preview?.check ?? null);
  if (!preview) return null;
  return (
    <section
      className="managed-screen-comparison-followup-preview"
      aria-label="Screen comparison follow-up preview"
    >
      <h4 ref={heading} tabIndex={-1}>
        Review the complete comparison check
      </h4>
      <label htmlFor="screen-comparison-followup-check">
        Complete saved check preview
      </label>
      <textarea
        id="screen-comparison-followup-check"
        ref={check}
        readOnly
        rows={6}
        value={preview.check}
      />
      <p>{Array.from(preview.check).length} / 500 Unicode characters.</p>
      <p>Due date (UTC): {preview.dueOn}</p>
      <p>
        <ListingIdentity member={preview.listing} />
      </p>
      <details>
        <summary>Complete destination listing identity</summary>
        <dl>
          <dt>Catalog snapshot</dt>
          <dd>{preview.catalogSnapshotSha256}</dd>
          {Object.entries(identityLabels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{preview.listing[key as keyof typeof identityLabels]}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p>
        Only this complete check, its selected listing and UTC due date enter
        Follow-ups. Complete criteria, statements and source packets are
        excluded from the saved check. Save follow-ups remains separate. The
        existing comparison HTML Save is also separate.
      </p>
      <button
        id="screen-comparison-followup-create"
        type="button"
        className="trial-secondary"
        disabled={c.disabled}
        onClick={c.create}
      >
        Create follow-up draft
      </button>
      <section
        id="screen-comparison-followup-context"
        aria-label="Complete captured comparison context"
      >
        <h4>Complete comparison reviewed for this check</h4>
        <ScreenComparisonReportSnapshot report={preview.comparison} />
      </section>
    </section>
  );
}
