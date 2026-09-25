import { describe, expect, it } from "vitest";
import {
  companyHref,
  parseWorkspaceRoute,
  workspaceTaskHref,
} from "./workspace-route";
describe("workspace routes", () => {
  it.each(["discover", "screens", "watchlist", "portfolio", "updates"])(
    "retains the %s task in a direct URL",
    (task) => {
      const href = workspaceTaskHref(task as "discover");
      const url = new URL(href, "http://localhost");
      expect(
        parseWorkspaceRoute(url.pathname, url.searchParams.get("view")),
      ).toEqual({ kind: "discover", task });
    },
  );
  it("uses the exact opaque listing ID instead of deriving a symbol", () => {
    expect(parseWorkspaceRoute(companyHref("listing:opaque-1"), null)).toEqual({
      kind: "company",
      listingId: "listing:opaque-1",
    });
    expect(parseWorkspaceRoute("/markets", null)).toEqual({ kind: "markets" });
  });
  it.each([
    "/company/",
    "/company/a/b",
    "/company/%2Fetc",
    "/company/%",
    "/company/%20ABC",
    "/outside",
  ])("refuses invalid route %s", (path) =>
    expect(parseWorkspaceRoute(path, null)).toEqual({ kind: "invalid" }),
  );
  it.each([
    "/company/ABCD",
    "/company/ab",
    "/company/" + "a".repeat(129),
    "/company/%61bc",
    "/company/listing%3aone",
    "/company/listing:one",
  ])("rejects noncanonical catalog ID %s", (path) =>
    expect(parseWorkspaceRoute(path, null)).toEqual({ kind: "invalid" }),
  );
  it("accepts the catalog maximum ID length", () =>
    expect(parseWorkspaceRoute("/company/" + "a".repeat(128), null).kind).toBe(
      "company",
    ));
  it("refuses unknown workspace task names", () =>
    expect(parseWorkspaceRoute("/discover", "unknown")).toEqual({
      kind: "invalid",
    }));
});
