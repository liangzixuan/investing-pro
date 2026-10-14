import { describe, expect, it } from "vitest";
import {
  emptyThesisReview,
  formatThesisReview,
  proposeThesisReview,
} from "./managed-thesis-review";

const review = {
  ...emptyThesisReview,
  thesis: "Margins can recover",
  support: "Invented report https://example.test/report dated 2026-10-01",
  counter: "Demand remains uncertain",
  confirm: "Two reported periods with higher margins",
  invalidate: "Debt rises while operating cash falls",
  next: "Read the next filed quarterly report",
};

describe("authored thesis review", () => {
  it.each([
    ["idea", "Explore an idea"],
    ["holding_review", "Review a holding"],
  ] as const)(
    "keeps explicit %s purpose and horizon in the authored snapshot",
    (purpose, label) => {
      const result = proposeThesisReview("Original", {
        ...review,
        purpose,
        horizon: "Through the next two filed reports",
      });
      expect(result.note).toContain(
        `Original Thesis review (my assessment). Research purpose: ${label} | Time horizon: Through the next two filed reports | My thesis: Margins can recover`,
      );
      expect(result.note).not.toContain("position size");
      expect(result.note).not.toContain("cost basis");
      expect(result.reason).toBeNull();
    },
  );
  it("does not invent a purpose or horizon and refuses an unknown purpose", () => {
    expect(formatThesisReview(review).excerpt).not.toContain(
      "Research purpose:",
    );
    expect(formatThesisReview(review).excerpt).not.toContain("Time horizon:");
    const invalid = { ...review, purpose: "toString" };
    expect(formatThesisReview(invalid as typeof review)).toEqual({
      excerpt: null,
      reason: "Choose a listed research purpose or leave it blank.",
    });
  });
  it("applies the existing field and complete-note limits to the horizon", () => {
    expect(
      formatThesisReview({ ...review, horizon: "x".repeat(2001) }).reason,
    ).toContain("Time horizon:");
    expect(
      proposeThesisReview("Original", { ...review, horizon: "next\nreport" })
        .note,
    ).toBeNull();
    const withContext = {
      ...review,
      purpose: "holding_review" as const,
      horizon: "Two reports",
    };
    const excerpt = proposeThesisReview("", withContext).excerpt!;
    const remaining = 2000 - Array.from(excerpt).length - 1;
    expect(
      proposeThesisReview("😀".repeat(remaining), withContext).note,
    ).not.toBeNull();
    expect(
      proposeThesisReview("😀".repeat(remaining + 1), withContext).note,
    ).toBeNull();
  });
  it("identifies an oversized field without blaming its line format", () => {
    const oversized = { ...review, support: "x".repeat(2001) };
    expect(formatThesisReview(oversized)).toEqual({
      excerpt: null,
      reason:
        "Supporting evidence: use at most 2,000 characters on one line, without unsupported characters.",
    });
    expect(proposeThesisReview("Original", oversized).note).toBeNull();
    expect(formatThesisReview(review).excerpt).toBe(
      proposeThesisReview("", review).note,
    );
  });
  it("keeps existing note bytes and distinguishes authored assessment from evidence", () => {
    const before = "  Cafe\u0301 original 😀  ";
    const result = proposeThesisReview(before, review);
    expect(result.note).toBe(
      `${before} Thesis review (my assessment). My thesis: Margins can recover | Supporting evidence: Invented report https://example.test/report dated 2026-10-01 | Opposing evidence: Demand remains uncertain | Confirmation condition: Two reported periods with higher margins | Invalidation condition: Debt rises while operating cash falls | Next check: Read the next filed quarterly report`,
    );
    expect(result.reason).toBeNull();
  });
  it("requires a thesis, invalidation and next check, while omitting absent evidence", () => {
    expect(proposeThesisReview("", emptyThesisReview).note).toBeNull();
    const minimal = { ...review, support: "", counter: "", confirm: "" };
    const result = proposeThesisReview("", minimal);
    expect(result.note).toContain("My thesis: Margins can recover");
    expect(result.note).not.toContain("evidence:");
    expect(result.note).not.toContain("Confirmation condition:");
    expect(
      proposeThesisReview("", { ...minimal, invalidate: " " }).note,
    ).toBeNull();
    expect(proposeThesisReview("", { ...minimal, next: "" }).note).toBeNull();
  });
  it.each(["a\nb", "a\u0000b", "a\u200bb", "a\ud800b"])(
    "refuses unsupported field text %j",
    (value) => {
      expect(
        proposeThesisReview("Original", { ...review, thesis: value }).note,
      ).toBeNull();
      expect(proposeThesisReview(value, review).note).toBeNull();
    },
  );
  it("uses the save policy's normalized code-point limit for the complete note", () => {
    const excerpt = proposeThesisReview("", review).excerpt!;
    const remaining = 2000 - Array.from(excerpt).length - 1;
    expect(
      proposeThesisReview("😀".repeat(remaining), review).note,
    ).not.toBeNull();
    expect(
      proposeThesisReview("e\u0301".repeat(remaining), review).note,
    ).not.toBeNull();
    expect(
      proposeThesisReview("😀".repeat(remaining + 1), review).note,
    ).toBeNull();
  });
  it("refuses an immediate duplicate without discarding the preview", () => {
    const first = proposeThesisReview("Original", review);
    const duplicate = proposeThesisReview(first.note!, review);
    expect(duplicate.note).toBeNull();
    expect(duplicate.excerpt).toBe(first.excerpt);
    expect(duplicate.reason).toContain("already at the end");
    expect(
      proposeThesisReview(first.note!, {
        ...review,
        next: "Check the new filing",
      }).note,
    ).not.toBeNull();
  });
});
