import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ThesisReviewForm } from "./ManagedThesisReview";
import {
  emptyThesisReview,
  proposeThesisReview,
} from "./managed-thesis-review";

function elements(
  node: React.ReactNode,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(
      elements,
    ),
  ];
}
const review = {
  ...emptyThesisReview,
  thesis: "My <assessment>",
  invalidate: "Reported evidence contradicts it",
  next: "Read the next filing",
};
function form(disabled = false, note = "Original note") {
  const onChange = vi.fn(),
    onReview = vi.fn();
  const node = ThesisReviewForm({
    id: "qa-note",
    symbol: "DEMO",
    note,
    review,
    disabled,
    onChange,
    onReview,
  });
  const button = elements(node).find((n) => n.type === "button")!;
  return { node, button, onChange, onReview, html: renderToStaticMarkup(node) };
}
describe("thesis review form", () => {
  it("previews escaped assessment in a closed disclosure and changes no draft until Add", () => {
    const result = form();
    expect(result.html).not.toContain("<details open");
    expect(result.html).toContain("Write a thesis review for DEMO");
    expect(result.html).toContain("My &lt;assessment&gt;");
    expect(result.onChange).not.toHaveBeenCalled();
    (result.button.props.onClick as () => void)();
    expect(result.onChange).toHaveBeenCalledExactlyOnceWith(
      proposeThesisReview("Original note", review).note,
      "Original note",
    );
  });
  it("edits only the review field, preserving the other authored fields", () => {
    const result = form();
    const input = elements(result.node).find(
      (n) => n.props.id === "qa-note-review-next",
    )!;
    (input.props.onChange as (e: { target: { value: string } }) => void)({
      target: { value: "Check the new report" },
    });
    expect(result.onReview).toHaveBeenCalledExactlyOnceWith({
      ...review,
      next: "Check the new report",
    });
    expect(result.onChange).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "blocks paused or oversized appends while keeping the preview readable: %s",
    (paused) => {
      const result = form(paused, paused ? "Original" : "x".repeat(2000));
      expect(result.button.props.disabled).toBe(true);
      (result.button.props.onClick as () => void)();
      expect(result.onChange).not.toHaveBeenCalled();
      expect(result.html).toContain("Review preview");
    },
  );
});
