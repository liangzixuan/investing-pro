import { describe, expect, it } from "vitest";
import {
  isManagedCompanyListingId,
  managedCompanyHref,
  parseManagedCompanyRoute,
} from "./managed-company-route";

describe("managed company query routes", () => {
  it.each(["listing-zero", "listing:goog.xnas", "listing:googl.xnas"])(
    "round-trips the exact canonical listing %s in both sections",
    (listingId) => {
      for (const section of ["eod", "annual"] as const) {
        const href = managedCompanyHref(listingId, section);
        const url = new URL(href, "https://example.test");
        expect(url.pathname).toBe("/");
        expect(url.hash).toBe("");
        expect(url.searchParams.get("section")).toBe(
          section === "eod" ? "price" : "annual",
        );
        expect(parseManagedCompanyRoute(url.searchParams)).toEqual({
          kind: "company",
          listingId,
          section,
        });
      }
    },
  );
  it.each(["", "unrelated=retained-by-router"])(
    "has no company destination for %s",
    (search) => {
      expect(parseManagedCompanyRoute(new URLSearchParams(search))).toEqual({
        kind: "none",
      });
    },
  );
  it.each([
    "company=listing-zero",
    "section=price",
    "company=&section=price",
    "company=GOOG&section=price",
    "company=ab&section=price",
    "company=listing-zero&section=eod",
    "company=listing-zero&section=PRICE",
    "company=listing-zero&company=listing-zero&section=price",
    "company=listing-zero&section=price&section=annual",
    "company=listing-zero&section=price&cik=0000000001",
    "company=listing%2Fzero&section=price",
    "company=listing%00zero&section=price",
    "company=listing%0Azero&section=price",
    "company=listing%C3%A9&section=price",
    "company=listing+zero&section=price",
    "company=listing%252Dzero&section=price",
    `company=${"a".repeat(129)}&section=price`,
  ])("refuses ambiguous or malformed query %s", (search) => {
    expect(parseManagedCompanyRoute(new URLSearchParams(search))).toEqual({
      kind: "invalid",
    });
  });
  it("refuses a decoded replacement character in a listing ID", () => {
    const parameters = new URLSearchParams({
      company: "listing\uFFFD",
      section: "price",
    });
    expect(parseManagedCompanyRoute(parameters)).toEqual({ kind: "invalid" });
  });
  it("bounds the canonical listing and refuses serializing noncanonical identity", () => {
    expect(isManagedCompanyListingId("a".repeat(128))).toBe(true);
    expect(isManagedCompanyListingId("a".repeat(129))).toBe(false);
    expect(isManagedCompanyListingId("listing\uD800")).toBe(false);
    expect(() => managedCompanyHref("GOOG", "eod")).toThrow(
      "Invalid company destination.",
    );
  });
  it("normalizes alternate URL encodings while retaining the exact decoded identity", () => {
    const parsed = parseManagedCompanyRoute(
      new URLSearchParams("company=%6cisting%3azero&section=%70rice"),
    );
    expect(parsed).toEqual({
      kind: "company",
      listingId: "listing:zero",
      section: "eod",
    });
    expect(managedCompanyHref("listing:zero", "eod")).toBe(
      "/?company=listing%3Azero&section=price",
    );
  });
});
