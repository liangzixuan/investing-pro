import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedNoteEditor } from "./ManagedNoteEditor";

function editor(note: string, disabled = false) {
  const onChange = vi.fn();
  const element: React.ReactElement<{ children: React.ReactNode }> =
    ManagedNoteEditor({
      id: "invented-note",
      listingId: "listing-invented",
      symbol: "INVENTED",
      note,
      disabled,
      helpId: "invented-note-help",
      onChange,
    });
  const input = React.Children.toArray(element.props.children).find(
    (child) => React.isValidElement(child) && child.type === "textarea",
  ) as React.ReactElement<React.ComponentProps<"textarea">>;
  return { input, onChange, html: renderToStaticMarkup(element) };
}

describe("managed note editor", () => {
  it.each([
    ["empty", ""],
    ["trimmed blank", " \t\n "],
    ["trimmed boundary", `  ${"x".repeat(2000)}  `],
    ["NFC boundary", "e\u0301".repeat(2000)],
    ["astral boundary", "😀".repeat(2000)],
  ])("accepts the %s without changing its raw draft", (_name, note) => {
    const { input, html, onChange } = editor(note);
    expect(input.props.value).toBe(note);
    expect(input.props.maxLength).toBe(4000);
    expect(input.props["aria-invalid"]).toBeUndefined();
    expect(input.props["aria-describedby"]).toBe("invented-note-help");
    expect(html).toContain('data-managed-note-listing-id="listing-invented"');
    expect(html).toContain(
      '<div id="invented-note-error" role="status" aria-live="polite"></div>',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ["length", "x".repeat(2001)],
    ["astral length", "😀".repeat(2001)],
    ["embedded newline", "First line\nSecond line"],
    ["control character", "First\u0000Second"],
    ["format character", "First\u200bSecond"],
    ["unpaired surrogate", "First\ud800Second"],
  ])("identifies %s errors on the exact field", (_name, note) => {
    const { input, html, onChange } = editor(note);
    expect(input.props.value).toBe(note);
    expect(input.props["aria-invalid"]).toBe(true);
    expect(input.props["aria-describedby"]).toBe(
      "invented-note-help invented-note-error",
    );
    expect(html).toContain(
      "Use at most 2,000 characters. Remove embedded line breaks and unsupported characters.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("passes edits through unchanged and keeps disabled-state feedback readable", () => {
    const { input, onChange } = editor("Original draft");
    const raw = "  Cafe\u0301\nFurther research  ";
    input.props.onChange!({
      target: { value: raw },
    } as React.ChangeEvent<HTMLTextAreaElement>);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(raw);
    const blocked = editor(raw, true);
    expect(blocked.input.props.disabled).toBe(true);
    expect(blocked.input.props.value).toBe(raw);
    expect(blocked.input.props["aria-invalid"]).toBe(true);
  });
});
