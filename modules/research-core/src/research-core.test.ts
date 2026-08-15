import { describe, expect, it } from "vitest";

import evidenceFixture from "../../../fixtures/synthetic/v1/evidence.json";

import { evaluateLocalAlert } from "./alerts";
import {
  buildDossier,
  DEFAULT_KNOWN_AT,
  PRE_RESTATEMENT_KNOWN_AT,
} from "./dossier";
import { syntheticFixture } from "./fixture";
import { calculateValuation } from "./valuation";

describe("bitemporal synthetic dossier", () => {
  it("shows the original fact before the restatement and the revised fact afterward", () => {
    const before = buildDossier("SYN1", PRE_RESTATEMENT_KNOWN_AT);
    const after = buildDossier("SYN1", DEFAULT_KNOWN_AT);

    expect(metric(before, "revenue").value).toBe("120.000");
    expect(metric(before, "ebitda_margin").displayValue).toBe("18.0%");
    expect(before?.timeline).toHaveLength(1);

    expect(metric(after, "revenue").value).toBe("116.400");
    expect(metric(after, "ebitda_margin").displayValue).toBe("16.0%");
    expect(after?.timeline).toHaveLength(2);
  });

  it("removes the rights-denied estimate before serialization", () => {
    const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
    const serialized = JSON.stringify(dossier);

    expect(dossier?.omissions.count).toBe(1);
    expect(serialized).not.toContain("restricted_forward_revenue_estimate");
    expect(serialized).not.toContain("135.0");
    expect(serialized).not.toContain("restricted-estimate");
  });

  it("rejects invalid known-at values", () => {
    expect(() => buildDossier("SYN1", "not-a-date")).toThrow(RangeError);
  });

  it("keeps the runtime evidence exactly aligned with the provenance fixture", () => {
    expect(syntheticFixture.evidence).toEqual(evidenceFixture);
  });
});

describe("deterministic valuation", () => {
  const base = {
    baseRevenue: "116.4",
    cash: "24.0",
    debt: "40.0",
    dilutedShares: "25.0",
    annualRevenueGrowthPercent: "10.0",
    targetEbitdaMarginPercent: "20.0",
    discountRatePercent: "10.0",
    exitMultiple: "12.0",
    horizonYears: 5,
  } as const;

  it("reproduces a fixed decimal result", () => {
    const result = calculateValuation(base);
    expect(result.valuePerShare).toBe("10.53");
    expect(result.formulaTrace).toHaveLength(6);
  });

  it("increases when growth rises and decreases when the discount rate rises", () => {
    const baseValue = Number(calculateValuation(base).valuePerShare);
    const higherGrowth = Number(
      calculateValuation({ ...base, annualRevenueGrowthPercent: "15.0" })
        .valuePerShare,
    );
    const higherDiscount = Number(
      calculateValuation({ ...base, discountRatePercent: "15.0" })
        .valuePerShare,
    );
    expect(higherGrowth).toBeGreaterThan(baseValue);
    expect(higherDiscount).toBeLessThan(baseValue);
  });
});

describe("local alert evaluation", () => {
  it("is deterministic and sends nothing externally", () => {
    const rule = {
      schemaVersion: "1.0.0",
      id: "rule.demo.margin",
      instrumentId: "instrument.synthetic.syn1",
      metricKey: "ebitda_margin",
      operator: "below",
      threshold: "17.0",
      createdAt: "2026-08-15T21:00:00Z",
    } as const;
    const first = evaluateLocalAlert(rule, "16.0", "2026-08-15T21:00:00Z");
    const second = evaluateLocalAlert(rule, "16.0", "2026-08-15T21:00:00Z");

    expect(first.triggered).toBe(true);
    expect(first.eventId).toBe(second.eventId);
    expect(first.deliveryMode).toBe("local_demo_only");
  });
});

function metric(dossier: ReturnType<typeof buildDossier>, key: string) {
  const result = dossier?.metrics.find((candidate) => candidate.key === key);
  if (!result) throw new Error(`Missing metric in test: ${key}`);
  return result;
}
