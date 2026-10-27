import {
  PERSONAL_SEC_INTERIM_STATEMENT_REGISTRY as registry,
  serializePersonalSecInterimStatementObservation,
  type PersonalSecInterimCanonicalResponseDto as Response,
  type PersonalSecInterimCanonicalEvidenceDto as Evidence,
  type PersonalSecInterimStatementObservationDto as Row,
} from "@research-cockpit/contracts";
import { serializePersonalSecInterimCanonicalGeneration } from "./personal-sec-interim-serialization";
const emptyHash = `sha256:${"0".repeat(64)}` as const;
export async function fixtureHash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function sealFixture(evidence: Evidence): Promise<Evidence> {
  const observations = await Promise.all(
    evidence.facts.observations.map(async (row) => ({
      ...row,
      id: `sec-interim-fact:${await fixtureHash(serializePersonalSecInterimStatementObservation(row))}` as const,
    })),
  );
  const positions = new Map(
    registry.map((entry, index) => [entry.concept, index]),
  );
  const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  observations.sort(
    (a, b) =>
      positions.get(a.concept)! - positions.get(b.concept)! ||
      lexical(b.endDate, a.endDate) ||
      lexical(b.startDate ?? "", a.startDate ?? "") ||
      lexical(b.filedDate, a.filedDate) ||
      lexical(a.accessionNumber, b.accessionNumber) ||
      lexical(a.id, b.id),
  );
  const candidate = { ...evidence, facts: { ...evidence.facts, observations } };
  return {
    ...candidate,
    generation: {
      ...candidate.generation,
      sha256: `sha256:${await fixtureHash(serializePersonalSecInterimCanonicalGeneration(candidate))}`,
    },
  };
}
function fixtureTarget() {
  return {
    status: "target",
    accessionNumber: "0000000001-26-000002",
    form: "10-Q",
    filedDate: "2026-07-30",
    reportDate: "2026-06-30",
    acceptedAt: "2026-07-30T14:00:00Z",
  } as const;
}
const specs = [
  ["RevenueFromContractWithCustomerExcludingAssessedTax", "40", "2026-04-01"],
  ["RevenueFromContractWithCustomerExcludingAssessedTax", "75", "2026-01-01"],
  ["NetIncomeLoss", "4", "2026-04-01"],
  ["NetIncomeLoss", "7", "2026-01-01"],
  ["Assets", "120", null],
  ["NetCashProvidedByUsedInOperatingActivities", "9", "2026-01-01"],
] as const;
function fixtureObservations(
  security: Response["security"],
  target: ReturnType<typeof fixtureTarget>,
) {
  const counts = new Map<string, number>();
  const observations: Row[] = specs.map(([concept, value, startDate]) => {
    const index = counts.get(concept) ?? 0;
    counts.set(concept, index + 1);
    return {
      id: `sec-interim-fact:${"0".repeat(64)}`,
      taxonomy: "us-gaap",
      concept,
      unit: "USD",
      value,
      startDate,
      endDate: target.reportDate,
      durationDays:
        startDate === null
          ? null
          : (Date.parse(target.reportDate) - Date.parse(startDate)) /
              86_400_000 +
            1,
      periodBasis: "unresolved",
      filingFocusYear: 2026,
      filingFocusPeriod: "Q2",
      frame: null,
      accessionNumber: target.accessionNumber,
      form: target.form,
      filedDate: target.filedDate,
      sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
      filing: {
        status: "matched",
        form: target.form,
        filedDate: target.filedDate,
        reportDate: target.reportDate,
        acceptedAt: target.acceptedAt,
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/${security.cik.replace(/^0+/u, "")}/${target.accessionNumber}-index.htm`,
      },
    };
  });
  return { observations, counts };
}
function fixtureScans(counts: ReadonlyMap<string, number>) {
  return registry.map(({ concept }) => {
    const count = counts.get(concept) ?? 0;
    return {
      concept,
      scan: {
        status: "available" as const,
        absence: count === 0 ? ("concept_missing" as const) : null,
        coverage: {
          full: {
            candidateRows: count,
            inspectedRows: count,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: count,
          },
          selected: count,
          otherAccessions: 0,
          returned: count,
          omittedSelected: 0,
        },
      },
    };
  });
}
function fixtureEvidence(security: Response["security"]) {
  const target = fixtureTarget();
  const { observations, counts } = fixtureObservations(security, target);
  const scans = fixtureScans(counts);
  return sealFixture({
    cik: security.cik,
    target,
    targetScan: {
      currentFilings: 1,
      interimFilings: 1,
      olderHistoryAvailable: true,
    },
    facts: { registryVersion: "1.0.0", scans, observations },
    generation: {
      definitionVersion: "1.0.0",
      cutoffAt: "2026-08-01T12:00:00.000Z",
      completedAt: "2026-08-01T12:00:03.000Z",
      sha256: emptyHash,
      sources: {
        submissions: {
          status: "available",
          sourceUrl: `https://data.sec.gov/submissions/CIK${security.cik}.json`,
          fetchedAt: "2026-08-01T12:00:01.000Z",
          sha256: emptyHash,
          bytes: 100,
        },
        companyFacts: {
          status: "available",
          sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${security.cik}.json`,
          fetchedAt: "2026-08-01T12:00:02.000Z",
          sha256: emptyHash,
          bytes: 200,
        },
      },
    },
  });
}
/** Invented test data only; never exported by the package. No Node/provider imports. */
export async function buildInterimFixture(
  identity?: Pick<Response, "catalogSnapshotSha256" | "security">,
): Promise<Response> {
  const security = identity?.security ?? {
    country: "US",
    exchangeMic: "XNYS",
    issuerId: "issuer:example",
    issuerName: "Example Company",
    listingId: "listing:example:c",
    securityName: "Example Company Class C",
    symbol: "EX.C",
    cik: "0000000001",
  };
  const evidence = await fixtureEvidence(security);
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: identity?.catalogSnapshotSha256 ?? emptyHash,
    security,
    evidence,
  };
}
