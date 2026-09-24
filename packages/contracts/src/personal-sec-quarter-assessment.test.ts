import { describe, expect, it } from "vitest";
import {
  isPersonalSecQuarterAssessmentInput,
  isPersonalSecQuarterAssessmentRequest,
  isPersonalSecQuarterAssessmentResponse,
  isPersonalSecQuarterEvidence,
  isPersonalSecQuarterPrimaryEvidence,
  personalSecQuarterBundlePayload,
  type PersonalSecQuarterAssessmentInputDto,
  type PersonalSecQuarterAssessmentRequestDto,
  type PersonalSecQuarterAssessmentTargetDto,
  type PersonalSecQuarterAssessmentResponseDto,
} from "./personal-sec-quarter-assessment";
import { PERSONAL_SEC_QUARTERLY_CONCEPTS as concepts } from "./personal-sec-quarterly-evidence";
import { PERSONAL_SEC_FILING_REPORTING_CONCEPTS as metadataConcepts } from "./personal-sec-filing-context";

const sha = `sha256:${"a".repeat(64)}` as const;
const selection = {
  accessionNumber: "0000000001-26-000001",
  form: "10-Q",
  filedDate: "2026-04-15",
  reportDate: "2026-03-31",
} as const;
const target: PersonalSecQuarterAssessmentTargetDto = {
  catalogSnapshotSha256: sha,
  security: {
    country: "US",
    exchangeMic: "XNYS",
    issuerName: "Synthetic Company",
    listingId: "listing:synthetic",
    securityName: "Synthetic Common",
    symbol: "SYN",
    issuerId: "issuer:synthetic",
    cik: "0000000001",
  },
};
const request: PersonalSecQuarterAssessmentRequestDto = {
  schemaVersion: "1.0.0",
  catalogSnapshotSha256: sha,
  listingId: target.security.listingId,
  symbol: "SYN",
  selection,
};
function fixture(): PersonalSecQuarterAssessmentInputDto {
  const sources = [
    {
      id: "submissions",
      sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
    },
    {
      id: "company_facts",
      sourceUrl:
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
    },
    {
      id: "primary",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/synthetic.htm",
    },
  ].map((s) => ({
    ...s,
    sha256: sha,
    bytes: 1,
    retrievalStartedAt: "2026-04-16T00:00:00.000Z",
    retrievalCompletedAt: "2026-04-16T00:00:00.000Z",
  })) as PersonalSecQuarterAssessmentInputDto["sources"];
  return {
    cik: target.security.cik,
    selection,
    sources,
    evidence: {
      schemaVersion: "1.0.0",
      submission: {
        id: "submissions:selected",
        sourceId: "submissions",
        rowIndex: 0,
        matchingRowIndices: [0],
        ...selection,
        acceptedAt: null,
        primaryDocument: "synthetic.htm",
      },
      companyFacts: {
        schemaVersion: "1.0.0",
        sourceSha256: sha,
        cik: target.security.cik,
        accessionNumber: selection.accessionNumber,
        inspectedRows: 0,
        otherAccessionRows: 0,
        populations: concepts.map((concept) => ({
          concept,
          present: false,
          units: [],
          inspectedRows: 0,
          otherAccessionRows: 0,
          retainedIds: [],
        })),
        occurrences: [],
      },
      primary: {
        schemaVersion: "1.0.0",
        mode: "accession_evidence",
        documentSha256: sha,
        documentBytes: 1,
        cik: target.security.cik,
        selection,
        status: "complete",
        reason: null,
        concepts: concepts.map((concept) => ({ concept, occurrences: [] })),
        contexts: [],
        units: [],
        reportingMetadata: {
          fields: metadataConcepts.map((concept) => ({
            concept,
            status: "missing",
            value: null,
            observationIds: [],
          })),
          observations: [],
        },
        structure: {
          profileVersion: "sparse-source-1.0.0",
          status: "complete",
          reasons: [],
          document: {
            elementCount: 1,
            styleElements: 0,
            stylesheetLinks: 0,
            processingInstructions: [],
            scripts: [],
            eventAttributeCount: 0,
          },
          records: [],
          siblingWindows: [],
          tables: [],
          supplementaryFacts: [],
          anchorRecordIds: [],
        },
      },
    },
  };
}
function heldResponse(): PersonalSecQuarterAssessmentResponseDto {
  const input = fixture();
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: sha,
    security: target.security,
    assessment: {
      status: "held",
      stage: "assessment",
      cik: input.cik,
      selection,
      acceptedAt: "2026-04-16T00:00:00.000Z",
      bundleId: sha,
      sources: input.sources,
      evidence: input.evidence,
      analysis: {
        schemaVersion: "1.0.0",
        predicates: [],
        witnesses: [],
        concepts: concepts.map((concept) => ({
          concept,
          status: "absent",
          reasons: ["concept_absent"],
          companyFactsRefs: [],
          primaryRefs: [],
          memberships: [],
          predicateIds: [],
          witnessIds: [],
        })),
        metrics: (["revenue", "net_income"] as const).map((metric) => ({
          metric,
          status: "held" as const,
          reasons: ["no_current_company_facts_row" as const],
          concept: null,
          witnessIds: [],
          value: null,
          unit: null,
          period: null,
        })),
        pair: {
          status: "held",
          reasons: ["metric_not_supported"],
          revenue: null,
          netIncome: null,
          unit: null,
          period: null,
        },
        ttm: { status: "unavailable", reason: "source_not_admitted" },
      },
    },
  };
}

