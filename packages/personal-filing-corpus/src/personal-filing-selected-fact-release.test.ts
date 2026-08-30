import { describe, expect, it } from "vitest";

import {
  PERSONAL_FILING_FACT_KEYS,
  normalizePersonalFilingFacts,
} from "./personal-filing-fact-normalization";
import { createPersonalFilingQualityMeasurementProtocol } from "./personal-filing-quality-measurement";
import {
  PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE,
  PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
  PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE,
  PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
  PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE,
  preparePersonalFilingSelectedFactRelease,
  type PersonalFilingSelectedFactReleaseInput,
  type PersonalFilingSelectedFactReleasePlan,
} from "./personal-filing-selected-fact-release";
import { buildPersonalFilingQualityMeasurementFixture } from "./test-personal-filing-quality-measurement-builder";

describe("personal filing selected fact release", () => {
  it.each([
    [false, 0],
    [true, 1],
  ] as const)(
    "prepares only the selected frozen projection for amendment mode %s document %i",
    (withAmendment, documentIndex) => {
      const input = boundInput(withAmendment, {
        documentIndex,
        factKeys: ["cash", "net_income", "revenue"],
      });
      const expected = expectedFacts(input, documentIndex).filter((fact) =>
        ["cash", "net_income", "revenue"].includes(fact.key),
      );

      const result = preparePersonalFilingSelectedFactRelease(input);

      expect(result).toEqual({
        facts: expected.map(({ key, periodEnd, periodStart, unit, value }) => ({
          key,
          periodEnd,
          periodStart,
          unit,
          value,
        })),
        profile: PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
        role: PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE,
        schemaVersion: PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
        status: "prepared_selected_facts_for_personal_use",
      });
      expectDeepFrozen(result);
      for (const fact of result.facts) {
        expect(Object.keys(fact).sort()).toEqual([
          "key",
          "periodEnd",
          "periodStart",
          "unit",
          "value",
        ]);
      }
    },
  );

  it("requires every member of the exact five-hash binding tuple", () => {
    const input = boundInput();
    for (const key of Object.keys(input.expectedBindings) as Array<
      keyof typeof input.expectedBindings
    >) {
      const result = preparePersonalFilingSelectedFactRelease({
        ...input,
        expectedBindings: {
          ...input.expectedBindings,
          [key]: `sha256:${"0".repeat(64)}`,
        },
      });
      expect(result).toEqual(quarantined());
      expectDeepFrozen(result);
    }
  });

  it.each([
    { documentIndex: -1 },
    { documentIndex: 1 },
    { factKeys: [] },
    { factKeys: ["cash", "cash"] },
    { factKeys: ["revenue", "cash"] },
    { profile: "enterprise" },
    { role: "wrong" },
    { schemaVersion: "2.0.0" },
    { selectionRule: "wrong" },
  ])("quarantines invalid closed release plan %#", (change) => {
    const input = boundInput();
    const releasePlan = { ...input.releasePlan, ...change };
    expect(
      preparePersonalFilingSelectedFactRelease({
        ...input,
        releasePlan: releasePlan as PersonalFilingSelectedFactReleasePlan,
      }),
    ).toEqual(quarantined());
  });

  it("rejects aliases, Buffer carriers, proxies, accessors, and extra keys without invoking canaries", () => {
    const input = boundInput();
    const alias = input.declaration;
    expect(
      preparePersonalFilingSelectedFactRelease({
        ...input,
        manifest: alias,
      }),
    ).toEqual(quarantined());
    expect(
      preparePersonalFilingSelectedFactRelease({
        ...input,
        declaration: Buffer.from(input.declaration),
      }),
    ).toEqual(quarantined());
    expect(
      preparePersonalFilingSelectedFactRelease(new Proxy(input, {})),
    ).toEqual(quarantined());

    let invoked = false;
    const hostile = { ...input } as Record<string, unknown>;
    Object.defineProperty(hostile, "manifest", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("private-canary");
      },
    });
    expect(
      preparePersonalFilingSelectedFactRelease(
        hostile as unknown as PersonalFilingSelectedFactReleaseInput,
      ),
    ).toEqual(quarantined());
    expect(invoked).toBe(false);
    expect(
      preparePersonalFilingSelectedFactRelease({
        ...input,
        extra: "forbidden",
      } as unknown as PersonalFilingSelectedFactReleaseInput),
    ).toEqual(quarantined());
  });

  it("owns the input snapshot and leaves a successful result immutable after caller mutation", () => {
    const input = boundInput();
    const result = preparePersonalFilingSelectedFactRelease(input);
    expect(result.status).toBe("prepared_selected_facts_for_personal_use");
    const before = JSON.stringify(result);

    input.declaration.fill(120);
    input.sourceDocuments[0]?.fill(121);
    (input.releasePlan.factKeys as PersonalFilingFactKeyArray).splice(0);
    expect(JSON.stringify(result)).toBe(before);
    expectDeepFrozen(result);
  });

  it("never releases partial values when normalization or selection cannot complete", () => {
    const input = boundInput();
    const expectedValue = expectedFacts(input, 0)[0]?.value;
    const source = input.sourceDocuments[0];
    if (source === undefined) throw new TypeError("Fixture is incomplete.");
    const changed = new Uint8Array(source);
    changed[8] = (changed[8] ?? 0) ^ 1;

    const result = preparePersonalFilingSelectedFactRelease({
      ...input,
      sourceDocuments: [changed],
    });

    expect(result).toEqual(quarantined());
    expect(result.facts).toEqual([]);
    if (expectedValue !== undefined)
      expect(JSON.stringify(result)).not.toContain(expectedValue);
  });
});

