import { describe, expect, it } from "vitest";

import {
  preparePersonalFilingDossier,
  type PersonalFilingDossierPlan,
} from "./personal-filing-dossier";
import { preparePersonalFilingSelectedFactRelease } from "./personal-filing-selected-fact-release";
import {
  buildPersonalFilingDossierInput,
  personalFilingDossierQuarantineFixture,
} from "./test-personal-filing-dossier-builder";

describe("personal filing dossier composition", () => {
  it("composes one immutable current-and-superseded graph from one owner-authorized snapshot", () => {
    const result = preparePersonalFilingDossier(
      buildPersonalFilingDossierInput(true, 1),
    );

    expect(result.status).toBe("prepared_personal_dossier_for_personal_use");
    if (result.status !== "prepared_personal_dossier_for_personal_use") return;
    expect(result.asOf).toBe("2026-03-15T20:00:01.000Z");
    expect(result.facts).toHaveLength(20);
    expect(result.evidence).toHaveLength(20);
    expect(result.lineage.status).toBe("amendment_supersession_observed");
    expect(result.lineage.events).toHaveLength(10);
    expect(
      result.facts.slice(0, 10).every((fact) => fact.version === "superseded"),
    ).toBe(true);
    expect(
      result.facts.slice(10).every((fact) => fact.version === "current"),
    ).toBe(true);
    expect(result.facts[0]).toMatchObject({
      evidenceId: "evidence-0001",
      id: "fact-0001",
      key: "assets",
      knownFrom: "2026-02-20T20:00:01.000Z",
      knownToExclusive: "2026-03-15T20:00:01.000Z",
    });
    expect(result.facts[10]).toMatchObject({
      evidenceId: "evidence-0011",
      id: "fact-0011",
      key: "assets",
      knownFrom: "2026-03-15T20:00:01.000Z",
      knownToExclusive: null,
    });
    expect(result.evidence[0]?.derivationOperands).toEqual([]);
    expect(result.evidence[4]).toMatchObject({
      derivationFormula: "operating_cash_flow_minus_capital_expenditures",
      derivationOperands: [
        {
          concept: "sample:OperatingCashFlow",
          periodEnd: "2025-12-31",
          periodStart: "2025-01-01",
          role: "minuend",
          unit: "USD",
          value: "20000000",
        },
        {
          concept: "sample:CapitalExpenditures",
          periodEnd: "2025-12-31",
          periodStart: "2025-01-01",
          role: "subtrahend",
          unit: "USD",
          value: "5000000",
        },
      ],
      factId: "fact-0005",
      id: "evidence-0005",
      sourceConcept: null,
    });
    expect(result.evidence[14]?.derivationOperands).toEqual([
      {
        concept: "sample:OperatingCashFlow",
        periodEnd: "2025-12-31",
        periodStart: "2025-01-01",
        role: "minuend",
        unit: "USD",
        value: "20000000",
      },
      {
        concept: "sample:CapitalExpenditures",
        periodEnd: "2025-12-31",
        periodStart: "2025-01-01",
        role: "subtrahend",
        unit: "USD",
        value: "6000000",
      },
    ]);
    expect(result.lineage.events[0]).toEqual({
      effectiveAt: "2026-03-15T20:00:01.000Z",
      key: "assets",
      predecessorFactId: "fact-0001",
      successorFactId: "fact-0011",
    });
    expect(result.chart).toMatchObject({ status: "ready" });
    if (result.chart.status === "ready") {
      expect(result.chart.series.map((series) => series.key)).toEqual([
        "operating_income",
        "revenue",
      ]);
      expect(result.chart.series[0]?.points).toEqual([
        { factId: "fact-0009" },
        { factId: "fact-0019" },
      ]);
    }
    expect(result.valuationInputs).toEqual({
      baseRevenueFactId: "fact-0020",
      cashFactId: "fact-0012",
      debtFactId: "fact-0013",
      dilutedSharesFactId: "fact-0014",
      modelVersion: "exit-multiple-v1",
      status: "ready",
    });
    expect(result.omissions).toEqual({
      count: null,
      explanation: "The complete bounded ten-fact snapshot is included.",
      hasOmissions: false,
      reasonCode: "OWNER_FIXED_SCOPE",
    });
    expectDeepFrozen(result);
  });

  it("never looks ahead beyond the exact selected document index", () => {
    const result = preparePersonalFilingDossier(
      buildPersonalFilingDossierInput(true, 0),
    );

    expect(result.status).toBe("prepared_personal_dossier_for_personal_use");
    if (result.status !== "prepared_personal_dossier_for_personal_use") return;
    expect(result.facts).toHaveLength(10);
    expect(result.facts.every((fact) => fact.version === "current")).toBe(true);
    expect(result.facts.every((fact) => fact.knownToExclusive === null)).toBe(
      true,
    );
    expect(result.lineage).toEqual({
      events: [],
      scope: "issuer_filing_versions_within_exact_frozen_manifest_only",
      status: "root_only_no_in_corpus_amendment",
    });
    expect(JSON.stringify(result)).not.toContain(`sha256:${"b".repeat(64)}`);
    expect(JSON.stringify(result)).not.toContain("2026-03-15T20:00:01.000Z");
    expect(result.asOf).toBe("2026-02-20T20:00:01.000Z");
  });

  it("uses explicit unsupported states without synthetic or partial fallback", () => {
    const result = preparePersonalFilingDossier(
      buildPersonalFilingDossierInput(false, 0, {
        chartFactKeys: [],
        factKeys: ["assets", "revenue"],
      }),
    );

    expect(result.status).toBe("prepared_personal_dossier_for_personal_use");
    if (result.status !== "prepared_personal_dossier_for_personal_use") return;
    expect(result.chart).toEqual({
      reasonCode: "NO_OWNER_APPROVED_CHART_FACTS",
      status: "unsupported",
    });
    expect(result.valuationInputs).toEqual({
      reasonCode: "REQUIRED_FACTS_NOT_RELEASED",
      status: "unsupported",
    });
    expect(result.omissions).toMatchObject({
      count: null,
      hasOmissions: true,
      reasonCode: "OWNER_FIXED_SCOPE",
    });
    expect(JSON.stringify(result)).not.toContain("synthetic");
  });

  it("preserves the exact selected-fact projection while composing from the admitted normalization", () => {
    const input = buildPersonalFilingDossierInput(true, 1, {
      chartFactKeys: [],
      factKeys: ["assets", "free_cash_flow", "revenue"],
    });
    const selected = preparePersonalFilingSelectedFactRelease({
      declaration: input.declaration,
      expectedBindings: input.expectedBindings,
      manifest: input.manifest,
      normalizationPlan: input.normalizationPlan,
      qualityPlan: input.qualityPlan,
      rawFilingDocuments: input.rawFilingDocuments,
      releasePlan: {
        documentIndex: input.dossierPlan.documentIndex,
        factKeys: input.dossierPlan.factKeys,
        profile: "personal_single_user_local",
        role: "personal_selected_fact_release_plan",
        schemaVersion: "1.0.0",
        selectionRule: "exact_candidate_document_index_and_fact_key.v1",
      },
      sourceDocuments: input.sourceDocuments,
    });
    const dossier = preparePersonalFilingDossier(input);
    expect(selected.status).toBe("prepared_selected_facts_for_personal_use");
    expect(dossier.status).toBe("prepared_personal_dossier_for_personal_use");
    if (
      selected.status !== "prepared_selected_facts_for_personal_use" ||
      dossier.status !== "prepared_personal_dossier_for_personal_use"
    ) {
      return;
    }
    expect(
      dossier.facts
        .filter((fact) => fact.version === "current")
        .map(({ key, periodEnd, periodStart, unit, value }) => ({
          key,
          periodEnd,
          periodStart,
          unit,
          value,
        })),
    ).toEqual(selected.facts);
  });

  it.each([
    { documentIndex: -1 },
    { documentIndex: 2 },
    { factKeys: [] },
    { factKeys: ["cash", "cash"] },
    { factKeys: ["revenue", "cash"] },
    { chartFactKeys: ["revenue", "operating_income"] },
    { chartFactKeys: ["cash", "diluted_shares"] },
    { chartFactKeys: ["gross_profit"], factKeys: ["assets", "revenue"] },
    { profile: "enterprise" },
    { role: "wrong" },
    { schemaVersion: "2.0.0" },
    { snapshotRule: "latest" },
  ])("quarantines invalid closed dossier plan %#", (change) => {
    const input = buildPersonalFilingDossierInput();
    const dossierPlan = { ...input.dossierPlan, ...change };
    expect(
      preparePersonalFilingDossier({
        ...input,
        dossierPlan: dossierPlan as PersonalFilingDossierPlan,
      }),
    ).toEqual(personalFilingDossierQuarantineFixture());
  });

  it("requires every exact quality-binding member", () => {
    const input = buildPersonalFilingDossierInput();
    for (const key of Object.keys(input.expectedBindings) as Array<
      keyof typeof input.expectedBindings
    >) {
      expect(
        preparePersonalFilingDossier({
          ...input,
          expectedBindings: {
            ...input.expectedBindings,
            [key]: `sha256:${"0".repeat(64)}`,
          },
        }),
      ).toEqual(personalFilingDossierQuarantineFixture());
    }
  });
});

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
