import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedPriceNoteAction } from "./ManagedPriceNoteAction";

const hooks = vi.hoisted(() => ({ direct: false, message: "" }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "price-note-help" : actual.useId()),
    useState: (initial: string) =>
      hooks.direct
        ? [
            hooks.message,
            (next: string) => {
              hooks.message = next;
            },
          ]
        : actual.useState(initial),
  };
});
afterEach(() => {
  hooks.direct = false;
  hooks.message = "";
});
function button(node: React.ReactElement<{ children?: React.ReactNode }>) {
  return React.Children.toArray(node.props.children).find(
    (child) => React.isValidElement(child) && child.type === "button",
  ) as React.ReactElement<{ onClick: () => void }>;
}
describe("Price comparison note action", () => {
  it("connects the disabled control to the current refusal without calling append", () => {
    const reason =
      "Add this company to the watchlist draft before adding a price comparison.";
    const append = vi.fn();
    const html = renderToStaticMarkup(
      <ManagedPriceNoteAction
        action={{ canAppend: false, reason }}
        isCurrent={() => true}
        onAppend={append}
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain(">Add comparison to note draft</button>");
    const help = /aria-describedby="([^"]+)"/u.exec(html)?.[1];
    expect(help).toBeTruthy();
    expect(html).toContain(`<p id="${help}">${reason}</p>`);
    expect(append).not.toHaveBeenCalled();
  });
  it.each([
    {
      appended: true,
      message:
        "Price comparison added to the note draft. Review and save all changes in My Watchlist.",
    },
    {
      appended: false,
      message: "The complete note must fit within 2,000 characters.",
    },
  ])(
    "announces the actual append result with no automatic save: $appended",
    (result) => {
      hooks.direct = true;
      const onAppend = vi.fn(() => result);
      const render = () =>
        ManagedPriceNoteAction({
          action: { canAppend: true, reason: null },
          isCurrent: () => true,
          onAppend,
        });
      button(render()).props.onClick();
      expect(onAppend).toHaveBeenCalledOnce();
      const html = renderToStaticMarkup(render());
      expect(html).toContain(
        `<p role="status" aria-live="polite">${result.message}</p>`,
      );
      expect(html).toContain(
        "exact endpoints, raw change and original source dates",
      );
      expect(html).toContain("Nothing is saved here.");
    },
  );
  it("refuses an obsolete selection before calling the coordinator", () => {
    hooks.direct = true;
    let current = true;
    const onAppend = vi.fn(() => ({ appended: true, message: "Unexpected" }));
    const render = () =>
      ManagedPriceNoteAction({
        action: { canAppend: true, reason: null },
        isCurrent: () => current,
        onAppend,
      });
    const captured = button(render());
    current = false;
    captured.props.onClick();
    expect(onAppend).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render())).toContain(
      "The displayed price comparison changed. Choose a starting date again.",
    );
  });
});
