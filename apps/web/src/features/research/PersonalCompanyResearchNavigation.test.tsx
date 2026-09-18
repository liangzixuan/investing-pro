import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalCompanyResearchNavigation,
  type PersonalCompanyResearchNavigationProps,
} from "./PersonalCompanyResearchNavigation";

type ElementProps = { children?: ReactNode; [key: string]: unknown };
type Element = React.ReactElement<ElementProps>;
let props: PersonalCompanyResearchNavigationProps;

beforeEach(() => {
  props = {
    position: 50,
    total: 120,
    disabled: false,
    invalidated: false,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  };
});

describe("PersonalCompanyResearchNavigation", () => {
  it("announces the one-based cohort position and associates both controls with the reset disclosure", () => {
    const view = PersonalCompanyResearchNavigation(props);
    const nodes = elements(view);
    expect(view.type).toBe("nav");
    expect(nodes[0]!.props["aria-label"]).toBe(
      "My Watchlist company navigation",
    );
    const status = nodes.find((node) => node.props.role === "status")!;
    expect(status.props.id).toBe("company-research-navigation-status");
    expect(status.props.children).toBe(
      "Company 50 of 120 My Watchlist matches",
    );
    expect(status.props["aria-live"]).toBe("polite");
    expect(status.props["aria-atomic"]).toBe("true");
    for (const button of buttons(view)) {
      expect(button.props.type).toBe("button");
      const hints = nodes.filter(
        (node) => node.props.id === button.props["aria-describedby"],
      );
      expect(hints).toHaveLength(1);
      expect(renderToStaticMarkup(hints[0])).toContain(
        "Changing company clears loaded research and valuation assumptions. Watchlist note drafts are kept.",
      );
    }
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it.each([
    [1, 120, true, false],
    [50, 120, false, false],
    [51, 120, false, false],
    [120, 120, false, true],
    [1, 1, true, true],
  ])(
    "disables only the unavailable endpoints at company %i of %i",
    (position, total, previousDisabled, nextDisabled) => {
      props = { ...props, position, total };
      const [previous, next] = buttons(
        PersonalCompanyResearchNavigation(props),
      );
      expect(previous!.props.children).toBe("Previous company");
      expect(next!.props.children).toBe("Next company");
      expect(previous!.props.disabled).toBe(previousDisabled);
      expect(next!.props.disabled).toBe(nextDisabled);
      expect(props.onPrevious).not.toHaveBeenCalled();
      expect(props.onNext).not.toHaveBeenCalled();
    },
  );

  it("delegates explicit navigation without changing the supplied position or invoking the other action", () => {
    const [previous, next] = buttons(PersonalCompanyResearchNavigation(props));
    (next!.props.onClick as () => void)();
    expect(props.onNext).toHaveBeenCalledExactlyOnceWith();
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(
      renderToStaticMarkup(PersonalCompanyResearchNavigation(props)),
    ).toContain("Company 50 of 120 My Watchlist matches");
    props = { ...props, position: 51 };
    expect(
      renderToStaticMarkup(PersonalCompanyResearchNavigation(props)),
    ).toContain("Company 51 of 120 My Watchlist matches");
    (previous!.props.onClick as () => void)();
    expect(props.onPrevious).toHaveBeenCalledExactlyOnceWith();
    expect(props.onNext).toHaveBeenCalledOnce();
  });

  it("pauses both controls without losing the current count when temporarily disabled", () => {
    props = { ...props, disabled: true };
    const view = PersonalCompanyResearchNavigation(props);
    expect(
      buttons(view).every((button) => button.props.disabled === true),
    ).toBe(true);
    expect(renderToStaticMarkup(view)).toContain(
      "Company 50 of 120 My Watchlist matches",
    );
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("replaces stale position text with a restart instruction and disabled controls after invalidation", () => {
    props = { ...props, invalidated: true };
    const view = PersonalCompanyResearchNavigation(props);
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain(
      "This research sequence is no longer current. Open Research from My Watchlist to start again.",
    );
    expect(markup).not.toContain("Company 50 of 120");
    expect(markup).toContain(
      "Changing company clears loaded research and valuation assumptions. Watchlist note drafts are kept.",
    );
    expect(
      buttons(view).every((button) => button.props.disabled === true),
    ).toBe(true);
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
  });

  it("renders only fresh controlled state when the parent supplies a new sequence", () => {
    props = { ...props, invalidated: true };
    PersonalCompanyResearchNavigation(props);
    props = { ...props, invalidated: false, position: 1, total: 3 };
    const view = PersonalCompanyResearchNavigation(props);
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain("Company 1 of 3 My Watchlist matches");
    expect(markup).not.toContain("no longer current");
    const [previous, next] = buttons(view);
    expect(previous!.props.disabled).toBe(true);
    expect(next!.props.disabled).toBe(false);
    expect(props.onPrevious).not.toHaveBeenCalled();
    expect(props.onNext).not.toHaveBeenCalled();
  });
});

function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function buttons(view: ReactNode): Element[] {
  const result = elements(view).filter((node) => node.type === "button");
  expect(result).toHaveLength(2);
  return result;
}
