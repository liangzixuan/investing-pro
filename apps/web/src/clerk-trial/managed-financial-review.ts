import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import type { PersonalSecAnnualFinancialReviewKey } from "@research-cockpit/personal-financial-analytics";
import { proposeFinancialReviewNote } from "./managed-financial-review-note";

export interface PreparedFinancialReview {
  readonly note: string;
  readonly keys: readonly PersonalSecAnnualFinancialReviewKey[];
}

export interface FinancialReviewPreparation {
  readonly preview: PreparedFinancialReview | null;
  readonly reason: string | null;
}

/** One exact visit's inputs and lifetime, captured together by its workspace. */
export interface FinancialReviewCapture {
  readonly note: string;
  readonly response: PersonalSecAnnualCanonicalResponseDto;
  readonly keys: readonly PersonalSecAnnualFinancialReviewKey[];
  readonly showingPrevious: boolean;
  readonly isCurrent: () => boolean;
  readonly apply: (note: string) => void;
}

export interface ManagedFinancialReviewActions {
  prepare: (
    response: PersonalSecAnnualCanonicalResponseDto,
    keys: readonly PersonalSecAnnualFinancialReviewKey[],
  ) => FinancialReviewPreparation;
  isCurrent: (preview: PreparedFinancialReview) => boolean;
  append: (preview: PreparedFinancialReview) => {
    appended: boolean;
    message: string;
  };
}

/** Handles belong to one workspace. Consumed or changed captures cannot be reused. */
export class ManagedFinancialReview {
  private readonly captures = new WeakMap<
    PreparedFinancialReview,
    { isCurrent: () => boolean; apply: (note: string) => void }
  >();

  prepare(capture: FinancialReviewCapture): FinancialReviewPreparation {
    if (!capture.isCurrent())
      return {
        preview: null,
        reason:
          "Review the current Annual report and note before preparing this review.",
      };
    const proposal = proposeFinancialReviewNote(
      capture.note,
      capture.response,
      capture.keys,
      capture.showingPrevious,
    );
    if (proposal.note === null)
      return { preview: null, reason: proposal.reason };
    const preview = Object.freeze({
      note: proposal.note,
      keys: Object.freeze([...capture.keys]),
    });
    this.captures.set(preview, {
      isCurrent: capture.isCurrent,
      apply: capture.apply,
    });
    return { preview, reason: null };
  }

  isCurrent(preview: PreparedFinancialReview): boolean {
    const capture = this.captures.get(preview);
    if (!capture) return false;
    if (capture.isCurrent()) return true;
    this.captures.delete(preview);
    return false;
  }

  append(preview: PreparedFinancialReview) {
    if (!this.isCurrent(preview))
      return {
        appended: false,
        message:
          "The note, source or visit changed. Preview the financial review again.",
      };
    const capture = this.captures.get(preview)!;
    this.captures.delete(preview);
    capture.apply(preview.note);
    return {
      appended: true,
      message:
        "Financial review added to the note draft. Review and save all changes in My Watchlist.",
    };
  }
}
