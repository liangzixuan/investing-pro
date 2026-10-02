import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalWorkspaceClientProps } from "../features/workspace/PersonalWorkspaceClient";

const observed = vi.hoisted(() => ({
  props: null as PersonalWorkspaceClientProps | null,
  navigate: vi.fn(),
  exitApp: vi.fn<() => Promise<void>>().mockResolvedValue(),
  onBack: null as
    ((event: { canGoBack: boolean }) => void | Promise<void>) | null,
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useEffect: (effect: () => void) => effect(),
}));
vi.mock("react-router", async (original) => ({
  ...(await original()),
  useNavigate: () => observed.navigate,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "android" },
}));
vi.mock("@capacitor/app", () => ({ App: { exitApp: observed.exitApp } }));
vi.mock("./android-back", () => ({
  bindAndroidBack: (_app: unknown, onBack: typeof observed.onBack) => {
    observed.onBack = onBack;
    return () => {};
  },
}));
vi.mock("../features/workspace/PersonalWorkspaceClient", () => ({
  PersonalWorkspaceClient: (props: PersonalWorkspaceClientProps) => {
    observed.props = props;
    return null;
  },
}));
import { MobileWorkspaceRoutes } from "./MobileWorkspaceRoutes";

beforeEach(() => {
  observed.props = null;
  observed.onBack = null;
  observed.navigate.mockClear();
  observed.exitApp.mockClear();
});
describe("mobile workspace route bridge", () => {
  it("preserves disconnected history navigation and explicit root exit", async () => {
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/markets"]}>
        <MobileWorkspaceRoutes />
      </MemoryRouter>,
    );
    expect(observed.onBack).not.toBeNull();
    await observed.onBack!({ canGoBack: true });
    expect(observed.navigate).toHaveBeenCalledExactlyOnceWith(-1);
    expect(observed.exitApp).not.toHaveBeenCalled();
    await observed.onBack!({ canGoBack: false });
    expect(observed.exitApp).toHaveBeenCalledOnce();
    expect(observed.navigate).toHaveBeenCalledOnce();
  });
  it.each([
    ["/markets", { kind: "markets" }],
    ["/discover?view=watchlist", { kind: "discover", task: "watchlist" }],
    ["/company/listing%3Aone", { kind: "company", listingId: "listing:one" }],
    ["/company/UPPERCASE", { kind: "invalid" }],
  ])(
    "passes %s to the same workspace without local-access authority",
    (path, route) => {
      const markup = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <MobileWorkspaceRoutes />
        </MemoryRouter>,
      );
      expect(observed.props?.route).toEqual(route);
      expect(observed.props?.authMode).toBe("account");
      expect(observed.props?.navigation.href("/company/listing%3Aone")).toBe(
        "#/company/listing%3Aone",
      );
      expect(markup).toContain("Not connected to your computer");
      expect(markup).toContain("cannot load or save your research");
    },
  );
});