describe("selected-quarter request and source graph", () => {
  it("accepts a source-complete empty population without calling it a zero quarter", () => {
    expect(isPersonalSecQuarterAssessmentInput(fixture())).toBe(true);
    expect(
      isPersonalSecQuarterAssessmentResponse(heldResponse(), request),
    ).toBe(true);
  });
  it.each(["cik", "value", "supported", "sourceUrl", "evidence"])(
    "rejects caller proof/amount/source key %s",
    (key) =>
      expect(
        isPersonalSecQuarterAssessmentRequest({ ...request, [key]: true }),
      ).toBe(false),
  );
  it("keeps amendments and missing report dates as early hold selections", () => {
    expect(
      isPersonalSecQuarterAssessmentRequest({
        ...request,
        selection: { ...selection, form: "10-Q/A" },
      }),
    ).toBe(true);
    expect(
      isPersonalSecQuarterAssessmentRequest({
        ...request,
        selection: { ...selection, reportDate: null },
      }),
    ).toBe(true);
    expect(
      isPersonalSecQuarterAssessmentRequest({
        ...request,
        selection: { ...selection, reportDate: "2026-02-30" },
      }),
    ).toBe(false);
  });
  it("binds every identity field but ignores JSON object key order", () => {
    const input = fixture();
    const baseline = personalSecQuarterBundlePayload(
      target,
      selection,
      input.sources,
    );
    const reordered = {
      security: Object.fromEntries(Object.entries(target.security).reverse()),
      catalogSnapshotSha256: sha,
    } as PersonalSecQuarterAssessmentTargetDto;
    expect(
      personalSecQuarterBundlePayload(reordered, selection, input.sources),
    ).toBe(baseline);
    expect(
      personalSecQuarterBundlePayload(
        {
          ...target,
          security: { ...target.security, securityName: "Different Common" },
        },
        selection,
        input.sources,
      ),
    ).not.toBe(baseline);
  });
  it("rejects reversed capture order, mismatched digests and changed primary filename", () => {
    const input = fixture();
    expect(
      isPersonalSecQuarterAssessmentInput({
        ...input,
        sources: [...input.sources].reverse(),
      }),
    ).toBe(false);
    const primary = {
      ...input.evidence.primary,
      documentSha256: `sha256:${"b".repeat(64)}`,
    };
    expect(
      isPersonalSecQuarterAssessmentInput({
        ...input,
        evidence: { ...input.evidence, primary },
      }),
    ).toBe(false);
    expect(
      isPersonalSecQuarterAssessmentInput({
        ...input,
        evidence: {
          ...input.evidence,
          submission: {
            ...input.evidence.submission,
            primaryDocument: "other.htm",
          },
        },
      }),
    ).toBe(false);
  });
  it("rejects a partial four-concept prefix and fabricated absence counters", () => {
    const input = fixture();
    expect(
      isPersonalSecQuarterEvidence({
        ...input.evidence,
        primary: {
          ...input.evidence.primary,
          concepts: input.evidence.primary.concepts.slice(0, 3),
        },
      }),
    ).toBe(false);
    expect(
      isPersonalSecQuarterEvidence({
        ...input.evidence,
        companyFacts: { ...input.evidence.companyFacts, inspectedRows: 1 },
      }),
    ).toBe(false);
  });
  it("keeps an empty typed failure separate from complete numeric evidence", () => {
    const primary = fixture().evidence.primary;
    const failure = {
      ...primary,
      status: "unavailable",
      reason: "structural_limit",
      concepts: [],
      contexts: [],
      units: [],
      reportingMetadata: null,
      structure: null,
    };
    expect(isPersonalSecQuarterPrimaryEvidence(failure)).toBe(true);
    expect(
      isPersonalSecQuarterPrimaryEvidence({
        ...failure,
        concepts: primary.concepts,
      }),
    ).toBe(false);
    expect(
      isPersonalSecQuarterPrimaryEvidence({
        ...primary,
        reason: "structural_limit",
      }),
    ).toBe(false);
  });
  it("rejects dangling structure edges and invented parent coverage", () => {
    const primary = fixture().evidence.primary;
    expect(
      isPersonalSecQuarterPrimaryEvidence({
        ...primary,
        structure: { ...primary.structure, anchorRecordIds: ["e:99"] },
      }),
    ).toBe(false);
    expect(
      isPersonalSecQuarterPrimaryEvidence({
        ...primary,
        structure: {
          ...primary.structure,
          siblingWindows: [
            { parentRecordId: "e:1", firstChildIndex: 0, childRecordIds: [] },
          ],
        },
      }),
    ).toBe(false);
  });
  it("rejects admitted fields in a held metric and an unbacked supported pair", () => {
    const response = heldResponse();
    if (response.assessment.stage !== "assessment") throw new Error("fixture");
    const analysis = response.assessment.analysis;
    expect(
      isPersonalSecQuarterAssessmentResponse(
        {
          ...response,
          assessment: {
            ...response.assessment,
            analysis: {
              ...analysis,
              metrics: [
                { ...analysis.metrics[0], value: "0" },
                analysis.metrics[1],
              ],
            },
          },
        },
        request,
      ),
    ).toBe(false);
    expect(
      isPersonalSecQuarterAssessmentResponse(
        {
          ...response,
          assessment: {
            ...response.assessment,
            status: "supported_as_filed",
            analysis: {
              ...analysis,
              pair: {
                status: "supported_as_filed",
                reasons: [],
                revenue: "0",
                netIncome: "0",
                unit: "USD",
                period: { startDate: "2026-01-01", endDate: "2026-03-31" },
              },
            },
          },
        },
        request,
      ),
    ).toBe(false);
  });
  it("refuses a response after selection identity or TTM meaning changes", () => {
    const response = heldResponse();
    expect(
      isPersonalSecQuarterAssessmentResponse(
        { ...response, security: { ...response.security, symbol: "OTHER" } },
        request,
      ),
    ).toBe(false);
    if (response.assessment.stage !== "assessment") throw new Error("fixture");
    expect(
      isPersonalSecQuarterAssessmentResponse(
        {
          ...response,
          assessment: {
            ...response.assessment,
            analysis: {
              ...response.assessment.analysis,
              ttm: { status: "available", reason: "source_not_admitted" },
            },
          },
        },
        request,
      ),
    ).toBe(false);
  });
});

