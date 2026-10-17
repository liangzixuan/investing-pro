import { createHash } from "node:crypto";
import { PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY } from "@research-cockpit/contracts";
import type { PersonalSecAnnualCanonicalInput } from "./personal-sec-annual-canonical-evidence";
import { normalizePersonalSecAnnualStatementCompanyFacts } from "./personal-sec-annual-statement-company-facts";
import {
  normalizePersonalSecSubmissions,
  parsePersonalSecSourceJson,
} from "./personal-sec-quarterly-evidence-provider";

export const CIK = "0000000042";
export const ACCESSION = "0000999999-26-000001";
export const OTHER = "0000999999-25-000001";
export const OCF = "NetCashProvidedByUsedInOperatingActivities";
export function sha(text: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}
export function flow(overrides: Record<string, unknown> = {}) {
  return {
    start: "2025-01-01",
    end: "2025-12-31",
    val: 100.125,
    fy: 2025,
    fp: "FY",
    form: "10-K",
    filed: "2026-02-01",
    accn: ACCESSION,
    ...overrides,
  };
}
export function fixture(rows?: readonly unknown[]): {
  input: PersonalSecAnnualCanonicalInput;
  companyText: string;
  submissionsText: string;
} {
  const companyText = JSON.stringify({
    cik: 42,
    facts: {
      "us-gaap": {
        Revenues: {
          units: {
            USD: [
              flow({ val: "UNSAFE_REVENUE" }),
              flow({ val: "UNSAFE_REVENUE" }),
              flow({ start: "2024-01-01", end: "2024-12-31", val: 800 }),
            ],
          },
        },
        NetIncomeLoss: { units: { USD: [flow({ val: "UNSAFE_INCOME" })] } },
        [OCF]: { units: { USD: rows ?? [flow()] } },
        StockholdersEquity: {
          units: {
            USD: [flow({ start: undefined, val: -7.5, frame: "CY2025Q4I" })],
          },
        },
      },
    },
  })
    .replaceAll('"UNSAFE_REVENUE"', "900719925474099312345.000000000000000001")
    .replaceAll('"UNSAFE_INCOME"', "-900719925474099312345.000000000000000001");
  return sourceFixture(companyText);
}

/** Real source JSON normalization; no unsafe source number passes through Number. */
export function sourceFixture(companyText: string): {
  input: PersonalSecAnnualCanonicalInput;
  companyText: string;
  submissionsText: string;
} {
  const submissionsText = JSON.stringify({
    cik: 42,
    filings: {
      recent: {
        accessionNumber: [ACCESSION],
        form: ["10-K"],
        filingDate: ["2026-02-01"],
        reportDate: ["2025-12-31"],
        acceptanceDateTime: ["2026-02-01T12:00:00.000Z"],
      },
      files: [],
    },
  });
  const input: PersonalSecAnnualCanonicalInput = {
    cik: CIK,
    generation: {
      definitionVersion: "6.0.0",
      cutoffAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:03.000Z",
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`,
          fetchedAt: "2026-09-20T00:00:02.000Z",
          sha256: sha(companyText),
          bytes: Buffer.byteLength(companyText),
        },
        submissions: {
          status: "available",
          sourceUrl: `https://data.sec.gov/submissions/CIK${CIK}.json`,
          fetchedAt: "2026-09-20T00:00:01.000Z",
          sha256: sha(submissionsText),
          bytes: Buffer.byteLength(submissionsText),
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: ACCESSION,
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T12:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    facts: normalizePersonalSecAnnualStatementCompanyFacts(
      parsePersonalSecSourceJson(companyText),
      CIK,
      ACCESSION,
    ),
    submissions: normalizePersonalSecSubmissions(
      parsePersonalSecSourceJson(submissionsText),
      CIK,
    ),
  };
  return { input, companyText, submissionsText };
}

/** All 32 concepts at the selected-row bound, including JSON-escaped metadata. */
export function capacityFixture(escapedMetadata = false, rowsPerConcept = 100) {
  if (
    !Number.isInteger(rowsPerConcept) ||
    rowsPerConcept < 1 ||
    rowsPerConcept > 100
  )
    throw new RangeError("Invalid invented fixture row count.");
  const concepts = Object.fromEntries(
    PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY.map((entry) => [
      entry.concept,
      {
        units: {
          USD: Array.from({ length: rowsPerConcept }, (_, index) =>
            flow({
              start: entry.periodType === "instant" ? undefined : "2025-01-01",
              val: index - 50,
              fp: escapedMetadata ? '\\"'.repeat(16) : "FY",
              frame: escapedMetadata ? '\\"'.repeat(64) : null,
            }),
          ),
        },
      },
    ]),
  );
  return sourceFixture(
    JSON.stringify({ cik: 42, facts: { "us-gaap": concepts } }),
  );
}
