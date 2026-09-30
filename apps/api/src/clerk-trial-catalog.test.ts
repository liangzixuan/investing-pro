import { describe, expect, it } from "vitest";

import {
  CLERK_TRIAL_CATALOG,
  fromClerkTrialPayload,
  toClerkTrialPayload,
} from "./clerk-trial-catalog";

describe("invented Clerk trial catalog", () => {
  it("admits exactly two invented securities without acquiring market data", () => {
    expect(CLERK_TRIAL_CATALOG.coverage).toMatchObject({
      activeEligibleSecurities: 2,
      activeListings: 2,
      basis: "synthetic_engineering_only_not_real_universe",
    });
  });
  it.each(
    [[], ["DEMO_A"], ["DEMO_B"], ["DEMO_A", "DEMO_B"]].map((selected) => ({
      selected,
    })),
  )("round trips canonical membership %j", ({ selected }) => {
    const note = selected.includes("DEMO_A") ? "Invented note" : "";
    expect(fromClerkTrialPayload(toClerkTrialPayload(selected, note))).toEqual({
      selected,
      note,
    });
  });
  it.each([
    { selected: ["DEMO_B", "DEMO_A"], note: "" },
    { selected: ["DEMO_A", "DEMO_A"], note: "" },
    { selected: ["AAPL"], note: "" },
    { selected: [], note: "Orphan note" },
    { selected: ["DEMO_B"], note: "Wrong member" },
    { selected: ["DEMO_A"], note: " untrimmed" },
    { selected: ["DEMO_A"], note: "e\u0301" },
    { selected: ["DEMO_A"], note: "line\nbreak" },
    { selected: ["DEMO_A"], note: "x".repeat(1001) },
  ])("rejects invalid trial content %#", ({ selected, note }) => {
    expect(() => toClerkTrialPayload(selected, note)).toThrow(
      "invalid_request",
    );
  });
  it("rejects changed snapshot, exact identity and wrong-member notes on reads", () => {
    const payload = toClerkTrialPayload(["DEMO_A", "DEMO_B"], "Saved");
    expect(() =>
      fromClerkTrialPayload({
        ...payload,
        snapshotSha256: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow("invalid_response");
    expect(() =>
      fromClerkTrialPayload({
        ...payload,
        memberships: payload.memberships.map((m) => ({
          ...m,
          issuerName: "Substituted",
        })),
      }),
    ).toThrow("invalid_response");
    expect(() =>
      fromClerkTrialPayload({
        ...payload,
        memberships: payload.memberships.map((m) => ({
          ...m,
          note: "Misplaced",
        })),
      }),
    ).toThrow("invalid_response");
  });
});
