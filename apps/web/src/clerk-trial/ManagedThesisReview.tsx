import { useState } from "react";
import {
  emptyThesisReview,
  proposeThesisReview,
  thesisReviewFields,
  type ThesisReview,
} from "./managed-thesis-review";

export interface ThesisReviewFormProps {
  id: string;
  symbol: string;
  note: string;
  disabled: boolean;
  review: ThesisReview;
  onReview: (review: ThesisReview) => void;
  onChange: (note: string, expectedNote?: string) => void;
}

export function ThesisReviewForm({
  id,
  symbol,
  note,
  disabled,
  review,
  onReview,
  onChange,
}: ThesisReviewFormProps) {
  const proposal = proposeThesisReview(note, review);
  return (
    <details className="managed-thesis-review">
      <summary>Write a thesis review for {symbol}</summary>
      <p id={`${id}-review-help`}>
        Write your assessment. Include source links and dates with evidence.
        Required: thesis, invalidation condition and next check. Unadded fields
        reset when you change listing or leave this editor.
      </p>
      <div className="managed-thesis-review-fields">
        {thesisReviewFields.map((field) => (
          <div key={field.key}>
            <label htmlFor={`${id}-review-${field.key}`}>
              {field.label}
              {field.required ? " (required)" : " (optional)"}
            </label>
            <input
              id={`${id}-review-${field.key}`}
              type="text"
              maxLength={4000}
              value={review[field.key]}
              disabled={disabled}
              aria-required={field.required || undefined}
              aria-describedby={`${id}-review-help ${id}-review-status`}
              onChange={(event) =>
                onReview({ ...review, [field.key]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
      {proposal.excerpt && (
        <div>
          <h4>Review preview</h4>
          <p className="trial-saved-note">{proposal.excerpt}</p>
        </div>
      )}
      <button
        type="button"
        className="trial-secondary"
        disabled={disabled || proposal.note === null}
        onClick={() => {
          if (!disabled && proposal.note !== null)
            onChange(proposal.note, note);
        }}
      >
        Add review to note draft
      </button>
      <p id={`${id}-review-status`} role="status" aria-live="polite">
        {disabled
          ? "Note editing is paused. Your review remains visible."
          : (proposal.reason ??
            "Adds to the current note. Save all changes in My Watchlist.")}
      </p>
    </details>
  );
}

export function ManagedThesisReview(
  props: Omit<ThesisReviewFormProps, "review" | "onReview">,
) {
  const [review, setReview] = useState<ThesisReview>(emptyThesisReview);
  return <ThesisReviewForm {...props} review={review} onReview={setReview} />;
}
