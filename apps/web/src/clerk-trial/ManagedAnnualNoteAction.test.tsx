import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { response } from "../features/research/sec-annual-evidence-fixture";
import { ManagedAnnualNoteAction } from "./ManagedAnnualNoteAction";

const hooks = vi.hoisted(() => ({ direct: false, message: "" }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => (hooks.direct ? "annual-note-help" : actual.useId()),
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

describe("Annual note action", () => {
  it("names the chosen basis and connects a disabled action to its explanation", async () => {
    const wire = await response();
    const pair = wire.evidence.resolution.bases.flatMap(
      (basis) => basis.pairs,
    )[0]!;
    const onAppend = vi.fn<() => { appended: boolean; message: string }>();
    const reason =
      "Add this company to the watchlist draft before adding Annual evidence.";
    const html = renderToStaticMarkup(
      <ManagedAnnualNoteAction
        pair={pair}
        action={{ canAppend: false, reason }}
        onAppend={onAppend}
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain(
      'aria-label="Add Revenues annual evidence to note draft"',
    );
    const describedBy = /aria-describedby="([^"]+)"/u.exec(html)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`<p id="${describedBy}">${reason}</p>`);
    expect(onAppend).not.toHaveBeenCalled();
  });

  it.each([
    {
      appended: true,
      message:
        "Annual evidence added to the note draft. Review and save all changes in My Watchlist.",
    },
    {
      appended: false,
      message: "The displayed Annual evidence changed. Choose its basis again.",
    },
  ])(
    "announces the actual append result without claiming an automatic save: $appended",
    async (result) => {
      const wire = await response();
      const pair = wire.evidence.resolution.bases.flatMap(
        (basis) => basis.pairs,
      )[0]!;
      const onAppend = vi.fn(() => result);
      hooks.direct = true;
      const render = () =>
        ManagedAnnualNoteAction({
          pair,
          action: { canAppend: true, reason: null },
          onAppend,
        });
      const action = render() as React.ReactElement<{
        children?: React.ReactNode;
      }>;
      const children = React.Children.toArray(action.props.children);
      const button = children.find(
        (node) => React.isValidElement(node) && node.type === "button",
      ) as React.ReactElement<{ onClick: () => void }>;
      button.props.onClick();
      expect(onAppend).toHaveBeenCalledOnce();
      const html = renderToStaticMarkup(render());
      expect(html).toContain(
        `<p role="status" aria-live="polite">${result.message}</p>`,
      );
      expect(html).toContain("Nothing is saved here.");
      const blocked = renderToStaticMarkup(
        ManagedAnnualNoteAction({
          pair,
          action: {
            canAppend: false,
            reason: "Edit the note to make room for this evidence.",
          },
          onAppend,
        }),
      );
      expect(blocked).toContain(
        "Edit the note to make room for this evidence.",
      );
      expect(blocked).toContain('disabled=""');
      expect(blocked).toContain(result.message);
    },
  );
});
