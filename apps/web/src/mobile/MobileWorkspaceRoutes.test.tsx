import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalWorkspaceClientProps } from "../features/workspace/PersonalWorkspaceClient";

const observed = vi.hoisted(() => ({
  props: null as PersonalWorkspaceClientProps | null,
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
});
describe("mobile workspace route bridge", () => {
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
