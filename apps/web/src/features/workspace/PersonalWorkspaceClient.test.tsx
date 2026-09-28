import type { ComponentProps, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MarketsHomeProps } from "../markets/MarketsHome";
import type { SecurityDiscoveryWorkspaceProps } from "../research/SecurityDiscoveryWorkspace";
import type { WorkspaceRoute } from "./workspace-route";

const components = vi.hoisted(() => ({
  Workspace: () => null,
  Markets: () => null,
}));
vi.mock("../research/SecurityDiscoveryWorkspace", () => ({
  SecurityDiscoveryWorkspace: components.Workspace,
}));
vi.mock("../markets/MarketsHome", () => ({ MarketsHome: components.Markets }));
import { PersonalWorkspaceClient } from "./PersonalWorkspaceClient";
import { WorkspaceNavigationProvider } from "./WorkspaceNavigation";

function render(
  route: WorkspaceRoute,
  authMode: "account" | "bootstrap" | "local" = "account",
) {
  const navigation = { href: (path: string) => `#${path}`, navigate: vi.fn() };
  const provider = PersonalWorkspaceClient({
    route,
    authMode,
    navigation,
  }) as ReactElement<ComponentProps<typeof WorkspaceNavigationProvider>>;
  return {
    provider,
    navigation,
    workspace: provider.props
      .children as ReactElement<SecurityDiscoveryWorkspaceProps>,
  };
}

describe("shared personal workspace client", () => {
  it("keeps one unkeyed controller for Markets, task and exact-company routes", () => {
    const routes: WorkspaceRoute[] = [
      { kind: "markets" },
      { kind: "discover", task: "watchlist" },
      { kind: "company", listingId: "listing:one" },
      { kind: "invalid" },
    ];
    for (const route of routes) {
      const { provider, workspace, navigation } = render(route);
      expect(provider.type).toBe(WorkspaceNavigationProvider);
      expect(provider.key).toBeNull();
      expect(provider.props.navigation).toBe(navigation);
      expect(workspace.type).toBe(components.Workspace);
      expect(workspace.key).toBeNull();
      expect(workspace.props.route).toBe(route);
      expect(navigation.navigate).not.toHaveBeenCalled();
    }
  });

  it.each(["account", "bootstrap", "local"] as const)(
    "preserves the caller's explicit %s access mode",
    (authMode) => {
      expect(
        render({ kind: "markets" }, authMode).workspace.props.authMode,
      ).toBe(authMode);
    },
  );

  it("hands exact canonical navigation to the platform without decoding identity", () => {
    const { workspace, navigation } = render({ kind: "markets" });
    workspace.props.onNavigate?.("/company/listing%3Aone");
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/company/listing%3Aone",
    );
  });

  it("forwards the same guarded Markets facade to the shared view", () => {
    const props: MarketsHomeProps = {
      active: false,
      enabled: true,
      catalogSnapshotSha256: "sha256:" + "a".repeat(64),
      sessionKey: 5,
      providerStatus: null,
      watchlist: { status: "unavailable", members: [] },
      isWatchlistCurrent: () => false,
      isCurrent: () => true,
      isActive: () => false,
      onActivityStart: () => () => true,
      onSessionUnavailable: vi.fn(),
      onOpenCompany: vi.fn(),
    };
    const { workspace } = render({ kind: "markets" });
    const view = workspace.props.renderMarkets?.(
      props,
    ) as ReactElement<MarketsHomeProps>;
    expect(view.type).toBe(components.Markets);
    expect(view.props).toEqual(props);
    expect(view.props.isCurrent).toBe(props.isCurrent);
    expect(view.props.onOpenCompany).toBe(props.onOpenCompany);
  });
});