function observedFactGraph() {
  const base = fixture().evidence.primary;
  const qname = (raw: string, namespace: string, localName: string) => ({
    raw,
    namespace,
    localName,
  });
  const root = {
    id: "e:1",
    elementOrdinal: 1,
    endElementOrdinal: 2,
    name: qname("html", "http://www.w3.org/1999/xhtml", "html"),
    attributes: [],
    parentRecordId: null,
    parentElementOrdinal: null,
    childIndex: 0,
    elementChildCount: 1,
    descendantTableCount: 0,
    descendantTableOrdinals: [],
    textRuns: null,
    childRecordIds: ["e:2"],
    childrenComplete: true,
    actualTableOrdinal: null,
    actualRowOrdinal: null,
    actualCellOrdinal: null,
  };
  const source = {
    ...root,
    id: "e:2",
    elementOrdinal: 2,
    endElementOrdinal: 2,
    name: qname(
      "ix:nonFraction",
      "http://www.xbrl.org/2013/inlineXBRL",
      "nonFraction",
    ),
    attributes: [
      {
        name: "name",
        namespace: null,
        localName: "name",
        value: "us-gaap:Revenues",
      },
    ],
    parentRecordId: "e:1",
    parentElementOrdinal: 1,
    elementChildCount: 0,
    childRecordIds: [],
    textRuns: [{ beforeChildIndex: 0, text: "1" }],
  };
  const fact = {
    id: "f:2",
    elementOrdinal: 2,
    locator: "/elements/2",
    factId: null,
    concept: qname(
      "us-gaap:Revenues",
      "http://fasb.org/us-gaap/2025",
      "Revenues",
    ),
    rawContextRef: null,
    contextRecordId: null,
    rawUnitRef: null,
    unitRecordId: null,
    rawText: "1",
    format: null,
    sign: null,
    scale: null,
    decimals: null,
    precision: null,
    value: "1",
    issues: ["unresolved_context", "unresolved_unit"],
    elementRecordId: "e:2",
    actualTableOrdinal: null,
    actualRowOrdinal: null,
    actualCellOrdinal: null,
  };
  return {
    ...base,
    concepts: concepts.map((concept) => ({
      concept,
      occurrences: concept === "Revenues" ? [fact] : [],
    })),
    structure: {
      ...base.structure!,
      document: { ...base.structure!.document, elementCount: 2 },
      records: [root, source],
    },
  };
}

