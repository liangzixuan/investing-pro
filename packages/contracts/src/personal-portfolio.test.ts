import { describe, expect, it } from "vitest";

import {
  PERSONAL_PORTFOLIO_LIMITS,
  isPersonalPortfolioIdentity,
  isPersonalPortfolioMoney,
  isPersonalPortfolioPayload,
  isPersonalPortfolioShares,
  type PersonalPortfolioIdentity,
  type PersonalPortfolioPayload,
} from "./personal-portfolio";

function identity(suffix = "a"): PersonalPortfolioIdentity {
  return {
    country: "US",
    exchangeMic: "XNAS",
    instrumentType: "common_stock",
    issuerId: `issuer-${suffix}`,
    issuerName: "Example issuer",
    listingId: `listing-${suffix}`,
    securityId: `security-${suffix}`,
    securityName: "Example common stock",
    shareClassId: `class-${suffix}`,
    shareClassName: "Common",
    symbol: "EXAMPLE",
  };
}

function payload(): PersonalPortfolioPayload {
  return {
    schemaVersion: 1,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    cashUsd: null,
    holdings: [
      {
        identity: identity(),
        shares: "1.250000",
        totalCostBasisUsd: "10.00",
        confirmedOn: "2026-09-09",
      },
    ],
  };
}

describe("personal portfolio contract", () => {
  it("preserves unknown money and accepts bounded fractional holdings", () => {
    expect(isPersonalPortfolioPayload(payload(), "2026-09-09")).toBe(true);
    expect(
      isPersonalPortfolioPayload({
        ...payload(),
        cashUsd: "0.00",
        holdings: [],
      }),
    ).toBe(true);
    expect(
      isPersonalPortfolioPayload({
        ...payload(),
        holdings: [{ ...payload().holdings[0], totalCostBasisUsd: null }],
      }),
    ).toBe(true);
    expect(PERSONAL_PORTFOLIO_LIMITS.holdings).toBe(20);
    expect(PERSONAL_PORTFOLIO_LIMITS.payloadBytes).toBe(262_144);
  });

  it.each(["0.000001", "1", "1.000000", "999999999.999999", "1000000000"])(
    "accepts share quantity %s without binary floating-point rounding",
    (value) => expect(isPersonalPortfolioShares(value)).toBe(true),
  );

  it.each([
    "0",
    "0.000000",
    "1000000000.000001",
    "1000000001",
    "0.0000001",
    "-1",
    "+1",
    "1e3",
    "01",
    ".5",
    "1.",
    "1,000",
    " 1",
    "1 ",
    "NaN",
    "9".repeat(1000),
    1,
    null,
  ])("rejects invalid share quantity %s", (value) => {
    expect(isPersonalPortfolioShares(value)).toBe(false);
  });

  it.each(["0", "0.00", "0.01", "999999999999.99", "1000000000000.00"])(
    "accepts money %s",
    (value) => expect(isPersonalPortfolioMoney(value)).toBe(true),
  );

  it.each(["-0", "-1", "0.001", "1000000000000.01", "1e2", "01", "", null])(
    "rejects invalid money %s",
    (value) => expect(isPersonalPortfolioMoney(value)).toBe(false),
  );

  it("binds a closed identity with catalog field bounds", () => {
    expect(isPersonalPortfolioIdentity(identity())).toBe(true);
    for (const changed of [
      { ...identity(), note: "not a portfolio field" },
      { ...identity(), country: "CA" },
      { ...identity(), instrumentType: "option" },
      { ...identity(), exchangeMic: "nasdaq" },
      { ...identity(), symbol: "TOO-LONG-SYMBOL-X" },
      { ...identity(), issuerId: "x".repeat(129) },
      { ...identity(), issuerName: "x".repeat(513) },
      { ...identity(), issuerName: " Leading space" },
      { ...identity(), securityName: "Hidden\u200bformat" },
      { ...identity(), shareClassName: "\ud800" },
    ]) {
      expect(isPersonalPortfolioIdentity(changed)).toBe(false);
    }
  });

  it("validates calendar dates and rejects future confirmations only when requested", () => {
    const withDate = (confirmedOn: string) => ({
      ...payload(),
      holdings: [{ ...payload().holdings[0], confirmedOn }],
    });
    expect(isPersonalPortfolioPayload(withDate("2024-02-29"))).toBe(true);
    expect(isPersonalPortfolioPayload(withDate("2026-09-10"))).toBe(true);
    expect(
      isPersonalPortfolioPayload(withDate("2026-09-10"), "2026-09-09"),
    ).toBe(false);
    expect(isPersonalPortfolioPayload(payload(), "2026-02-30")).toBe(false);
    for (const date of [
      "2025-02-29",
      "2026-04-31",
      "2026-00-01",
      "2026-9-9",
      "2026-09-09T00:00:00Z",
    ]) {
      expect(isPersonalPortfolioPayload(withDate(date))).toBe(false);
    }
  });

  it("rejects duplicate or excessive holdings and unknown payload fields", () => {
    const holding = payload().holdings[0];
    expect(
      isPersonalPortfolioPayload({
        ...payload(),
        holdings: [holding, holding],
      }),
    ).toBe(false);
    const holdings = Array.from({ length: 20 }, (_, index) => ({
      ...holding,
      identity: identity(String(index)),
    }));
    expect(isPersonalPortfolioPayload({ ...payload(), holdings })).toBe(true);
    expect(
      isPersonalPortfolioPayload({
        ...payload(),
        holdings: [...holdings, { ...holding, identity: identity("extra") }],
      }),
    ).toBe(false);
    expect(
      isPersonalPortfolioPayload({ ...payload(), quote: { price: "1" } }),
    ).toBe(false);
    expect(
      isPersonalPortfolioPayload({
        ...payload(),
        holdings: [{ ...holding, averageCost: "10" }],
      }),
    ).toBe(false);
    expect(
      isPersonalPortfolioPayload({
        ...payload(),
        snapshotSha256: "sha256:bad",
      }),
    ).toBe(false);
    expect(isPersonalPortfolioPayload({ ...payload(), currency: "EUR" })).toBe(
      false,
    );
  });

  it("rejects accessor and symbol fields instead of accepting hidden payload content", () => {
    const candidate = { ...payload() };
    Object.defineProperty(candidate, "cashUsd", { get: () => "0" });
    expect(isPersonalPortfolioPayload(candidate)).toBe(false);
    expect(
      isPersonalPortfolioPayload({ ...payload(), [Symbol("hidden")]: "value" }),
    ).toBe(false);
  });
});
