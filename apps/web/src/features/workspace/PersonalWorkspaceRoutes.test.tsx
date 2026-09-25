import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketsHomeProps } from "../markets/MarketsHome";
import type { SecurityDiscoveryWorkspaceProps } from "../research/SecurityDiscoveryWorkspace";

const navigation = vi.hoisted(() => ({
  pathname: "/markets",
  view: null as string | null,
  push: vi.fn(),
}));
const components = vi.hoisted(() => ({
  Workspace: () => null,
  Markets: () => null,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => ({ get: () => navigation.view }),
  useRouter: () => ({ push: navigation.push }),
}));
vi.mock("../research/SecurityDiscoveryWorkspace", () => ({
  SecurityDiscoveryWorkspace: components.Workspace,
}));
vi.mock("../markets/MarketsHome", () => ({ MarketsHome: components.Markets }));
import { PersonalWorkspaceRoutes } from "./PersonalWorkspaceRoutes";

function render() {
  return PersonalWorkspaceRoutes({
    authMode: "local",
  }) as ReactElement<SecurityDiscoveryWorkspaceProps>;
}
beforeEach(() => {
  navigation.pathname = "/markets";
  navigation.view = null;
  navigation.push.mockClear();
});
describe("persistent personal workspace route bridge", () => {
  it("retains the same controller type and key across Markets, tasks and company paths", () => {
    const markets = render();
    expect(markets.props.route).toEqual({ kind: "markets" });
    navigation.pathname = "/discover";
    navigation.view = "watchlist";
    const watchlist = render();
    expect(watchlist.props.route).toEqual({
      kind: "discover",
      task: "watchlist",
    });
    navigation.pathname = "/company/listing%3Aone";
    const company = render();
    expect(company.props.route).toEqual({
      kind: "company",
      listingId: "listing:one",
    });
    for (const view of [markets, watchlist, company]) {
      expect(view.type).toBe(components.Workspace);
      expect(view.key).toBeNull();
      expect(view.props.authMode).toBe("local");
    }
  });
  it("leaves focus placement to the shared workspace instead of scrolling the document on navigation", () => {
    render().props.onNavigate?.("/company/listing%3Aone");
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/company/listing%3Aone",
      { scroll: false },
    );
  });
  it("forwards the same guarded Markets facade to the mounted view", () => {
    const props: MarketsHomeProps = {
      active: false,
      enabled: true,
      catalogSnapshotSha256: "sha256:" + "a".repeat(64),
      sessionKey: 5,
      providerStatus: null,
      isCurrent: () => true,
      onActivityStart: () => () => true,
      onSessionUnavailable: vi.fn(),
      onOpenCompany: vi.fn(),
    };
    const view = render().props.renderMarkets?.(
      props,
    ) as ReactElement<MarketsHomeProps>;
    expect(view.type).toBe(components.Markets);
    expect(view.props).toEqual(props);
    expect(view.props.isCurrent).toBe(props.isCurrent);
    expect(view.props.onOpenCompany).toBe(props.onOpenCompany);
  });
  it("passes an invalid direct URL to the existing unavailable view without inventing a listing", () => {
    navigation.pathname = "/company/UPPERCASE";
    expect(render().props.route).toEqual({ kind: "invalid" });
  });
});
