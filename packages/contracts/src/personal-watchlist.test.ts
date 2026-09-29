import { describe, expect, it } from "vitest";

import {
  isMainWatchlistPayload,
  membershipMatchesResult,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "./index";

function membership(listingId = "listing-a"): WatchlistMembership {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: "issuer-a",
    issuerName: "Example issuer",
    listingId,
    note: "Review cash flow",
    securityId: "security-a",
    securityName: "Example common stock",
    shareClassId: "class-a",
    shareClassName: "Common",
    symbol: "EXAMPLE",
  };
}

function payload(): MainWatchlistPayload {
  return {
    memberships: [membership()],
    name: "My Watchlist",
    schemaVersion: 1,
    snapshotSha256: `sha256:${"a".repeat(64)}`,
  };
}

describe("shared main watchlist payload", () => {
  it("accepts empty and ordered distinct listings without conflating symbols", () => {
    expect(isMainWatchlistPayload({ ...payload(), memberships: [] })).toBe(
      true,
    );
    const value = {
      ...payload(),
      memberships: [
        membership("listing-b"),
        { ...membership("listing-a"), instrumentType: "adr" },
      ],
    };
    const before = structuredClone(value);
    expect(isMainWatchlistPayload(value)).toBe(true);
    expect(value).toEqual(before);
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [membership(), { ...membership(), symbol: "OTHER" }],
      }),
    ).toBe(false);
  });

  it("retains the 10,000-member limit", () => {
    const memberships = Array.from({ length: 10_000 }, (_, index) =>
      membership(`listing-${String(index)}`),
    );
    expect(isMainWatchlistPayload({ ...payload(), memberships })).toBe(true);
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [...memberships, membership("listing-extra")],
      }),
    ).toBe(false);
  });

  it("rejects missing or extra payload and membership fields", () => {
    for (const key of Object.keys(payload())) {
      const value: Record<string, unknown> = { ...payload() };
      delete value[key];
      expect(isMainWatchlistPayload(value)).toBe(false);
    }
    expect(isMainWatchlistPayload({ ...payload(), profile: "cloud" })).toBe(
      false,
    );
    for (const key of Object.keys(membership())) {
      const member: Record<string, unknown> = { ...membership() };
      delete member[key];
      expect(
        isMainWatchlistPayload({ ...payload(), memberships: [member] }),
      ).toBe(false);
    }
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [{ ...membership(), ownerId: "other" }],
      }),
    ).toBe(false);
  });

  it.each([
    null,
    [],
    { ...payload(), schemaVersion: 2 },
    { ...payload(), name: "Other watchlist" },
    { ...payload(), snapshotSha256: `sha256:${"A".repeat(64)}` },
    { ...payload(), snapshotSha256: `sha256:${"a".repeat(63)}` },
    { ...payload(), snapshotSha256: "" },
    { ...payload(), memberships: {} },
    { ...payload(), memberships: [null] },
  ])("rejects malformed saved shape %#", (value) => {
    expect(isMainWatchlistPayload(value)).toBe(false);
  });

  it.each([
    ["country", "CA"],
    ["exchangeMic", "nasdaq"],
    ["instrumentType", "etf"],
    ["issuerId", "issuer/a"],
    ["listingId", "x".repeat(129)],
    ["securityId", "-security"],
    ["shareClassId", ""],
    ["symbol", "lowercase"],
    ["symbol", "X".repeat(16)],
    ["issuerName", " trimmed"],
    ["securityName", ""],
    ["shareClassName", "Hidden\u200btext"],
  ])("rejects malformed %s %#", (field, value) => {
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [{ ...membership(), [field]: value }],
      }),
    ).toBe(false);
  });

  it("counts display text by code point and preserves its existing normalization", () => {
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [{ ...membership(), issuerName: "😀".repeat(512) }],
      }),
    ).toBe(true);
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [{ ...membership(), issuerName: "😀".repeat(513) }],
      }),
    ).toBe(false);
    expect(
      isMainWatchlistPayload({
        ...payload(),
        memberships: [{ ...membership(), issuerName: "Cafe\u0301" }],
      }),
    ).toBe(true);
  });

  it("accepts empty or bounded NFC notes and never silently rewrites invalid text", () => {
    for (const note of ["", "Café", "😀".repeat(2_000)]) {
      expect(
        isMainWatchlistPayload({
          ...payload(),
          memberships: [{ ...membership(), note }],
        }),
      ).toBe(true);
    }
    for (const note of [
      " leading",
      "trailing ",
      "Cafe\u0301",
      "a\nb",
      "a\u200bb",
      "\ud800",
      "😀".repeat(2_001),
    ]) {
      const value = { ...payload(), memberships: [{ ...membership(), note }] };
      expect(isMainWatchlistPayload(value)).toBe(false);
      expect(value.memberships[0]?.note).toBe(note);
    }
  });
});

describe("shared watchlist catalog identity comparison", () => {
  it("ignores the saved note while requiring the exact listing identity", () => {
    expect(
      membershipMatchesResult(
        { ...membership(), note: "A different saved note" },
        membership(),
      ),
    ).toBe(true);
  });

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)("rejects a changed catalog %s", (field) => {
    const admitted = {
      ...membership(),
      [field]: `${membership()[field]}-changed`,
    };
    expect(membershipMatchesResult(membership(), admitted)).toBe(false);
  });
});
