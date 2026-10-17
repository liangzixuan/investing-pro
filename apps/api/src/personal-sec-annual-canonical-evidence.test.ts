import { describe, expect, it, vi } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY,
  serializePersonalSecAnnualStatementObservation,
} from "@research-cockpit/contracts";
import {
  assertPersonalSecAnnualCanonicalEvidence,
  resolvePersonalSecAnnualStatements,
  serializePersonalSecAnnualCanonicalGeneration,
} from "@research-cockpit/personal-financial-analytics";
import {
  createPersonalSecAnnualCanonicalEvidence,
  type PersonalSecAnnualCanonicalInput,
} from "./personal-sec-annual-canonical-evidence";
import {
  normalizePersonalSecAnnualStatementCompanyFacts,
  unavailablePersonalSecAnnualStatementCompanyFacts,
} from "./personal-sec-annual-statement-company-facts";
import {
  normalizePersonalSecSubmissions,
  parsePersonalSecSourceJson,
} from "./personal-sec-quarterly-evidence-provider";

import {
  CIK,
  ACCESSION,
  OTHER,
  OCF,
  sha,
  flow,
  fixture,
} from "./test-personal-sec-annual-canonical-builder";

type Mutable<T> =
  T extends ReadonlyMap<infer Key, infer Value>
    ? Map<Key, Value>
    : { -readonly [Key in keyof T]: Mutable<T[Key]> };
function mutable(): Mutable<PersonalSecAnnualCanonicalInput> {
  return structuredClone(
    fixture().input,
  ) as Mutable<PersonalSecAnnualCanonicalInput>;
}

