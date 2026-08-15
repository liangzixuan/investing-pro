import { describe, expect, it } from "vitest";

import evidenceFixture from "../../../fixtures/synthetic/v1/evidence.json";

import { evaluateLocalAlert } from "./alerts";
import {
  buildDossier,
  composeDossier,
  DEFAULT_KNOWN_AT,
  GetDossier,
  getEvidencePassport,
  getEvidencePassportFromSnapshot,
  PRE_RESTATEMENT_KNOWN_AT,
} from "./dossier";
import { syntheticFixture } from "./fixture";
import { getPolicy, isRightsAllowed } from "./rights";
import { calculateValuation } from "./valuation";

describe("as-known synthetic dossier", () => {
  it("shows the original fact before the restatement and the revised fact afterward", () => {
    const before = buildDossier("SYN1", PRE_RESTATEMENT_KNOWN_AT);
    const after = buildDossier("SYN1", DEFAULT_KNOWN_AT);

    expect(metric(before, "revenue").value).toBe("120.000");
    expect(metric(before, "ebitda_margin").displayValue).toBe("18.0%");
    expect(before?.timeline).toHaveLength(1);

    expect(metric(after, "revenue").value).toBe("116.400");
    expect(metric(after, "ebitda_margin").displayValue).toBe("16.0%");
    expect(after?.timeline).toHaveLength(2);
    expect(
      before?.history.map(({ period, revenue, ebitda }) => ({
        period,
        revenue,
        ebitda,
      })),
    ).toEqual([
      { period: "2022", revenue: "74.0", ebitda: "10.4" },
      { period: "2023", revenue: "86.0", ebitda: "13.8" },
      { period: "2024", revenue: "100.0", ebitda: "16.5" },
      { period: "2025", revenue: "120.0", ebitda: "21.6" },
    ]);
    expect(after?.history.at(-1)).toMatchObject({
      period: "2025",
      revenue: "116.4",
      ebitda: "18.624",
    });
    expect(after?.evidence.map((evidence) => evidence.id)).toEqual([
      "evidence.synthetic.history",
      "evidence.synthetic.2024-report",
      "evidence.synthetic.2025-original",
      "evidence.synthetic.2025-restated",
      "evidence.synthetic.balance-sheet",
      "evidence.synthetic.share-record",
      "evidence.synthetic.price",
    ]);
  });

  it("treats public-known and system-recorded intervals as half-open", () => {
    const immediatelyBefore = buildDossier("SYN1", "2026-05-10T11:59:59.999Z");
    const atBoundary = buildDossier("SYN1", "2026-05-10T12:00:00.000Z");

    expect(metric(immediatelyBefore, "revenue").value).toBe("120.000");
    expect(metric(atBoundary, "revenue").value).toBe("116.400");
    expect(immediatelyBefore?.history.at(-1)?.revenue).toBe("120.0");
    expect(atBoundary?.history.at(-1)?.revenue).toBe("116.4");

    const original = syntheticFixture.facts.find(
      (fact) => fact.id === "fact.revenue.2025.original",
    );
    expect(original).toMatchObject({
      reportingPeriodEnd: "2025-12-31",
      publicKnownFrom: "2026-02-20T14:30:00Z",
      publicKnownTo: "2026-05-10T12:00:00Z",
      systemRecordedFrom: "2026-02-20T14:30:00Z",
      systemRecordedTo: "2026-05-10T12:00:00Z",
      sourceAvailableAt: "2026-02-20T14:30:00Z",
    });
  });

  it("removes the rights-denied estimate before serialization", () => {
    const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
    const serialized = JSON.stringify(dossier);

    expect(dossier?.omissions).toMatchObject({
      hasOmissions: true,
      count: 1,
    });
    expect(serialized).not.toContain("restricted_forward_revenue_estimate");
    expect(serialized).not.toContain("135.0");
    expect(serialized).not.toContain("restricted-estimate");
  });

  it("rejects invalid known-at values", () => {
    expect(() => buildDossier("SYN1", "not-a-date")).toThrow(RangeError);
    expect(() => buildDossier("SYN1", "2026-02-31T12:00:00Z")).toThrow(
      RangeError,
    );
    expect(() => buildDossier("SYN1", "2026-08-15T21:00:00.001Z")).toThrow(
      /snapshot\.generatedAt/,
    );
  });

  it("keeps the runtime evidence exactly aligned with the provenance fixture", () => {
    expect(syntheticFixture.evidence).toEqual(evidenceFixture);
  });

  it.each([
    ["data mode", () => ({ ...syntheticFixture, dataMode: "live" })],
    [
      "instrument marker",
      () => ({
        ...syntheticFixture,
        instrument: { ...syntheticFixture.instrument, isSynthetic: false },
      }),
    ],
    [
      "policy classification",
      () => ({
        ...syntheticFixture,
        rightsPolicies: syntheticFixture.rightsPolicies.map((policy, index) =>
          index === 0 ? { ...policy, classification: "licensed" } : policy,
        ),
      }),
    ],
    [
      "evidence marker",
      () => ({
        ...syntheticFixture,
        evidence: syntheticFixture.evidence.map((evidence, index) =>
          index === 0 ? { ...evidence, synthetic: false } : evidence,
        ),
      }),
    ],
    [
      "evidence binding marker",
      () => ({
        ...syntheticFixture,
        evidenceBindings: syntheticFixture.evidenceBindings.map(
          (binding, index) =>
            index === 0 ? { ...binding, synthetic: false } : binding,
        ),
      }),
    ],
    [
      "historical point",
      () => ({
        ...syntheticFixture,
        historicalPoints: syntheticFixture.historicalPoints.map(
          (point, index) =>
            index === 0 ? { ...point, synthetic: false } : point,
        ),
      }),
    ],
    [
      "timeline event",
      () => ({
        ...syntheticFixture,
        timelineEvents: syntheticFixture.timelineEvents.map((event, index) =>
          index === 0 ? { ...event, synthetic: false } : event,
        ),
      }),
    ],
    [
      "empty historical evidence",
      () => ({
        ...syntheticFixture,
        historicalPoints: syntheticFixture.historicalPoints.map(
          (point, index) =>
            index === 0 ? { ...point, evidenceIds: [] } : point,
        ),
      }),
    ],
    [
      "duplicate timeline evidence",
      () => ({
        ...syntheticFixture,
        timelineEvents: syntheticFixture.timelineEvents.map((event, index) =>
          index === 0
            ? {
                ...event,
                evidenceIds: [event.evidenceIds[0]!, event.evidenceIds[0]!],
              }
            : event,
        ),
      }),
    ],
  ] as const)("rejects a runtime-tampered synthetic %s", (_label, snapshot) => {
    expect(() => composeDossier(snapshot() as never, DEFAULT_KNOWN_AT)).toThrow(
      /synthetic/i,
    );
  });

  it("canonicalizes supplied fact, evidence, history, timeline, and policy ordering", () => {
    const expected = composeDossier(syntheticFixture, DEFAULT_KNOWN_AT);
    const reordered = composeDossier(
      {
        ...syntheticFixture,
        rightsPolicies: [...syntheticFixture.rightsPolicies].reverse(),
        facts: [...syntheticFixture.facts].reverse(),
        evidence: [...syntheticFixture.evidence].reverse(),
        evidenceBindings: [...syntheticFixture.evidenceBindings].reverse(),
        historicalPoints: [...syntheticFixture.historicalPoints].reverse(),
        timelineEvents: [...syntheticFixture.timelineEvents].reverse(),
      },
      DEFAULT_KNOWN_AT,
    );

    expect(reordered).toEqual(expected);
    expect(JSON.stringify(reordered)).toBe(JSON.stringify(expected));
  });

  it("fails closed when an active timeline identifier is duplicated", () => {
    const [event] = syntheticFixture.timelineEvents;
    expect(event).toBeDefined();

    expect(() =>
      composeDossier(
        {
          ...syntheticFixture,
          timelineEvents: [...syntheticFixture.timelineEvents, { ...event! }],
        },
        DEFAULT_KNOWN_AT,
      ),
    ).toThrow(/ambiguous timeline event identifier/i);
  });

  it("fails closed instead of serializing an authorized malformed history value", () => {
    expect(() =>
      composeDossier(
        {
          ...syntheticFixture,
          historicalPoints: syntheticFixture.historicalPoints.map(
            (point, index) =>
              index === 0 ? { ...point, revenue: "not-a-decimal" } : point,
          ),
        },
        DEFAULT_KNOWN_AT,
      ),
    ).toThrow();
  });

  it("projects no history or timeline records that the snapshot did not supply", () => {
    const dossier = composeDossier(
      {
        ...syntheticFixture,
        historicalPoints: [],
        timelineEvents: [],
      },
      DEFAULT_KNOWN_AT,
    );

    expect(dossier.history).toEqual([]);
    expect(dossier.timeline).toEqual([]);
    expect(dossier.evidence.map((evidence) => evidence.id)).not.toContain(
      "evidence.synthetic.history",
    );
    expect(dossier.evidence.map((evidence) => evidence.id)).not.toContain(
      "evidence.synthetic.2025-original",
    );
  });

  it("scopes current facts and evidence checks to the supplied snapshot", () => {
    const isolatedSnapshot = {
      ...syntheticFixture,
      instrument: {
        ...syntheticFixture.instrument,
        id: "instrument.synthetic.isolated",
        symbol: "ISO1",
        name: "Isolated Snapshot Company",
      },
      facts: syntheticFixture.facts.map((fact) =>
        fact.key === "synthetic_price"
          ? {
              ...fact,
              instrumentId: "instrument.synthetic.isolated",
              rightsPolicyVersion: "missing-version",
            }
          : {
              ...fact,
              instrumentId: "instrument.synthetic.isolated",
            },
      ),
      evidence: syntheticFixture.evidence.map((evidence) =>
        evidence.id === "evidence.synthetic.price"
          ? { ...evidence, rightsPolicyVersion: "missing-version" }
          : evidence,
      ),
      evidenceBindings: syntheticFixture.evidenceBindings.map((binding) => ({
        ...binding,
        instrumentId: "instrument.synthetic.isolated",
      })),
    };

    const dossier = composeDossier(isolatedSnapshot, DEFAULT_KNOWN_AT);

    expect(dossier.instrument.symbol).toBe("ISO1");
    expect(dossier.instrument.name).toBe("Isolated Snapshot Company");
    expect(dossier.metrics.some((item) => item.key === "synthetic_price")).toBe(
      false,
    );
    expect(dossier.omissions).toMatchObject({
      hasOmissions: true,
      count: 2,
    });
    expect(
      getEvidencePassportFromSnapshot(
        isolatedSnapshot,
        "evidence.synthetic.price",
      ),
    ).toBeNull();
    expect(getEvidencePassport("evidence.synthetic.price")).not.toBeNull();
  });

  it("does not inherit SYN1 research records when a second symbol supplies only foreign records", () => {
    const secondSymbol = secondSymbolSnapshot();
    const foreignRecordsSnapshot = {
      ...secondSymbol,
      evidence: [...secondSymbol.evidence, ...syntheticFixture.evidence],
      historicalPoints: syntheticFixture.historicalPoints,
      timelineEvents: syntheticFixture.timelineEvents,
    };
    const dossier = composeDossier(foreignRecordsSnapshot, DEFAULT_KNOWN_AT);

    expect(dossier.instrument.symbol).toBe("SYN2");
    expect(dossier.history).toEqual([]);
    expect(dossier.timeline).toEqual([]);
    expect(
      dossier.evidence.every((evidence) =>
        evidence.id.startsWith("evidence.synthetic.syn2."),
      ),
    ).toBe(true);
    expect(JSON.stringify(dossier.evidence)).not.toContain("SYN1");
    expect(
      getEvidencePassportFromSnapshot(
        foreignRecordsSnapshot,
        "evidence.synthetic.history",
      ),
    ).toBeNull();
    expect(
      getEvidencePassportFromSnapshot(
        foreignRecordsSnapshot,
        "evidence.synthetic.2025-original",
      ),
    ).toBeNull();
  });

  it("selects only SYN2 history, events, and evidence from a mixed-instrument snapshot", () => {
    const secondSymbol = secondSymbolSnapshot();
    const mixedSnapshot = {
      ...secondSymbol,
      facts: [...syntheticFixture.facts, ...secondSymbol.facts],
      evidence: [...syntheticFixture.evidence, ...secondSymbol.evidence],
      evidenceBindings: [
        ...syntheticFixture.evidenceBindings,
        ...secondSymbol.evidenceBindings,
      ],
      historicalPoints: [
        ...syntheticFixture.historicalPoints,
        ...secondSymbol.historicalPoints,
      ],
      timelineEvents: [
        ...syntheticFixture.timelineEvents,
        ...secondSymbol.timelineEvents,
      ],
    };
    const dossier = composeDossier(mixedSnapshot, DEFAULT_KNOWN_AT);

    expect(dossier.history.map((point) => point.period)).toEqual([
      "2022",
      "2023",
      "2024",
      "2025",
    ]);
    expect(dossier.history.map((point) => point.revenue)).toEqual([
      "200.0",
      "201.0",
      "202.0",
      "204.0",
    ]);
    expect(dossier.timeline.map((event) => event.id)).toEqual([
      "timeline.syn2.original-filing",
      "timeline.syn2.restatement",
    ]);
    expect(
      dossier.evidence.every((evidence) =>
        evidence.id.startsWith("evidence.synthetic.syn2."),
      ),
    ).toBe(true);
    expect(JSON.stringify(dossier)).not.toContain("SYN1-");
    expect(
      getEvidencePassportFromSnapshot(
        mixedSnapshot,
        "evidence.synthetic.price",
      ),
    ).toBeNull();
  });

  it("denies SYN2 facts, history, and events that reuse SYN1-only evidence bindings", () => {
    const secondSymbol = secondSymbolSnapshot();
    const snapshot = {
      ...secondSymbol,
      facts: secondSymbol.facts.map((fact) =>
        fact.key === "synthetic_price"
          ? { ...fact, evidenceId: "evidence.synthetic.price" }
          : fact,
      ),
      evidence: [...syntheticFixture.evidence, ...secondSymbol.evidence],
      evidenceBindings: [
        ...syntheticFixture.evidenceBindings,
        ...secondSymbol.evidenceBindings,
      ],
      historicalPoints: secondSymbol.historicalPoints.map((point, index) =>
        index === 0
          ? {
              ...point,
              revenue: "denied-malformed-value",
              evidenceIds: ["evidence.synthetic.history"],
            }
          : point,
      ),
      timelineEvents: secondSymbol.timelineEvents.map((event, index) =>
        index === 0
          ? {
              ...event,
              evidenceIds: ["evidence.synthetic.2025-original"],
            }
          : event,
      ),
    };

    const dossier = composeDossier(snapshot, DEFAULT_KNOWN_AT);

    expect(
      dossier.metrics.some((metric) => metric.key === "synthetic_price"),
    ).toBe(false);
    expect(dossier.history.map((point) => point.period)).toEqual([
      "2023",
      "2024",
      "2025",
    ]);
    expect(dossier.timeline.map((event) => event.id)).toEqual([
      "timeline.syn2.restatement",
    ]);
    expect(
      dossier.evidence.every((evidence) =>
        evidence.id.startsWith("evidence.synthetic.syn2."),
      ),
    ).toBe(true);
    expect(
      getEvidencePassportFromSnapshot(
        snapshot,
        "evidence.synthetic.2025-original",
      ),
    ).toBeNull();
    expect(dossier.omissions.hasOmissions).toBe(true);
  });

  it("loads snapshots through the dossier use-case seam", async () => {
    const requestedSymbols: string[] = [];
    const useCase = new GetDossier({
      findBySymbol: (symbol) => {
        requestedSymbols.push(symbol);
        return Promise.resolve(
          symbol === "ISO1"
            ? {
                ...syntheticFixture,
                instrument: {
                  ...syntheticFixture.instrument,
                  symbol: "ISO1",
                },
              }
            : null,
        );
      },
    });

    const dossier = await useCase.execute("ISO1", PRE_RESTATEMENT_KNOWN_AT);
    const missing = await useCase.execute("MISSING");

    expect(dossier?.instrument.symbol).toBe("ISO1");
    expect(metric(dossier, "revenue").value).toBe("120.000");
    expect(missing).toBeNull();
    expect(requestedSymbols).toEqual(["ISO1", "MISSING"]);
  });

  it("rejects a repository snapshot whose symbol differs from the lookup", async () => {
    const useCase = new GetDossier({
      findBySymbol: () => Promise.resolve(syntheticFixture),
    });

    await expect(
      useCase.execute("WRONG", PRE_RESTATEMENT_KNOWN_AT),
    ).rejects.toThrow(/different symbol/i);
  });

  it("uses the trusted authorization clock instead of a backdated snapshot for expiry", async () => {
    const publicPolicy = syntheticFixture.rightsPolicies[0]!;
    const expiringPolicy = {
      ...publicPolicy,
      id: "rights.synthetic.expiring-price.v1",
      expiresAt: "2026-08-15T22:00:00Z",
    };
    const snapshot = {
      ...syntheticFixture,
      rightsPolicies: [...syntheticFixture.rightsPolicies, expiringPolicy],
      facts: syntheticFixture.facts.map((fact) =>
        fact.key === "synthetic_price"
          ? {
              ...fact,
              rightsPolicyId: expiringPolicy.id,
              rightsPolicyVersion: expiringPolicy.version,
            }
          : fact,
      ),
      evidence: syntheticFixture.evidence.map((evidence) =>
        evidence.id === "evidence.synthetic.price"
          ? {
              ...evidence,
              rightsPolicyId: expiringPolicy.id,
              rightsPolicyVersion: expiringPolicy.version,
            }
          : evidence,
      ),
    };

    expect(
      composeDossier(
        snapshot,
        DEFAULT_KNOWN_AT,
        "2026-08-15T21:59:59.999Z",
      ).metrics.some((metric) => metric.key === "synthetic_price"),
    ).toBe(true);

    const useCase = new GetDossier(
      { findBySymbol: () => Promise.resolve(snapshot) },
      { now: () => expiringPolicy.expiresAt },
    );
    const expired = await useCase.execute("SYN1", DEFAULT_KNOWN_AT);

    expect(
      expired?.metrics.some((metric) => metric.key === "synthetic_price"),
    ).toBe(false);
    expect(expired?.omissions.hasOmissions).toBe(true);
  });

  it("does not project fixed history or timeline events whose evidence is unauthorized", () => {
    const snapshot = {
      ...syntheticFixture,
      evidence: syntheticFixture.evidence.map((evidence) =>
        evidence.id === "evidence.synthetic.history" ||
        evidence.id === "evidence.synthetic.2025-original"
          ? { ...evidence, rightsPolicyVersion: "missing-version" }
          : evidence,
      ),
    };

    const dossier = composeDossier(snapshot, DEFAULT_KNOWN_AT);
    expect(dossier.history.map((point) => point.period)).toEqual(["2025"]);
    expect(dossier.timeline.map((event) => event.id)).toEqual([
      "timeline.restatement",
    ]);
    expect(dossier.evidence.map((evidence) => evidence.id)).not.toContain(
      "evidence.synthetic.history",
    );
    expect(dossier.omissions.hasOmissions).toBe(true);
    expect(dossier.omissions.count).toBeGreaterThan(1);
  });

  it("ignores facts for a different instrument even when their version is later", () => {
    const revenue = syntheticFixture.facts.find(
      (fact) => fact.key === "revenue" && fact.publicKnownTo === null,
    )!;
    const dossier = composeDossier(
      {
        ...syntheticFixture,
        facts: [
          ...syntheticFixture.facts,
          {
            ...revenue,
            id: "fact.foreign.revenue",
            instrumentId: "instrument.synthetic.foreign",
            value: "999999.000",
            systemRecordedFrom: "2026-08-15T20:59:59Z",
          },
        ],
      },
      DEFAULT_KNOWN_AT,
    );
    expect(metric(dossier, "revenue").value).toBe("116.400");
  });

  it("fails closed when two facts for one metric are active at the same time", () => {
    const revenue = syntheticFixture.facts.find(
      (fact) => fact.key === "revenue" && fact.publicKnownTo === null,
    )!;

    expect(() =>
      composeDossier(
        {
          ...syntheticFixture,
          facts: [
            ...syntheticFixture.facts,
            {
              ...revenue,
              id: "fact.revenue.2025.ambiguous-duplicate",
              value: "999999.000",
            },
          ],
        },
        DEFAULT_KNOWN_AT,
      ),
    ).toThrow(/ambiguous active facts/i);
  });

  it("fails closed when an evidence identifier is duplicated", () => {
    const priceEvidence = syntheticFixture.evidence.find(
      (evidence) => evidence.id === "evidence.synthetic.price",
    )!;
    const dossier = composeDossier(
      {
        ...syntheticFixture,
        evidence: [...syntheticFixture.evidence, { ...priceEvidence }],
      },
      DEFAULT_KNOWN_AT,
    );
    expect(dossier.metrics.some((item) => item.key === "synthetic_price")).toBe(
      false,
    );
    expect(
      getEvidencePassportFromSnapshot(
        {
          ...syntheticFixture,
          evidence: [...syntheticFixture.evidence, { ...priceEvidence }],
        },
        priceEvidence.id,
      ),
    ).toBeNull();
  });

  it("requires display and derive grants while leaving alert authorization operation-scoped", () => {
    const displayDerivePolicy: (typeof syntheticFixture.rightsPolicies)[number] =
      {
        id: "rights.synthetic.display-derive-only.v1",
        version: "1.0.0",
        classification: "synthetic",
        grants: [
          { purpose: "display", channel: "api", allowed: true },
          { purpose: "derive", channel: "api", allowed: true },
        ],
        territory: "demo_only",
        expiresAt: null,
      };
    const dossier = composeDossier(
      {
        ...syntheticFixture,
        rightsPolicies: [
          ...syntheticFixture.rightsPolicies,
          displayDerivePolicy,
        ],
        facts: syntheticFixture.facts.map((fact) =>
          fact.key === "synthetic_price"
            ? {
                ...fact,
                rightsPolicyId: displayDerivePolicy.id,
                rightsPolicyVersion: displayDerivePolicy.version,
              }
            : fact,
        ),
        evidence: syntheticFixture.evidence.map((evidence) =>
          evidence.id === "evidence.synthetic.price"
            ? {
                ...evidence,
                rightsPolicyId: displayDerivePolicy.id,
                rightsPolicyVersion: displayDerivePolicy.version,
              }
            : evidence,
        ),
      },
      DEFAULT_KNOWN_AT,
    );
    expect(dossier.metrics.some((item) => item.key === "synthetic_price")).toBe(
      true,
    );
  });

  it("keeps an exact zero omission count in the memory result", () => {
    const dossier = buildDossier("SYN1", PRE_RESTATEMENT_KNOWN_AT);
    expect(dossier?.omissions).toMatchObject({
      hasOmissions: false,
      count: 0,
    });
  });

  it("returns defensive dossier and evidence copies", () => {
    const first = buildDossier("SYN1", DEFAULT_KNOWN_AT)!;
    const originalName = first.instrument.name;
    const firstEvidence = getEvidencePassport("evidence.synthetic.price")!;
    const originalEvidenceTitle = firstEvidence.title;

    first.instrument.name = "mutated outside the core";
    firstEvidence.title = "mutated outside the core";

    expect(buildDossier("SYN1", DEFAULT_KNOWN_AT)?.instrument.name).toBe(
      originalName,
    );
    expect(getEvidencePassport("evidence.synthetic.price")?.title).toBe(
      originalEvidenceTitle,
    );
    expect(syntheticFixture.instrument.name).toBe(originalName);
  });
});