type PersonalFilingFactKeyArray = Array<
  (typeof PERSONAL_FILING_FACT_KEYS)[number]
>;

function boundInput(
  withAmendment = false,
  selection: {
    readonly documentIndex?: number;
    readonly factKeys?: readonly (typeof PERSONAL_FILING_FACT_KEYS)[number][];
  } = {},
): PersonalFilingSelectedFactReleaseInput {
  const fixture = buildPersonalFilingQualityMeasurementFixture(withAmendment);
  const committed = createPersonalFilingQualityMeasurementProtocol().commit(
    fixture.commitInput,
  );
  if (committed.status !== "candidate_committed_for_personal_use")
    throw new TypeError("Generated release fixture did not commit.");
  return {
    ...fixture.commitInput,
    expectedBindings: {
      candidateCommitmentSha256: committed.candidateCommitmentSha256,
      candidateObservationsSha256: committed.candidateObservationsSha256,
      inputSetSha256: committed.inputSetSha256,
      ownerReviewedReferenceSha256: committed.ownerReviewedReferenceSha256,
      qualityPlanSha256: committed.qualityPlanSha256,
    },
    releasePlan: {
      documentIndex: selection.documentIndex ?? 0,
      factKeys: selection.factKeys ?? ["assets", "revenue"],
      profile: PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
      role: PERSONAL_FILING_SELECTED_FACT_RELEASE_PLAN_ROLE,
      schemaVersion: PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
      selectionRule: PERSONAL_FILING_SELECTED_FACT_RELEASE_SELECTION_RULE,
    },
  };
}

function expectedFacts(
  input: PersonalFilingSelectedFactReleaseInput,
  documentIndex: number,
) {
  const normalization = normalizePersonalFilingFacts({
    declaration: input.declaration,
    manifest: input.manifest,
    normalizationPlan: input.normalizationPlan,
    sourceDocuments: input.sourceDocuments,
  });
  if (normalization.status !== "normalized_for_personal_use")
    throw new TypeError("Generated release fixture did not normalize.");
  return normalization.factVersions.slice(
    documentIndex * PERSONAL_FILING_FACT_KEYS.length,
    (documentIndex + 1) * PERSONAL_FILING_FACT_KEYS.length,
  );
}

function quarantined() {
  return {
    facts: [],
    profile: PERSONAL_FILING_SELECTED_FACT_RELEASE_PROFILE,
    role: PERSONAL_FILING_SELECTED_FACT_RELEASE_ROLE,
    schemaVersion: PERSONAL_FILING_SELECTED_FACT_RELEASE_SCHEMA_VERSION,
    status: "quarantined",
  };
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child);
}
