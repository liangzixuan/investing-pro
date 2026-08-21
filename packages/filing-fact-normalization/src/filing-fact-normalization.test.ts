import { describe, expect, it } from "vitest";

import {
  FILING_FACT_CONTRACTS,
  FILING_FACT_KEYS,
  FILING_FACT_NORMALIZATION_CHECKS,
  FILING_FACT_NORMALIZATION_CLAIM,
  FILING_FACT_NORMALIZATION_NOT_PROVEN,
  FILING_FACT_NORMALIZATION_QUARANTINE_CODES,
  FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
  FilingFactProjectionError,
  normalizeSyntheticFilingFactPair,
  projectNormalizedFilingFactsAsKnown,
} from "./filing-fact-normalization";
import {
  buildSyntheticFilingFactDocuments,
  canonicalSyntheticFilingFactDocument,
  decodeSyntheticFilingFactDocument,
} from "./test-filing-fact-builder";

describe("synthetic filing fact normalization", () => {
  it("freezes the exact claim, ten-key contract, checks, and nonclaims", () => {
    expect(FILING_FACT_NORMALIZATION_SCHEMA_VERSION).toBe("1.0.0");
    expect(FILING_FACT_NORMALIZATION_CLAIM).toBe(
      "bounded_synthetic_ten_fact_normalization_and_amendment_supersession_lineage",
    );
    expect(FILING_FACT_KEYS).toEqual([
      "assets",
      "cash",
      "debt",
      "diluted_shares",
      "free_cash_flow",
      "gross_profit",
      "net_income",
      "operating_cash_flow",
      "operating_income",
      "revenue",
    ]);
    expect(FILING_FACT_CONTRACTS).toHaveLength(10);
    expect(
      FILING_FACT_CONTRACTS.filter((entry) => entry.unit === "USD"),
    ).toHaveLength(9);
    expect(
      FILING_FACT_CONTRACTS.filter((entry) => entry.unit === "shares"),
    ).toHaveLength(1);
    expect(
      FILING_FACT_CONTRACTS.filter((entry) => entry.periodKind === "instant"),
    ).toHaveLength(3);
    expect(
      FILING_FACT_CONTRACTS.filter((entry) => entry.periodKind === "duration"),
    ).toHaveLength(7);
    expect(FILING_FACT_NORMALIZATION_CHECKS).toHaveLength(16);
    expect(FILING_FACT_NORMALIZATION_NOT_PROVEN).toHaveLength(16);
    expect(Object.isFrozen(FILING_FACT_KEYS)).toBe(true);
    expect(Object.isFrozen(FILING_FACT_CONTRACTS)).toBe(true);
    expect(FILING_FACT_CONTRACTS.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(FILING_FACT_NORMALIZATION_CHECKS)).toBe(true);
    expect(Object.isFrozen(FILING_FACT_NORMALIZATION_NOT_PROVEN)).toBe(true);
    expect(Object.isFrozen(FILING_FACT_NORMALIZATION_QUARANTINE_CODES)).toBe(
      true,
    );
  });

  it("normalizes one complete original and amendment pair atomically", () => {
    const { amendmentDocument, originalDocument } =
      buildSyntheticFilingFactDocuments();
    const result = normalizeSyntheticFilingFactPair(
      originalDocument,
      amendmentDocument,
    );
    expect(result.status).toBe("normalized");
    if (result.status !== "normalized") throw new Error("expected normalized");
    expect(result.factVersions).toHaveLength(20);
    expect(result.lineage).toHaveLength(10);
    expect(result.audit).toEqual({
      factVersionCount: 20,
      lineageCount: 10,
      outcome: "normalized",
    });
    expect(result.factVersions.slice(0, 10).map((fact) => fact.key)).toEqual(
      FILING_FACT_KEYS,
    );
    expect(result.factVersions.slice(10).map((fact) => fact.key)).toEqual(
      FILING_FACT_KEYS,
    );
    expect(result.factVersions.every((fact) => Object.isFrozen(fact))).toBe(
      true,
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.factVersions)).toBe(true);
    expect(Object.isFrozen(result.lineage)).toBe(true);
  });

  it("derives one-to-one lineage and preserves changed and unchanged versions", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const result = normalizeSyntheticFilingFactPair(
      documents.originalDocument,
      documents.amendmentDocument,
    );
    if (result.status !== "normalized") throw new Error("expected normalized");
    for (let index = 0; index < 10; index += 1) {
      const predecessor = result.factVersions[index];
      const successor = result.factVersions[index + 10];
      const edge = result.lineage[index];
      expect(predecessor?.successorFactId).toBe(successor?.factId);
      expect(successor?.predecessorFactId).toBe(predecessor?.factId);
      expect(edge).toEqual({
        effectiveAt: "2026-03-15T20:00:01.000Z",
        key: predecessor?.key,
        predecessorFactId: predecessor?.factId,
        successorFactId: successor?.factId,
      });
    }
    const unchangedCash = result.factVersions.filter(
      (fact) => fact.key === "cash",
    );
    const changedRevenue = result.factVersions.filter(
      (fact) => fact.key === "revenue",
    );
    expect(unchangedCash.map((fact) => fact.value)).toEqual([
      "24000000",
      "24000000",
    ]);
    expect(new Set(unchangedCash.map((fact) => fact.factId))).toHaveLength(2);
    expect(changedRevenue.map((fact) => fact.value)).toEqual([
      "120000000",
      "116400000",
    ]);
  });

  it("projects half-open as-known windows at the exact availability boundary", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const result = normalizeSyntheticFilingFactPair(
      documents.originalDocument,
      documents.amendmentDocument,
    );
    if (result.status !== "normalized") throw new Error("expected normalized");
    expect(
      projectNormalizedFilingFactsAsKnown(result, "2026-02-20T20:00:00.999Z"),
    ).toEqual([]);
    const original = projectNormalizedFilingFactsAsKnown(
      result,
      "2026-02-20T20:00:01.000Z",
    );
    expect(original).toHaveLength(10);
    expect(
      original.every((fact) => fact.sourceAccession.endsWith("000001")),
    ).toBe(true);
    const beforeAmendment = projectNormalizedFilingFactsAsKnown(
      result,
      "2026-03-15T20:00:00.999Z",
    );
    expect(beforeAmendment.map((fact) => fact.factId)).toEqual(
      original.map((fact) => fact.factId),
    );
    const amended = projectNormalizedFilingFactsAsKnown(
      result,
      "2026-03-15T20:00:01.000Z",
    );
    expect(amended).toHaveLength(10);
    expect(
      amended.every((fact) => fact.sourceAccession.endsWith("000002")),
    ).toBe(true);
    expect(() =>
      projectNormalizedFilingFactsAsKnown(result, "2026-03-15T20:00:01Z"),
    ).toThrow(FilingFactProjectionError);
  });

  it("is deterministic while returning fresh records from owned byte snapshots", () => {
    const firstDocuments = buildSyntheticFilingFactDocuments();
    const secondDocuments = buildSyntheticFilingFactDocuments();
    expect(firstDocuments.originalDocument).not.toBe(
      secondDocuments.originalDocument,
    );
    expect(firstDocuments.amendmentDocument).not.toBe(
      secondDocuments.amendmentDocument,
    );
    const first = normalizeSyntheticFilingFactPair(
      firstDocuments.originalDocument,
      firstDocuments.amendmentDocument,
    );
    const second = normalizeSyntheticFilingFactPair(
      secondDocuments.originalDocument,
      secondDocuments.amendmentDocument,
    );
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    firstDocuments.originalDocument.fill(0);
    firstDocuments.amendmentDocument.fill(0);
    expect(first).toEqual(second);
  });

  it("quarantines a mutated or incomplete pair with empty value-free arrays", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const amendment = decodeSyntheticFilingFactDocument(
      documents.amendmentDocument,
    );
    const facts = amendment.facts as Array<Record<string, unknown>>;
    facts.pop();
    const result = normalizeSyntheticFilingFactPair(
      documents.originalDocument,
      canonicalSyntheticFilingFactDocument(amendment),
    );
    expect(result).toEqual({
      audit: {
        factVersionCount: 0,
        lineageCount: 0,
        outcome: "quarantined",
      },
      claim: FILING_FACT_NORMALIZATION_CLAIM,
      code: "fact_set_invalid",
      factVersions: [],
      lineage: [],
      schemaVersion: FILING_FACT_NORMALIZATION_SCHEMA_VERSION,
      status: "quarantined",
      synthetic: true,
    });
    expect(JSON.stringify(result)).not.toContain("SYN-");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.factVersions)).toBe(true);
  });

  it("rejects cross-context, chronology, period, and decimal drift without repair", () => {
    const mutators: Array<(document: Record<string, unknown>) => void> = [
      (document) => {
        document.instrumentId = "instrument.synthetic.other";
      },
      (document) => {
        document.acceptedAt = "2026-02-20T20:00:00.000Z";
      },
      (document) => {
        const facts = document.facts as Array<Record<string, unknown>>;
        if (facts[0] !== undefined) facts[0].periodEnd = "2024-12-31";
      },
      (document) => {
        const facts = document.facts as Array<Record<string, unknown>>;
        if (facts[9] !== undefined) facts[9].value = "1e8";
      },
    ];
    for (const mutate of mutators) {
      const documents = buildSyntheticFilingFactDocuments();
      const amendment = decodeSyntheticFilingFactDocument(
        documents.amendmentDocument,
      );
      mutate(amendment);
      const result = normalizeSyntheticFilingFactPair(
        documents.originalDocument,
        canonicalSyntheticFilingFactDocument(amendment),
      );
      expect(result.status).toBe("quarantined");
      if (result.status === "quarantined") {
        expect(result.factVersions).toEqual([]);
        expect(result.lineage).toEqual([]);
      }
    }
  });

  it("rejects a third runtime argument and pair-wide reporting-context drift", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const extraArgument = normalizeSyntheticFilingFactPair(
      documents.originalDocument,
      documents.amendmentDocument,
      // @ts-expect-error Runtime arity is part of the closed two-document API.
      documents.originalDocument,
    );
    expect(extraArgument.status).toBe("quarantined");
    if (extraArgument.status === "quarantined") {
      expect(extraArgument.code).toBe("document_invalid");
    }

    const original = decodeSyntheticFilingFactDocument(
      documents.originalDocument,
    );
    const amendment = decodeSyntheticFilingFactDocument(
      documents.amendmentDocument,
    );
    for (const document of [original, amendment]) {
      const facts = document.facts as Array<Record<string, unknown>>;
      if (facts[0] !== undefined) facts[0].periodEnd = "2025-12-30";
    }
    const crossContext = normalizeSyntheticFilingFactPair(
      canonicalSyntheticFilingFactDocument(original),
      canonicalSyntheticFilingFactDocument(amendment),
    );
    expect(crossContext.status).toBe("quarantined");
    if (crossContext.status === "quarantined") {
      expect(crossContext.code).toBe("lineage_invalid");
      expect(crossContext.factVersions).toEqual([]);
      expect(crossContext.lineage).toEqual([]);
    }
  });

  it("binds accession issuer/year metadata and full source-document fact identity", () => {
    const documents = buildSyntheticFilingFactDocuments();
    const wrongIssuer = decodeSyntheticFilingFactDocument(
      documents.amendmentDocument,
    );
    wrongIssuer.accession = "SYN-0000000002-26-000002";
    const issuerResult = normalizeSyntheticFilingFactPair(
      documents.originalDocument,
      canonicalSyntheticFilingFactDocument(wrongIssuer),
    );
    expect(issuerResult.status).toBe("quarantined");
    if (issuerResult.status === "quarantined") {
      expect(issuerResult.code).toBe("lineage_invalid");
    }

    const wrongYear = decodeSyntheticFilingFactDocument(
      documents.originalDocument,
    );
    wrongYear.accession = "SYN-0000000001-25-000001";
    const yearResult = normalizeSyntheticFilingFactPair(
      canonicalSyntheticFilingFactDocument(wrongYear),
      documents.amendmentDocument,
    );
    expect(yearResult.status).toBe("quarantined");
    if (yearResult.status === "quarantined") {
      expect(yearResult.code).toBe("source_metadata_invalid");
    }

    const shiftedOriginal = decodeSyntheticFilingFactDocument(
      documents.originalDocument,
    );
    shiftedOriginal.acceptedAt = "2026-02-20T20:00:02.000Z";
    shiftedOriginal.availableAt = "2026-02-20T20:00:03.000Z";
    const shifted = normalizeSyntheticFilingFactPair(
      canonicalSyntheticFilingFactDocument(shiftedOriginal),
      documents.amendmentDocument,
    );
    const baseline = normalizeSyntheticFilingFactPair(
      documents.originalDocument,
      documents.amendmentDocument,
    );
    expect(shifted.status).toBe("normalized");
    expect(baseline.status).toBe("normalized");
    if (shifted.status === "normalized" && baseline.status === "normalized") {
      expect(shifted.factVersions[0]?.factId).not.toBe(
        baseline.factVersions[0]?.factId,
      );
    }
  });
});
