import { normalizeResearchFollowupResult } from "@research-cockpit/contracts";
import "./managed-followup-assessment.css";

/** One raw authored result field shared by the full and contextual editors. */
export function ManagedFollowupAssessment({
  id,
  value,
  readOnly,
  onChange,
}: {
  id: string;
  value: string;
  readOnly: boolean;
  onChange: (raw: string) => void;
}) {
  const helpId = `${id}-help`;
  return (
    <div className="managed-followup-assessment">
      <label htmlFor={id}>
        Your assessment
        <textarea
          id={id}
          rows={4}
          readOnly={readOnly}
          value={value}
          aria-invalid={normalizeResearchFollowupResult(value) === null}
          aria-describedby={helpId}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </label>
      <p id={helpId} className="managed-followups-help">
        Optional. Up to 2,000 characters, one line. Your assessment is not a
        verified source fact.
      </p>
    </div>
  );
}