describe("original primary source joins", () => {
  it("preserves unsupported source facts while binding the projected text", () => {
    const graph = observedFactGraph();
    expect(isPersonalSecQuarterPrimaryEvidence(graph)).toBe(true);
    const altered = {
      ...graph,
      concepts: graph.concepts.map((p) => ({
        ...p,
        occurrences: p.occurrences.map((f) => ({ ...f, rawText: "2" })),
      })),
    };
    expect(isPersonalSecQuarterPrimaryEvidence(altered)).toBe(false);
  });
  it("rejects invented inline sign and context attributes on the same element", () => {
    const graph = observedFactGraph();
    for (const change of [{ sign: "-" }, { rawContextRef: "invented" }]) {
      expect(
        isPersonalSecQuarterPrimaryEvidence({
          ...graph,
          concepts: graph.concepts.map((p) => ({
            ...p,
            occurrences: p.occurrences.map((f) => ({ ...f, ...change })),
          })),
        }),
      ).toBe(false);
    }
  });
  it("rejects source ordinals outside the complete document", () => {
    const graph = observedFactGraph();
    expect(
      isPersonalSecQuarterPrimaryEvidence({
        ...graph,
        concepts: graph.concepts.map((p) => ({
          ...p,
          occurrences: p.occurrences.map((f) => ({
            ...f,
            id: "f:9",
            elementOrdinal: 9,
            locator: "/elements/9",
            elementRecordId: null,
          })),
        })),
      }),
    ).toBe(false);
  });
  it("keeps a source-unprojected occurrence without creating a visible witness", () => {
    const graph = observedFactGraph();
    const unprojected = {
      ...graph,
      concepts: graph.concepts.map((p) => ({
        ...p,
        occurrences: p.occurrences.map((f) => ({
          ...f,
          elementRecordId: null,
        })),
      })),
    };
    expect(isPersonalSecQuarterPrimaryEvidence(unprojected)).toBe(true);
  });
});
