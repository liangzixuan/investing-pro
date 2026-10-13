import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedWatchlistPricePath } from "./ManagedWatchlistPricePath";
import { ManagedWatchlistPricePathChart } from "./ManagedWatchlistPricePathChart";
import { pathFixture, pathRow } from "./watchlist-price-path-fixture";
import {
  createManagedWatchlistComparisonSelection,
  projectManagedWatchlistComparison,
} from "./managed-watchlist-comparison";

const hooks = vi.hoisted(() => ({
  enabled: false,
  open: false,
  updates: [] as boolean[],
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (initial: boolean) =>
      hooks.enabled
        ? [
            hooks.open,
            (value: boolean) => {
              hooks.updates.push(value);
              hooks.open = value;
            },
          ]
        : actual.useState(initial),
  };
});
afterEach(() => {
  hooks.enabled = false;
  hooks.open = false;
  hooks.updates = [];
});
const children = (tree: React.ReactElement) =>
  React.Children.toArray(
    (tree.props as { children: React.ReactNode }).children,
  ).filter(React.isValidElement) as React.ReactElement<
    Record<string, unknown>
  >[];
const methodText =
  "Index = 100 × raw close / starting raw close, rounded half up to four decimal places. " +
  "Chart coordinates are approximate; the vertical scale follows the values. " +
  "Straight lines guide the eye between shared observations; dates are spaced by observation, " +
  "with no filled gaps. Omitted dates can hide declines. This is not a USD price or a " +
  "split/dividend-adjusted return.";

describe("optional watchlist price path view", () => {
  it("starts closed with exact data, full basis explanation and no mounted renderer", () => {
    const { projection } = pathFixture();
    const html = renderToStaticMarkup(
      <ManagedWatchlistPricePath projection={projection} active />,
    );
    expect(html).toContain("Compare raw-price paths");
    expect(html).not.toContain(" open=");
    expect(html).not.toContain("managed-watchlist-price-path-canvas");
    expect(html).toContain(
      "Observed raw closes and rounded index values · 3 shared dates",
    );
    expect(html).toContain("110.0000");
    expect(html).toContain("Class A");
    expect(html).toContain(
      "Index starts at 100; prices are unadjusted. Coordinates are approximate, with a fitted scale and equally spaced observations. Gaps can hide declines; exact values are below.",
    );
    expect(html).toContain(
      '<details class="managed-watchlist-price-path-method"><summary>Chart method and limits</summary><p>' +
        methodText +
        "</p></details>",
    );
    expect(html).toContain(
      'aria-label="Watchlist price path exact data" tabindex="0"',
    );
  });

  it("keeps disclosure and exact-data host positions when inputs disappear, and gates hidden rendering", () => {
    hooks.enabled = true;
    const { projection, prices } = pathFixture();
    const first = ManagedWatchlistPricePath({
      projection,
      active: true,
    }) as React.ReactElement<React.DetailsHTMLAttributes<HTMLDetailsElement>>;
    const outer = { open: true };
    // This hook-based structure test supplies only the target fields it consumes.
    first.props.onToggle!({
      currentTarget: outer,
      target: outer,
    } as unknown as React.ToggleEvent<HTMLDetailsElement>);
    const open = ManagedWatchlistPricePath({ projection, active: true });
    expect(
      children(open).some(
        (child) => child.type === ManagedWatchlistPricePathChart,
      ),
    ).toBe(true);
    const hidden = ManagedWatchlistPricePath({
      projection,
      active: false,
    }) as React.ReactElement<React.DetailsHTMLAttributes<HTMLDetailsElement>>;
    expect(hidden.props.open).toBe(true);
    expect(
      children(hidden).some(
        (child) => child.type === ManagedWatchlistPricePathChart,
      ),
    ).toBe(false);
    const absent = projectManagedWatchlistComparison(
      createManagedWatchlistComparisonSelection(),
      prices,
    );
    const next = ManagedWatchlistPricePath({
      projection: absent,
      active: true,
    }) as React.ReactElement<React.DetailsHTMLAttributes<HTMLDetailsElement>>;
    expect(next.type).toBe(open.type);
    expect(next.props.open).toBe(true);
    expect(children(next)[0]!.type).toBe("summary");
    const method = children(next).at(-2)!;
    expect(method.type).toBe("details");
    expect(method.props).toMatchObject({
      className: "managed-watchlist-price-path-method",
    });
    expect(method.props).not.toHaveProperty("open");
    expect(method.key).toBe(children(open).at(-2)!.key);
    expect(children(next).at(-1)!.props).toMatchObject({
      className: "managed-watchlist-price-path-data",
      role: "region",
      tabIndex: 0,
    });
    expect(
      children(next).some(
        (child) => child.type === ManagedWatchlistPricePathChart,
      ),
    ).toBe(false);
  });

  it("ignores nested method toggle events without changing the outer disclosure", () => {
    hooks.enabled = true;
    hooks.open = true;
    const { projection } = pathFixture();
    const tree = ManagedWatchlistPricePath({
      projection,
      active: true,
    }) as React.ReactElement<React.DetailsHTMLAttributes<HTMLDetailsElement>>;
    const nodes = children(tree);
    const nested = nodes.at(-2)!;
    expect(nested.type).toBe("details");
    expect(nested.props).not.toHaveProperty("onToggle");
    const outer = { open: true };
    tree.props.onToggle!({
      currentTarget: outer,
      target: { open: false },
    } as unknown as React.ToggleEvent<HTMLDetailsElement>);
    expect(hooks.open).toBe(true);
    expect(hooks.updates).toEqual([]);
    expect(
      nodes.findIndex((child) => child.type === ManagedWatchlistPricePathChart),
    ).toBeLessThan(nodes.indexOf(nested));
  });

  it("keeps exact source strings and unsafe rounded values in the table", () => {
    const { projection } = pathFixture([
      pathRow("ALFA", ["100", "0.00000001", "9".repeat(64)]),
      pathRow("BETA"),
    ]);
    const html = renderToStaticMarkup(
      <ManagedWatchlistPricePath projection={projection} active />,
    );
    expect(html).toContain("0.00000001");
    expect(html).toContain("0.0000");
    expect(html).toContain("9".repeat(64));
    expect(html).toContain(methodText);
    expect(html).toContain("Chart method and limits");
  });
});
