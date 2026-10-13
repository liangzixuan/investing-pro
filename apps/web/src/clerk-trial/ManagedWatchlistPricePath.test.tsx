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

const hooks = vi.hoisted(() => ({ enabled: false, open: false }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (initial: boolean) =>
      hooks.enabled
        ? [
            hooks.open,
            (value: boolean) => {
              hooks.open = value;
            },
          ]
        : actual.useState(initial),
  };
});
afterEach(() => {
  hooks.enabled = false;
  hooks.open = false;
});
const children = (tree: React.ReactElement) =>
  React.Children.toArray(
    (tree.props as { children: React.ReactNode }).children,
  ).filter(React.isValidElement) as React.ReactElement<
    Record<string, unknown>
  >[];

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
    expect(html).toContain("rounded half up to four decimal places");
    expect(html).toContain("no filled gaps");
    expect(html).toContain("split/dividend-adjusted");
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
    first.props.onToggle!({
      currentTarget: { open: true },
    } as React.ToggleEvent<HTMLDetailsElement>);
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
  });
});
