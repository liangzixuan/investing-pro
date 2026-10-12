import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManagedFilingsNoteAction,
  type ManagedFilingsNoteActions,
} from "./ManagedFilingsNoteAction";
import { filingsResponse } from "./sec-filings-fixture";

const hooks = vi.hoisted<{ state: unknown }>(() => ({ state: undefined }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => "filing-help",
    useState: (initial: unknown) => {
      hooks.state ??= initial;
      return [
        hooks.state,
        (next: unknown) => {
          hooks.state = next;
        },
      ];
    },
  };
});
afterEach(() => {
  hooks.state = undefined;
});
function fixture() {
  const response = filingsResponse(1);
  const actions: ManagedFilingsNoteActions = {
    getAction: vi.fn(() => ({ canAppend: true, reason: null })),
    append: vi.fn(() => ({
      appended: true,
      message: "Added to draft. Review and save.",
    })),
  };
  const render = (packet = response) =>
    ManagedFilingsNoteAction({
      response: packet,
      filing: packet.issuer.filings[0]!,
      actions,
    });
  const button = (node: React.ReactElement<{ children: React.ReactNode }>) =>
    React.Children.toArray(node.props.children)[0] as React.ReactElement<{
      onClick: () => void;
    }>;
  return { response, actions, render, button };
}
describe("filing reference row action", () => {
  it("labels the exact row and reports the real draft-only result", () => {
    const { response, actions, render, button } = fixture();
    expect(renderToStaticMarkup(render())).toContain(
      'aria-label="Add Form 10-Q filing 0000000001-26-000001 reference to note draft"',
    );
    button(render()).props.onClick();
    expect(actions.append).toHaveBeenCalledExactlyOnceWith(
      response,
      response.issuer.filings[0],
    );
    expect(renderToStaticMarkup(render())).toContain(
      "Added to draft. Review and save.",
    );
  });
  it("keeps disabled actions focusable and rechecks editability on an old handler", () => {
    const { actions, render, button } = fixture();
    const captured = button(render()).props.onClick;
    vi.mocked(actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "Resolve the conflict first.",
    });
    const html = renderToStaticMarkup(render());
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled[=\s>]/u);
    captured();
    expect(actions.append).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render())).toContain(
      "Resolve the conflict first.",
    );
  });
  it("shows rejection from the final append check and clears feedback for replaced responses without remount", () => {
    const { actions, render, button } = fixture();
    vi.mocked(actions.append).mockReturnValue({
      appended: false,
      message: "The visit changed.",
    });
    button(render()).props.onClick();
    expect(renderToStaticMarkup(render())).toContain("The visit changed.");
    expect(renderToStaticMarkup(render(filingsResponse(1)))).not.toContain(
      "The visit changed.",
    );
  });
});
