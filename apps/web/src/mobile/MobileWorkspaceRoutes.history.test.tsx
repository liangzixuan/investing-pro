import { renderToStaticMarkup } from "react-dom/server";
import {
  createMemoryRouter,
  RouterProvider,
  type NavigateOptions,
  type To,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalWorkspaceClientProps } from "../features/workspace/PersonalWorkspaceClient";
import {
  WorkspaceLink,
  WorkspaceNavigationProvider,
} from "../features/workspace/WorkspaceNavigation";

const observed = vi.hoisted(() => ({
  router: null as ReturnType<typeof createMemoryRouter> | null,
  props: null as PersonalWorkspaceClientProps | null,
  pending: null as Promise<void> | null,
}));

// Server rendering does not run the layout effect that activates useNavigate.
// Forward only that hook to the real router; its location and history stay real.
vi.mock("react-router", async (original) => ({
  ...(await original()),
  useNavigate: () => (to: To | number, options?: NavigateOptions) => {
    if (observed.router === null) throw new Error("Memory router is not ready");
    observed.pending =
      typeof to === "number"
        ? observed.router.navigate(to)
        : observed.router.navigate(to, options);
    return observed.pending;
  },
}));
vi.mock("../features/workspace/PersonalWorkspaceClient", () => ({
  PersonalWorkspaceClient: (props: PersonalWorkspaceClientProps) => {
    observed.props = props;
    return (
      <WorkspaceNavigationProvider navigation={props.navigation}>
        <WorkspaceLink href="/markets">Home</WorkspaceLink>
        <WorkspaceLink href="/discover?view=watchlist">
          My Watchlist
        </WorkspaceLink>
      </WorkspaceNavigationProvider>
    );
  },
}));

import { MobileWorkspaceRoutes } from "./MobileWorkspaceRoutes";

beforeEach(() => {
  observed.props = null;
  observed.pending = null;
});
afterEach(() => {
  observed.router?.dispose();
  observed.router = null;
});

function renderBridge() {
  if (observed.router === null) throw new Error("Memory router is not ready");
  return renderToStaticMarkup(<RouterProvider router={observed.router} />);
}

function capturedNavigation(): Promise<void> {
  const pending = observed.pending;
  if (pending === null)
    throw new Error("Workspace navigation was not captured");
  return pending;
}

async function followWorkspaceLink(path: string) {
  renderBridge();
  const navigation = observed.props?.navigation;
  if (navigation === undefined)
    throw new Error("Workspace bridge was not rendered");
  observed.pending = null;
  navigation.navigate(path);
  await capturedNavigation();
}

describe("disconnected workspace history", () => {
  it("returns to Watchlist after Home is activated twice", async () => {
    const router = createMemoryRouter(
      [{ path: "*", element: <MobileWorkspaceRoutes /> }],
      { initialEntries: ["/markets", "/discover?view=watchlist"] },
    );
    observed.router = router;
    expect(renderBridge()).toContain('href="#/markets"');

    await followWorkspaceLink("/markets");
    expect(router.state.historyAction).toBe("PUSH");
    expect(router.state.location.pathname).toBe("/markets");

    await followWorkspaceLink("/markets");
    const repeatedAction = router.state.historyAction;
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/discover");
    expect(router.state.location.search).toBe("?view=watchlist");
    expect(repeatedAction).toBe("REPLACE");
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/markets");
  });

  it("keeps distinct destinations and query views in Back history", async () => {
    const router = createMemoryRouter(
      [{ path: "*", element: <MobileWorkspaceRoutes /> }],
      { initialEntries: ["/markets"] },
    );
    observed.router = router;

    await followWorkspaceLink("/discover");
    expect(router.state.historyAction).toBe("PUSH");
    await followWorkspaceLink("/discover?view=watchlist");
    expect(router.state.historyAction).toBe("PUSH");
    expect(router.state.location.search).toBe("?view=watchlist");
    await followWorkspaceLink("/discover?view=watchlist");
    const repeatedAction = router.state.historyAction;

    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/discover");
    expect(router.state.location.search).toBe("");
    expect(repeatedAction).toBe("REPLACE");
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe("/markets");
  });
});
