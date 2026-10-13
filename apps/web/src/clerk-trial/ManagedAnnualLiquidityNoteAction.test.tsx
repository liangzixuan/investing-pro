import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ManagedAnnualLiquidityNoteAction,
  type ManagedAnnualLiquidityNoteActions,
} from "./ManagedAnnualLiquidityNoteAction";
import {
  liquidityResponse,
  liquidityRow,
} from "../features/research/sec-annual-liquidity-fixture";

const hooks = vi.hoisted<{ state: unknown }>(() => ({ state: undefined }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useId: () => "liquidity-note-help",
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

async function fixture() {
  const response = await liquidityResponse([
    liquidityRow("current_assets", "120.125"),
    liquidityRow("current_liabilities", "20.025"),
  ]);
  const actions: ManagedAnnualLiquidityNoteActions = {
    getAction: vi.fn(() => ({ canAppend: true, reason: null })),
    append: vi.fn(() => ({
      appended: true,
      message: "Added to draft. Review and save all changes in My Watchlist.",
    })),
  };
  const render = (packet = response) =>
    ManagedAnnualLiquidityNoteAction({ response: packet, actions });
  const button = (node: React.ReactElement<{ children: React.ReactNode }>) =>
    React.Children.toArray(node.props.children)[0] as React.ReactElement<{
      onClick: () => void;
    }>;
  return { response, actions, render, button };
}

describe("managed Annual liquidity note action", () => {
  it("labels the action, associates its draft-only scope and announces the real append result", async () => {
    const { response, actions, render, button } = await fixture();
    const html = renderToStaticMarkup(render());
    expect(html).toContain("Add liquidity to note draft");
    expect(html).toContain('aria-describedby="liquidity-note-help"');
    expect(html).toContain('id="liquidity-note-help"');
    expect(html).toContain("Nothing is saved here.");
    expect(html).toContain('role="status" aria-live="polite"');
    button(render()).props.onClick();
    expect(actions.append).toHaveBeenCalledExactlyOnceWith(response);
    expect(renderToStaticMarkup(render())).toContain(
      "Added to draft. Review and save all changes in My Watchlist.",
    );
    expect(renderToStaticMarkup(render())).toContain(
      'class="managed-annual-liquidity-note-status" role="status" aria-live="polite"',
    );
  });

  it("keeps unavailable controls focusable and rechecks an already captured handler", async () => {
    const { response, actions, render, button } = await fixture();
    const captured = button(render()).props.onClick;
    vi.mocked(actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "Resolve the conflict first.",
    });
    const html = renderToStaticMarkup(render());
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled[=\s>]/u);
    expect(html).not.toContain('tabindex="-1"');
    captured();
    expect(actions.getAction).toHaveBeenLastCalledWith(response);
    expect(actions.append).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(render())).toContain(
      "Resolve the conflict first.",
    );
  });

  it("shows the final append refusal and clears it for an equal-valued replacement object", async () => {
    const { response, actions, render, button } = await fixture();
    vi.mocked(actions.append).mockReturnValue({
      appended: false,
      message: "The Annual visit changed.",
    });
    const captured = button(render()).props.onClick;
    captured();
    expect(renderToStaticMarkup(render())).toContain(
      "The Annual visit changed.",
    );
    expect(renderToStaticMarkup(render())).toContain(
      'class="managed-annual-liquidity-note-status" role="status" aria-live="polite">The Annual visit changed.</p>',
    );
    const replacement = structuredClone(response);
    expect(replacement.evidence.generation.sha256).toBe(
      response.evidence.generation.sha256,
    );
    expect(renderToStaticMarkup(render(replacement))).not.toContain(
      "The Annual visit changed.",
    );
    captured();
    expect(actions.getAction).toHaveBeenLastCalledWith(response);
    expect(renderToStaticMarkup(render(replacement))).not.toContain(
      "The Annual visit changed.",
    );
  });

  it.each([
    ["membership Add", "Add this company to the watchlist draft first."],
    ["note edit", "The complete note must fit within 2,000 characters."],
    ["Cancel", "Wait for the Annual request to finish or cancel it."],
  ])(
    "clears obsolete refusal after %s restores eligibility",
    async (_, reason) => {
      const { actions, render, button } = await fixture();
      vi.mocked(actions.getAction).mockReturnValue({
        canAppend: false,
        reason,
      });
      button(render()).props.onClick();
      expect(renderToStaticMarkup(render())).toContain(reason);
      vi.mocked(actions.getAction).mockReturnValue({
        canAppend: true,
        reason: null,
      });
      const available = renderToStaticMarkup(render());
      expect(available).toContain('aria-disabled="false"');
      expect(available).not.toContain(reason);
      expect(available).toContain(
        'class="managed-annual-liquidity-note-status" role="status" aria-live="polite"></p>',
      );
      expect(actions.append).not.toHaveBeenCalled();
    },
  );

  it("shows the current reason when one refusal replaces another", async () => {
    const { actions, render, button } = await fixture();
    vi.mocked(actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "This exact liquidity evidence is already in the note draft.",
    });
    button(render()).props.onClick();
    vi.mocked(actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "The complete note must fit within 2,000 characters.",
    });
    const changed = renderToStaticMarkup(render());
    expect(changed).not.toContain("already in the note draft");
    expect(changed).toContain(
      "The complete note must fit within 2,000 characters.",
    );
    expect(actions.append).not.toHaveBeenCalled();
  });

  it("retains success after the duplicate guard appears but clears it on response replacement", async () => {
    const { response, actions, render, button } = await fixture();
    button(render()).props.onClick();
    vi.mocked(actions.getAction).mockReturnValue({
      canAppend: false,
      reason: "This exact liquidity evidence is already in the note draft.",
    });
    const completed = renderToStaticMarkup(render());
    expect(completed).toContain("Review and save all changes in My Watchlist.");
    expect(completed).toContain("already in the note draft");
    expect(completed).toContain(
      'class="managed-annual-liquidity-note-status" role="status" aria-live="polite"',
    );
    button(render()).props.onClick();
    const duplicate = renderToStaticMarkup(render());
    expect(duplicate).toContain(
      '<p id="liquidity-note-help">This exact liquidity evidence is already in the note draft.</p>',
    );
    expect(duplicate).toContain(
      'class="managed-annual-liquidity-note-status sr-only" role="status" aria-live="polite">This exact liquidity evidence is already in the note draft.</p>',
    );
    expect(
      renderToStaticMarkup(render(structuredClone(response))),
    ).not.toContain("Review and save all changes in My Watchlist.");
    expect(actions.append).toHaveBeenCalledOnce();
  });
});
