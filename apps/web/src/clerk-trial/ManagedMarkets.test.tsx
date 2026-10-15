import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ManagedMarkets } from "./ManagedMarkets";
import { ManagedMarkets as Model } from "./managed-markets";
import { ManagedEodAccess } from "./managed-eod-access";
import type { ManagedApi } from "./managed-api";

describe("managed Markets section navigation seam", () => {
  it("places optional navigation between the toolbar and scope without loading the board", () => {
    const resolve = vi.fn<ManagedApi["resolve"]>();
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const model = new Model(
      { resolve },
      new ManagedEodAccess(read),
      vi.fn(),
      vi.fn(),
    );
    const props = {
      navigationPending: false,
      model,
      onResearch: vi.fn(),
      onWatchlist: vi.fn(),
    };
    const baseline = renderToStaticMarkup(<ManagedMarkets {...props} />);
    const navigation = <nav aria-label="On Markets">Section links</nav>;
    const html = renderToStaticMarkup(
      <ManagedMarkets
        {...props}
        headingRef={createRef<HTMLHeadingElement>()}
        sectionNavigation={navigation}
      />,
    );
    const slot = renderToStaticMarkup(navigation);
    expect(html).toContain(
      '<h2 id="managed-markets-heading" tabindex="-1">Markets</h2>',
    );
    expect(html).toContain(`</div>${slot}<p class="managed-markets-scope">`);
    expect(html.replace(slot, "")).toBe(baseline);
    expect(resolve).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(props.onResearch).not.toHaveBeenCalled();
    expect(props.onWatchlist).not.toHaveBeenCalled();
  });
});
