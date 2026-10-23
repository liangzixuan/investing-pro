import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ManagedFollowupAssessment } from "./ManagedFollowupAssessment";

function field(value: string, readOnly = false) {
  const onChange = vi.fn();
  const node: React.ReactElement<{ children: React.ReactNode }> =
    ManagedFollowupAssessment({
      id: "assessment",
      value,
      readOnly,
      onChange,
    });
  const label = React.Children.toArray(node.props.children).find(
    (child) => React.isValidElement(child) && child.type === "label",
  ) as React.ReactElement<{ children: React.ReactNode }>;
  const textarea = React.Children.toArray(label.props.children).find(
    (child) => React.isValidElement(child) && child.type === "textarea",
  ) as React.ReactElement<{
    value: string;
    readOnly: boolean;
    "aria-invalid": boolean;
    onChange: (event: { currentTarget: { value: string } }) => void;
  }>;
  return { node, textarea, onChange };
}

it("keeps the exact raw value and passes the complete authored edit without clipping", () => {
  const raw = "  Assessment · 財報 café 📈  ";
  const f = field(raw);
  expect(f.textarea.props.value).toBe(raw);
  const next = raw + "x".repeat(2001);
  f.textarea.props.onChange({ currentTarget: { value: next } });
  expect(f.onChange).toHaveBeenCalledExactlyOnceWith(next);
  expect(renderToStaticMarkup(f.node)).toContain("not a verified source fact");
});

it.each(["x".repeat(2001), "invalid\nresult", "\ud800"])(
  "marks invalid raw text without replacing it",
  (raw) => {
    const f = field(raw);
    expect(f.textarea.props.value).toBe(raw);
    expect(f.textarea.props["aria-invalid"]).toBe(true);
    expect(f.onChange).not.toHaveBeenCalled();
  },
);

it("uses the current code-point limit and a labelled readonly field", () => {
  const f = field("📈".repeat(2000), true);
  expect(f.textarea.props["aria-invalid"]).toBe(false);
  expect(f.textarea.props.readOnly).toBe(true);
  const html = renderToStaticMarkup(f.node);
  expect(html).toContain('for="assessment"');
  expect(html).toContain('aria-describedby="assessment-help"');
});