describe("canonical annual evidence composition", () => {
  it("composes the exact normalizer graph, joins captured Submissions, binds Node hashes and freezes only owned evidence", () => {
    const { input, companyText, submissionsText } = fixture();
    const before = JSON.stringify(input);
    const originalFiling = input.submissions!.filings.get(ACCESSION)!;
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    assertPersonalSecAnnualCanonicalEvidence(result);
    expect(result.facts.observations).toHaveLength(5);
    expect(result.facts.scans.map((item) => item.concept)).toEqual(
      PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => entry.concept),
    );
    expect(result.generation.sources.companyFacts).toMatchObject({
      sha256: sha(companyText),
      bytes: Buffer.byteLength(companyText),
    });
    expect(result.generation.sources.submissions).toMatchObject({
      sha256: sha(submissionsText),
      bytes: Buffer.byteLength(submissionsText),
    });
    expect(
      result.facts.observations.find(
        (row) => row.concept === "Revenues" && row.endDate === "2025-12-31",
      )!.value,
    ).toBe("900719925474099312345.000000000000000001");
    expect(
      result.facts.observations.find((row) => row.concept === "NetIncomeLoss")!
        .value,
    ).toBe("-900719925474099312345.000000000000000001");
    expect(
      result.facts.observations.find(
        (row) => row.concept === "StockholdersEquity",
      )!.value,
    ).toBe("-7.5");
    for (const row of result.facts.observations) {
      expect(row.filing).toEqual({ status: "matched", ...originalFiling });
      expect(row.filing).not.toBe(originalFiling);
      expect(row.id).toBe(
        sha(serializePersonalSecAnnualStatementObservation(row)).replace(
          /^sha256:/u,
          "sec-fact:",
        ),
      );
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.filing)).toBe(true);
    }
    expect(result.generation.sha256).toBe(
      sha(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
    expect(result.facts.observations[0]!.sourceLocator).toBe(
      "/facts/us-gaap/Revenues/units/USD/0",
    );
    expect(
      result.facts.scans.find((item) => item.concept === "Revenues")!.scan,
    ).toMatchObject({
      coverage: {
        full: { candidateRows: 3, duplicateRows: 1, uniqueObservations: 2 },
      },
    });
    expect(result.facts.observations).not.toBe(input.facts.observations);
    expect(result.facts.scans).not.toBe(input.facts.scans);
    expect(result.target).not.toBe(input.target);
    expect(result.targetScan).not.toBe(input.targetScan);
    expect(result.generation.sources).not.toBe(input.generation.sources);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.generation.sources.companyFacts)).toBe(true);
    expect(Object.isFrozen(result.facts.scans[0]!.scan)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.submissions!.filings.get(ACCESSION)).toBe(originalFiling);
    expect(Object.isFrozen(input.generation)).toBe(false);
    expect(Object.isFrozen(input.target)).toBe(false);
    expect(Object.isFrozen(input.submissions!.filings)).toBe(false);
    expect(input.facts.observations.every((row) => !("filing" in row))).toBe(
      true,
    );
  });

  it("owns source metadata, targets and rows so later caller edits cannot alter or retarget its graph", () => {
    const input = mutable();
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    const before = JSON.stringify(result);
    input.generation.sources.companyFacts.sha256 = sha(
      "changed caller metadata",
    );
    input.facts.observations[0]!.value = "1";
    input.facts.scans.reverse();
    input.submissions!.filings.clear();
    if (input.target.status === "target")
      input.target.reportDate = "2024-12-31";
    expect(JSON.stringify(result)).toBe(before);
    expect(result.generation.sha256).toBe(
      sha(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
  });

  it("preserves metadata conflict alongside the original fact and lets statement admission refuse that cell", () => {
    const { input } = fixture([flow({ filed: "2026-02-02" })]);
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    const cash = result.facts.observations.find((row) => row.concept === OCF)!;
    expect(cash.filedDate).toBe("2026-02-02");
    expect(cash.filing).toMatchObject({
      status: "metadata_conflict",
      filedDate: "2026-02-01",
      form: "10-K",
      reportDate: "2025-12-31",
    });
    const statements = resolvePersonalSecAnnualStatements(result);
    expect(
      statements.statements
        .find((statement) => statement.id === "cash_flow")!
        .rows.find((row) => row.concept === OCF)!.cells[0],
    ).toMatchObject({
      status: "unavailable",
      reason: "filing_unmatched_or_conflicted",
      observationIds: [cash.id],
    });
    expect(result.generation.sha256).toBe(
      sha(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
  });

  it("keeps absent filing metadata explicit instead of manufacturing a match", () => {
    const input = mutable();
    const other = normalizePersonalSecSubmissions(
      parsePersonalSecSourceJson(
        JSON.stringify({
          cik: 42,
          filings: {
            recent: {
              accessionNumber: [OTHER],
              form: ["10-K"],
              filingDate: ["2025-02-01"],
              reportDate: ["2024-12-31"],
            },
            files: [],
          },
        }),
      ),
      CIK,
    );
    input.submissions = { ...other, filings: new Map(other.filings) };
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    for (const row of result.facts.observations)
      expect(row.filing).toEqual({
        status: "not_in_current_submissions",
        form: null,
        filedDate: null,
        reportDate: null,
        acceptedAt: null,
        sourceUrl: null,
      });
    expect(other.filings.size).toBe(1);
    expect(result.generation.sha256).toBe(
      sha(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
  });

  it("binds unavailable Submissions context without returning selected rows or modifying full scan counts", () => {
    const { companyText } = fixture();
    const input = mutable();
    input.submissions = undefined;
    input.generation.sources.submissions = {
      ...input.generation.sources.submissions,
      status: "upstream_unavailable",
      fetchedAt: null,
      sha256: null,
      bytes: null,
    };
    input.target = { status: "unresolved", reason: "submissions_unavailable" };
    input.targetScan = null;
    input.facts = structuredClone(
      normalizePersonalSecAnnualStatementCompanyFacts(
        parsePersonalSecSourceJson(companyText),
        CIK,
        null,
      ),
    ) as Mutable<PersonalSecAnnualCanonicalInput>["facts"];
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    expect(result.target).toEqual({
      status: "unresolved",
      reason: "submissions_unavailable",
    });
    expect(result.targetScan).toBeNull();
    expect(result.facts.observations).toEqual([]);
    expect(
      result.facts.scans.find((item) => item.concept === "Revenues")!.scan,
    ).toMatchObject({
      coverage: {
        full: { candidateRows: 3, duplicateRows: 1, uniqueObservations: 2 },
        selected: null,
        otherAccessions: null,
        returned: 0,
        omittedSelected: null,
      },
    });
    expect(result.generation.sources.submissions).toEqual(
      input.generation.sources.submissions,
    );
  });

  it("retains every unavailable concept and original failed source metadata without fake observed values", () => {
    const input = mutable();
    input.facts = structuredClone(
      unavailablePersonalSecAnnualStatementCompanyFacts("source_unavailable"),
    ) as Mutable<PersonalSecAnnualCanonicalInput>["facts"];
    input.generation.sources.companyFacts.status = "invalid_response";
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    expect(result.facts.scans).toHaveLength(32);
    expect(
      result.facts.scans.every(
        (item) =>
          item.scan.status === "source_unavailable" &&
          item.scan.absence === null &&
          item.scan.coverage === null,
      ),
    ).toBe(true);
    expect(result.facts.observations).toEqual([]);
    expect(result.generation.sources.companyFacts).toEqual(
      input.generation.sources.companyFacts,
    );
    expect(resolvePersonalSecAnnualStatements(result).contextReason).toBe(
      "source_unavailable",
    );
    expect(result.generation.sha256).toBe(
      sha(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
  });

  it("refuses contradictory available Submissions context with unavailable selected-row metadata", () => {
    const input = mutable();
    input.submissions = undefined;
    expect(() => createPersonalSecAnnualCanonicalEvidence(input)).toThrow(
      TypeError,
    );
  });

  it("binds a shaped invalid clock so the pure resolver can retain its explicit diagnostic", () => {
    const input = mutable();
    input.generation.completedAt = "2026-09-19T23:59:59.000Z";
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    expect(result.generation.completedAt).toBe(input.generation.completedAt);
    expect(result.facts.observations).toHaveLength(5);
    expect(resolvePersonalSecAnnualStatements(result).contextReason).toBe(
      "invalid_clock",
    );
    expect(result.generation.sha256).toBe(
      sha(serializePersonalSecAnnualCanonicalGeneration(result)),
    );
  });

  it("retains candidate-limit, selected-overflow and missing-concept refusals independently in the canonical graph", () => {
    const { input: base } = fixture(
      Array.from({ length: 101 }, (_, val) => flow({ val })),
    );
    const input = structuredClone(
      base,
    ) as Mutable<PersonalSecAnnualCanonicalInput>;
    const cost = input.facts.scans.find(
      (item) => item.concept === "CostOfRevenue",
    )!;
    cost.scan = { status: "candidate_limit", absence: null, coverage: null };
    const result = createPersonalSecAnnualCanonicalEvidence(input);
    expect(
      result.facts.scans.find((item) => item.concept === OCF)!.scan,
    ).toMatchObject({
      status: "available",
      coverage: { selected: 101, returned: 0, omittedSelected: 101 },
    });
    expect(
      result.facts.scans.find((item) => item.concept === "CostOfRevenue")!.scan
        .status,
    ).toBe("candidate_limit");
    const statements = resolvePersonalSecAnnualStatements(result);
    const cash = statements.statements.find(
      (statement) => statement.id === "cash_flow",
    )!;
    expect(
      cash.rows.find((row) => row.concept === OCF)!.cells[0],
    ).toMatchObject({
      status: "unavailable",
      reason: "selected_report_overflow",
    });
    expect(
      result.facts.observations.some(
        (row) => row.concept === "StockholdersEquity",
      ),
    ).toBe(true);
  });

  it.each(["id", "value", "frame"] as const)(
    "refuses changed raw observation %s instead of silently assigning a new identity",
    (field) => {
      const input = mutable();
      if (field === "id")
        input.facts.observations[0]!.id = `sec-fact:${"f".repeat(64)}`;
      if (field === "value") input.facts.observations[0]!.value = "1";
      if (field === "frame") input.facts.observations[0]!.frame = "CY2025";
      expect(() => createPersonalSecAnnualCanonicalEvidence(input)).toThrow(
        "Invalid annual statement source identity.",
      );
    },
  );

  it.each([
    "registry",
    "row order",
    "count",
    "pointer",
    "source CIK",
    "generation version",
  ] as const)("refuses inconsistent closed evidence: %s", (kind) => {
    const input = mutable();
    if (kind === "registry")
      Object.assign(input.facts, { registryVersion: "other" });
    if (kind === "row order") input.facts.observations.reverse();
    if (kind === "count") {
      const scan = input.facts.scans.find(
        (item) => item.concept === "Revenues",
      )!.scan;
      if (scan.status === "available") scan.coverage.returned = 0;
    }
    if (kind === "pointer") input.facts.observations[0]!.sourceLocator += "9";
    if (kind === "source CIK")
      input.generation.sources.companyFacts.sourceUrl =
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000043.json";
    if (kind === "generation version")
      Object.assign(input.generation, { definitionVersion: "5.0.0" });
    expect(() => createPersonalSecAnnualCanonicalEvidence(input)).toThrow(
      TypeError,
    );
  });

  it.each(["input", "generation", "facts", "raw row"] as const)(
    "rejects accessors before composing %s",
    (level) => {
      const input = mutable();
      const getter = vi.fn(() => "not evaluated");
      if (level === "input")
        Object.defineProperty(input, "cik", { enumerable: true, get: getter });
      if (level === "generation")
        Object.defineProperty(input.generation, "cutoffAt", {
          enumerable: true,
          get: getter,
        });
      if (level === "facts")
        Object.defineProperty(input.facts, "registryVersion", {
          enumerable: true,
          get: getter,
        });
      if (level === "raw row")
        Object.defineProperty(input.facts.observations[0], "value", {
          enumerable: true,
          get: getter,
        });
      expect(() => createPersonalSecAnnualCanonicalEvidence(input)).toThrow(
        TypeError,
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );

  it.each([
    "extra filing",
    "extra field",
    "inherited row",
    "row symbol",
    "nonenumerable row",
    "sparse rows",
    "row array accessor",
    "extra generation hash",
  ] as const)("refuses malformed raw closed shapes: %s", (kind) => {
    const input = mutable();
    if (kind === "extra filing")
      Object.assign(input.facts.observations[0]!, {
        filing: { status: "matched" },
      });
    if (kind === "extra field") Object.assign(input, { extra: true });
    if (kind === "inherited row")
      input.facts.observations[0] = Object.create(
        input.facts.observations[0]!,
      ) as Mutable<PersonalSecAnnualCanonicalInput>["facts"]["observations"][number];
    if (kind === "row symbol")
      Object.defineProperty(input.facts.observations[0], Symbol("extra"), {
        value: true,
        enumerable: true,
      });
    if (kind === "nonenumerable row")
      Object.defineProperty(input.facts.observations[0], "value", {
        value: "100",
        enumerable: false,
      });
    if (kind === "sparse rows")
      Reflect.deleteProperty(input.facts.observations, "0");
    const getter = vi.fn(() => input.facts.observations[1]);
    if (kind === "row array accessor")
      Object.defineProperty(input.facts.observations, "0", {
        enumerable: true,
        get: getter,
      });
    if (kind === "extra generation hash")
      Object.assign(input.generation, { sha256: sha("caller supplied") });
    expect(() => createPersonalSecAnnualCanonicalEvidence(input)).toThrow(
      TypeError,
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it("fails before composition if the raw observation array exceeds the fixed graph bound", () => {
    const input = mutable();
    input.facts.observations.length = 3201;
    expect(() => createPersonalSecAnnualCanonicalEvidence(input)).toThrow(
      "Invalid canonical annual source rows.",
    );
  });
});
