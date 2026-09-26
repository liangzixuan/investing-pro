import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MarketBoardPicker,
  type MarketBoardPickerProps,
} from "./MarketBoardPicker";
import type { MarketBoardMember } from "./market-board-loader";

function member(symbol: string): MarketBoardMember {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${symbol}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol}`,
    securityId: `security-${symbol}`,
    securityName: "Common stock",
    shareClassId: `class-${symbol}`,
    shareClassName: "Common",
    symbol,
  };
}
function props(
  overrides: Partial<MarketBoardPickerProps> = {},
): MarketBoardPickerProps {
  return {
    draft: { kind: "watchlist", members: [] },
    watchlist: {
      status: "available",
      members: [member("ZED"), member("ALFA"), member("BETA")],
    },
    disabled: false,
    onModeChange: vi.fn(),
    onToggleWatchlist: vi.fn(),
    ...overrides,
  };
}
function nodes(
  node: ReactNode,
): ReactElement<{ children?: ReactNode; [key: string]: unknown }>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (
    !React.isValidElement<{ children?: ReactNode; [key: string]: unknown }>(
      node,
    )
  )
    return [];
  return [node, ...nodes(node.props.children)];
}
const inputs = (input: MarketBoardPickerProps) =>
  nodes(MarketBoardPicker(input)).filter((node) => node.type === "input");

describe("Market board picker", () => {
  it("uses native checkboxes in saved order and performs no action on render", () => {
    const input = props();
    const html = renderToStaticMarkup(<MarketBoardPicker {...input} />);
    expect(inputs(input)).toHaveLength(3);
    expect(inputs(input).every((node) => node.props.type === "checkbox")).toBe(
      true,
    );
    expect(html.indexOf("ZED")).toBeLessThan(html.indexOf("ALFA"));
    expect(html).toContain("Choose at least one company to load");
    expect(input.onToggleWatchlist).not.toHaveBeenCalled();
    expect(input.onModeChange).not.toHaveBeenCalled();
  });
  it("sends exact listing identity and native checked state to the draft owner", () => {
    const input = props();
    (inputs(input)[1]!.props.onChange as (event: unknown) => void)({
      currentTarget: { checked: true },
    });
    expect(input.onToggleWatchlist).toHaveBeenCalledExactlyOnceWith(
      "listing-ALFA",
      true,
    );
    expect(input.draft).toEqual({ kind: "watchlist", members: [] });
  });
  it("keeps selected checkboxes usable at six and disables a seventh choice", () => {
    const members = ["A", "B", "C", "D", "E", "F", "G"].map(member);
    const input = props({
      watchlist: { status: "available", members },
      draft: { kind: "watchlist", members: members.slice(0, 6) },
    });
    const choices = inputs(input);
    expect(
      choices
        .slice(0, 6)
        .every((node) => node.props.checked && !node.props.disabled),
    ).toBe(true);
    expect(choices[6]!.props.checked).toBe(false);
    expect(choices[6]!.props.disabled).toBe(true);
    expect(renderToStaticMarkup(<MarketBoardPicker {...input} />)).toContain(
      "Uncheck a company to choose another",
    );
  });
  it("does not mark a changed same-listing identity as the checked saved member", () => {
    const old = member("ZED");
    const input = props({
      draft: { kind: "watchlist", members: [old] },
      watchlist: {
        status: "available",
        members: [{ ...old, shareClassId: "changed-class" }],
      },
    });
    expect(inputs(input)[0]!.props.checked).toBe(false);
  });
  it("shows unsupported ADRs without offering their checkbox", () => {
    const input = props({
      watchlist: {
        status: "available",
        members: [{ ...member("ADR"), instrumentType: "adr" }],
      },
    });
    expect(inputs(input)[0]!.props.disabled).toBe(true);
    expect(renderToStaticMarkup(<MarketBoardPicker {...input} />)).toContain(
      "Common stocks only",
    );
  });
  it.each([
    ["available", "Your watchlist is empty"],
    ["stale", "older catalog"],
    ["unavailable", "saved watchlist is unavailable"],
    ["reconciling", "reconciliation is in progress"],
  ] as const)(
    "gives an honest %s state and existing workspace destinations",
    (status, message) => {
      const input = props({ watchlist: { status, members: [] } });
      const html = renderToStaticMarkup(<MarketBoardPicker {...input} />);
      expect(html).toContain(message);
      expect(html).toContain('href="/discover?view=watchlist"');
      expect(html).toContain('href="/discover"');
      expect(inputs(input)).toHaveLength(0);
    },
  );
  it("renders controlled mode buttons without resetting the parent's selected identities", () => {
    const input = props({
      draft: { kind: "watchlist", members: [member("ALFA")] },
    });
    const buttons = nodes(MarketBoardPicker(input)).filter(
      (node) => node.type === "button",
    );
    expect(buttons[0]!.props["aria-pressed"]).toBe(false);
    expect(buttons[1]!.props["aria-pressed"]).toBe(true);
    (buttons[0]!.props.onClick as () => void)();
    expect(input.onModeChange).toHaveBeenCalledExactlyOnceWith("default");
    expect(input.onToggleWatchlist).not.toHaveBeenCalled();
    expect(inputs(input)[1]!.props.checked).toBe(true);
  });
  it("disables the complete picker during the shared request", () => {
    const view = MarketBoardPicker(props({ disabled: true }));
    expect(view.type).toBe("fieldset");
    expect(nodes(view)[0]?.props.disabled).toBe(true);
  });
});
