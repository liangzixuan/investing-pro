import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedNoteEditor } from "./ManagedNoteEditor";

function editor(note: string, disabled = false) {
  const onChange = vi.fn<(note: string) => void>();
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
  const reading = React.Children.toArray(element.props.children).find(
    (child) => React.isValidElement(child) && child.type === "details",
  ) as React.ReactElement<React.ComponentProps<"details">>;
  return {
    input,
    reading,
    onChange,
    html: renderToStaticMarkup(element),
    readingHtml: renderToStaticMarkup(reading),
  };
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

  it("offers the complete long current draft without a save or truncated reading field", () => {
    const note = `Start of invented research. ${"Exact evidence; ".repeat(110)}End of invented research.`;
    const { reading, readingHtml, onChange } = editor(note);
    expect(reading.props.open).toBeUndefined();
    expect(readingHtml).toContain("Read full note for INVENTED");
    expect(readingHtml).toContain(
      `<p id="invented-note-reading-text" class="trial-saved-note">${note}</p>`,
    );
    expect(readingHtml).toContain(
      "Current draft. Save all changes in My Watchlist.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps raw invalid text and literal markup readable while editing is paused", () => {
    const raw =
      "  First line\n<script>alert('invented')</script> & second line  ";
    const { input, readingHtml, onChange } = editor(raw, true);
    expect(input.props.disabled).toBe(true);
    expect(input.props["aria-invalid"]).toBe(true);
    expect(readingHtml).toContain(
      "  First line\n&lt;script&gt;alert(&#x27;invented&#x27;)&lt;/script&gt; &amp; second line  ",
    );
    expect(readingHtml).not.toContain("<script>");
    expect(readingHtml).not.toContain("disabled");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reads the latest edit and explains an empty draft", () => {
    const original = editor("Earlier draft");
    original.input.props.onChange!({
      target: { value: "Latest invented draft" },
    } as React.ChangeEvent<HTMLTextAreaElement>);
    const updated = editor(original.onChange.mock.calls[0]![0]);
    expect(updated.readingHtml).toContain("Latest invented draft");
    expect(updated.readingHtml).not.toContain("Earlier draft");
    expect(editor("").readingHtml).toContain("No note in this draft.");
  });
});