describe("version-exact rights decisions", () => {
  const displayContext = {
    purpose: "display",
    channel: "api",
    territory: "demo_only",
    evaluatedAt: DEFAULT_KNOWN_AT,
  } as const;

  it("requires one exact policy id/version match", () => {
    const expected = syntheticFixture.rightsPolicies[0]!;

    expect(
      getPolicy(syntheticFixture.rightsPolicies, expected.id, expected.version),
    ).toBe(expected);
    expect(
      getPolicy(syntheticFixture.rightsPolicies, expected.id, "missing"),
    ).toBeNull();
    expect(
      getPolicy(
        [...syntheticFixture.rightsPolicies, { ...expected }],
        expected.id,
        expected.version,
      ),
    ).toBeNull();
  });

  it("fails closed on purpose, channel, territory, and expiry", () => {
    const policy = syntheticFixture.rightsPolicies[0]!;

    expect(isRightsAllowed(policy, displayContext)).toBe(true);
    expect(
      isRightsAllowed(policy, { ...displayContext, purpose: "export" }),
    ).toBe(false);
    expect(
      isRightsAllowed(
        {
          ...policy,
          grants: policy.grants.filter((grant) => grant.channel !== "api"),
        },
        displayContext,
      ),
    ).toBe(false);
    expect(
      isRightsAllowed(
        {
          ...policy,
          grants: [
            ...policy.grants,
            { purpose: "display", channel: "api", allowed: false },
          ],
        },
        displayContext,
      ),
    ).toBe(false);
    expect(
      isRightsAllowed(
        { ...policy, territory: "synthetic_internal_only" },
        displayContext,
      ),
    ).toBe(false);
    expect(
      isRightsAllowed(
        { ...policy, expiresAt: DEFAULT_KNOWN_AT },
        displayContext,
      ),
    ).toBe(false);
    expect(
      isRightsAllowed({ ...policy, expiresAt: "invalid" }, displayContext),
    ).toBe(false);
    expect(
      isRightsAllowed(policy, { ...displayContext, evaluatedAt: "invalid" }),
    ).toBe(false);
    expect(isRightsAllowed(null, displayContext)).toBe(false);
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

function secondSymbolSnapshot() {
  const instrumentId = "instrument.synthetic.syn2";
  const evidenceId = (id: string) =>
    id.replace("evidence.synthetic.", "evidence.synthetic.syn2.");

  return {
    ...syntheticFixture,
    instrument: {
      ...syntheticFixture.instrument,
      id: instrumentId,
      symbol: "SYN2",
      name: "Contoso Sensor Systems",
      description:
        "A second fictional company used to prove instrument isolation.",
    },
    facts: syntheticFixture.facts.map((fact) => ({
      ...fact,
      id: `fact.syn2.${fact.id.slice("fact.".length)}`,
      instrumentId,
      evidenceId: evidenceId(fact.evidenceId),
    })),
    evidence: syntheticFixture.evidence.map((evidence) => ({
      ...evidence,
      id: evidenceId(evidence.id),
      documentId: evidence.documentId.replaceAll("SYN1", "SYN2"),
    })),
    evidenceBindings: syntheticFixture.evidenceBindings.map((binding) => ({
      ...binding,
      instrumentId,
      evidenceId: evidenceId(binding.evidenceId),
    })),
    historicalPoints: syntheticFixture.historicalPoints.map((point, index) => ({
      ...point,
      id: `history.syn2.${point.id.slice("history.".length)}`,
      instrumentId,
      revenue: `${200 + index}.0`,
      ebitda: `${20 + index}.0`,
      evidenceIds: point.evidenceIds.map(evidenceId),
    })),
    timelineEvents: syntheticFixture.timelineEvents.map((event) => ({
      ...event,
      id: `timeline.syn2.${event.id.slice("timeline.".length)}`,
      instrumentId,
      evidenceIds: event.evidenceIds.map(evidenceId),
    })),
  };
}

function metric(dossier: ReturnType<typeof buildDossier>, key: string) {
  const result = dossier?.metrics.find((candidate) => candidate.key === key);
  if (!result) throw new Error(`Missing metric in test: ${key}`);
  return result;
}
