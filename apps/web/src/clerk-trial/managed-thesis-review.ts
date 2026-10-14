import { normalizeWatchlistNote } from "@research-cockpit/contracts";

export const thesisReviewPurposes = {
  idea: "Explore an idea",
  holding_review: "Review a holding",
} as const;

export const thesisReviewFields = [
  { key: "horizon", label: "Time horizon", required: false },
  { key: "thesis", label: "My thesis", required: true },
  { key: "support", label: "Supporting evidence", required: false },
  { key: "counter", label: "Opposing evidence", required: false },
  { key: "confirm", label: "Confirmation condition", required: false },
  { key: "invalidate", label: "Invalidation condition", required: true },
  { key: "next", label: "Next check", required: true },
] as const;

export type ThesisReview = Record<
  (typeof thesisReviewFields)[number]["key"],
  string
> & { purpose: "" | keyof typeof thesisReviewPurposes };
export const emptyThesisReview: ThesisReview = {
  purpose: "",
  horizon: "",
  thesis: "",
  support: "",
  counter: "",
  confirm: "",
  invalidate: "",
  next: "",
};

/** Formats authored fields without reading or changing a note. */
export function formatThesisReview(review: ThesisReview) {
  const parts: string[] = [];
  if (review.purpose !== "") {
    if (!Object.hasOwn(thesisReviewPurposes, review.purpose))
      return {
        excerpt: null,
        reason: "Choose a listed research purpose or leave it blank.",
      };
    parts.push(`Research purpose: ${thesisReviewPurposes[review.purpose]}`);
  }
  for (const field of thesisReviewFields) {
    const value = normalizeWatchlistNote(review[field.key]);
    if (value === null)
      return {
        excerpt: null,
        reason: `${field.label}: use at most 2,000 characters on one line, without unsupported characters.`,
      };
    if (field.required && !value)
      return {
        excerpt: null,
        reason: "Complete My thesis, Invalidation condition and Next check.",
      };
    if (value) parts.push(`${field.label}: ${value}`);
  }
  return {
    excerpt: `Thesis review (my assessment). ${parts.join(" | ")}`,
    reason: null,
  };
}

/** Appends one authored snapshot, never parsed as financial evidence. */
export function proposeThesisReview(note: string, review: ThesisReview) {
  const formatted = formatThesisReview(review);
  if (formatted.excerpt === null) return { ...formatted, note: null };
  const excerpt = formatted.excerpt;
  if (normalizeWatchlistNote(note) === null)
    return {
      excerpt,
      note: null,
      reason: "Correct the current note before adding this review.",
    };
  if (note.endsWith(excerpt))
    return {
      excerpt,
      note: null,
      reason:
        "This review is already at the end of the note draft. Review and save all changes in My Watchlist.",
    };
  const candidate = note ? `${note} ${excerpt}` : excerpt;
  return normalizeWatchlistNote(candidate) === null
    ? {
        excerpt,
        note: null,
        reason:
          "The complete note would exceed 2,000 characters. Shorten the note or review before adding it.",
      }
    : { excerpt, note: candidate, reason: null };
}
