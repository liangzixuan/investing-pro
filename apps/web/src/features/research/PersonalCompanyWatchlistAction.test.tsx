import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalCompanyWatchlistAction,
  type PersonalCompanyWatchlistActionProps,
} from "./PersonalCompanyWatchlistAction";

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = React.ReactElement<ElementProps>;
let props: PersonalCompanyWatchlistActionProps;

beforeEach(() => {
  props = {
    saved: false,
    pending: false,
    disabled: false,
    unavailableReason: null,
    message: null,
    onAdd: vi.fn(),
  };
});

describe("PersonalCompanyWatchlistAction", () => {
  it("explains the note benefit and exposes one explicit, described add button", () => {
    const view = PersonalCompanyWatchlistAction(props);
    const nodes = elements(view);
    const button = only(view, "button");
    expect(button.props.id).toBe("company-watchlist-add");
    expect(button.props.children).toBe("Add to My Watchlist");
    expect(button.props.type).toBe("button");
    expect(button.props.disabled).toBe(false);
    expect(button.props["aria-busy"]).toBe(false);
    for (const id of (button.props["aria-describedby"] as string).split(" ")) {
      expect(nodes.filter((node) => node.props.id === id)).toHaveLength(1);
    }
    expect(renderToStaticMarkup(view)).toContain(
      "Add this company to My Watchlist to keep a research note.",
    );
    expect(nodes.filter((node) => node.type === "form")).toHaveLength(0);
    expect(props.onAdd).not.toHaveBeenCalled();

    (button.props.onClick as () => void)();
    expect(props.onAdd).toHaveBeenCalledExactlyOnceWith();
    expect(
      only(PersonalCompanyWatchlistAction(props), "button").props.children,
    ).toBe("Add to My Watchlist");
  });

  it.each([
    { disabled: true, pending: false, label: "Add to My Watchlist" },
    { disabled: false, pending: true, label: "Adding…" },
    { disabled: true, pending: true, label: "Adding…" },
  ])(
    "disables the native button for $disabled / $pending",
    ({ disabled, pending, label }) => {
      props = {
        ...props,
        disabled,
        pending,
        message: "Saving the selected company.",
      };
      const view = PersonalCompanyWatchlistAction(props);
      const button = only(view, "button");
      expect(button.props.disabled).toBe(true);
      expect(button.props["aria-busy"]).toBe(pending);
      expect(button.props.children).toBe(label);
      expect(status(view).props.children).toBe(props.message);
      expect(props.onAdd).not.toHaveBeenCalled();
    },
  );

  it("explains an unavailable action without offering a save or claiming membership", () => {
    props = {
      ...props,
      unavailableReason:
        "Reconcile this company's saved identity before adding it.",
      message: "The catalog identity changed.",
    };
    const view = PersonalCompanyWatchlistAction(props);
    expect(
      elements(view).filter((node) => node.type === "button"),
    ).toHaveLength(0);
    const markup = renderToStaticMarkup(view);
    expect(
      elements(view).find(
        (node) => node.props.id === "company-watchlist-add-hint",
      )?.props.children,
    ).toBe(props.unavailableReason);
    expect(markup).not.toContain("Add this company to My Watchlist");
    expect(status(view).props.children).toBe(props.message);
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("keeps the polite atomic status location while a completed save removes the action and hint", () => {
    const before = status(PersonalCompanyWatchlistAction(props));
    expect(before.props.id).toBe("company-watchlist-add-status");
    expect(before.props["aria-live"]).toBe("polite");
    expect(before.props["aria-atomic"]).toBe("true");
    expect(before.props.children).toBeNull();

    props = { ...props, saved: true, message: "Added to My Watchlist." };
    const view = PersonalCompanyWatchlistAction(props);
    const after = status(view);
    expect(after.type).toBe(before.type);
    expect(after.props.id).toBe(before.props.id);
    expect(after.props.children).toBe(props.message);
    expect(
      elements(view).filter((node) => node.type === "button"),
    ).toHaveLength(0);
    expect(
      elements(view).filter(
        (node) => node.props.id === "company-watchlist-add-hint",
      ),
    ).toHaveLength(0);
    expect(
      elements(view).find(
        (node) => node.props.className === "company-research-note-actions",
      )?.props.children,
    ).toContain(after);
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("uses only fresh controlled props after saved, pending, unavailable and message transitions", () => {
    props = {
      ...props,
      saved: true,
      pending: true,
      unavailableReason: "Old company",
      message: "Saved old company.",
    };
    const saved = PersonalCompanyWatchlistAction(props);
    expect(
      elements(saved).filter((node) => node.type === "button"),
    ).toHaveLength(0);
    expect(renderToStaticMarkup(saved)).not.toContain("Old company");
    props = {
      ...props,
      saved: false,
      pending: false,
      unavailableReason: null,
      message: null,
    };
    const fresh = PersonalCompanyWatchlistAction(props);
    expect(only(fresh, "button").props.disabled).toBe(false);
    expect(only(fresh, "button").props.children).toBe("Add to My Watchlist");
    expect(status(fresh).props.children).toBeNull();
    expect(renderToStaticMarkup(fresh)).not.toContain("Saved old company.");
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("keeps long supplied feedback as text inside the existing wrapping layout", () => {
    const longReason = `Identity <${"X".repeat(500)}> is unavailable.`;
    props = {
      ...props,
      unavailableReason: longReason,
      message: "Review <identity> & retry.",
    };
    const view = PersonalCompanyWatchlistAction(props);
    expect(elements(view)[0]?.props.className).toBe("company-research-note");
    const hint = elements(view).find(
      (node) => node.props.id === "company-watchlist-add-hint",
    )!;
    expect(hint.props.className).toBe("company-research-note-hint");
    expect(hint.props.children).toBe(longReason);
    expect(status(view).props.className).toBe("company-research-note-status");
    expect(elements(view).every((node) => node.props.style === undefined)).toBe(
      true,
    );
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(
      `Identity &lt;${"X".repeat(500)}&gt; is unavailable.`,
    );
    expect(markup).toContain("Review &lt;identity&gt; &amp; retry.");
    expect(props.onAdd).not.toHaveBeenCalled();
  });
});

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function only(view: ReactNode, type: string): Element {
  const matches = elements(view).filter((node) => node.type === type);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function status(view: ReactNode): Element {
  const matches = elements(view).filter((node) => node.props.role === "status");
  expect(matches).toHaveLength(1);
  return matches[0]!;
}
