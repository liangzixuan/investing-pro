import { beforeAll, describe, expect, it } from "vitest";
import {
  parseManagedSecFilingsResponse,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { annualReportPacket as annualComparisonResponse } from "./test-annual-report-fixture";
import { getManagedAnnualView } from "./managed-annual-view";
import type { ManagedAnnualReportState } from "./managed-annual-report";
import type { ManagedCompanyFilingsState } from "./managed-company-filings";
import { getManagedFilingsAnnualBaseline } from "./managed-filings-annual-baseline";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";

let response: PersonalSecAnnualCanonicalResponseDto;
beforeAll(async () => {
  response = await annualComparisonResponse();
});

function snapshots(annualResponse = response) {
  const raw = filingsResponse();
  const checked = parseManagedSecFilingsResponse(raw, {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: raw.catalogSnapshotSha256,
    listingId: raw.security.listingId,
    symbol: raw.security.symbol,
  });
  if (!checked) throw new Error("Invalid invented filings packet");
  const annual: ManagedAnnualReportState = {
    supported: true,
    selection: {
      ...filingsSelection,
      listing: { ...filingsSelection.listing },
    },
    response: annualResponse,
    view: getManagedAnnualView(annualResponse),
    responseOrigin: "request",
    showingPrevious: false,
    running: false,
    checkingSeed: false,
    catalogChanged: false,
    message: "",
    error: false,
  };
  const filings: ManagedCompanyFilingsState = {
    supported: true,
    selection: filingsSelection,
    response: checked,
    responseOrigin: "request",
    refreshComparison: null,
    lastCheck: checked,
    showingPrevious: false,
    running: false,
    catalogChanged: false,
    message: "",
    error: false,
  };
  return { annual, filings, checked };
}

describe("current Annual filing baseline", () => {
  it("joins distinct schemas and keeps the exact admitted response and target", () => {
    const { annual, filings } = snapshots();
    expect(annual.response?.schemaVersion).toBe("6.0.0");
    expect(filings.response?.schemaVersion).toBe("1.0.0");
    const baseline = getManagedFilingsAnnualBaseline(annual, filings);
    expect(baseline?.response).toBe(response);
    expect(baseline?.target).toBe(response.evidence.target);
    expect(baseline?.target.filedDate).toBe("2026-02-01");
  });

  it("reads resolved filing metadata without requiring a financial view", () => {
    const { annual, filings } = snapshots();
    expect(
      getManagedFilingsAnnualBaseline({ ...annual, view: null }, filings)
        ?.response,
    ).toBe(response);
    expect(
      getManagedFilingsAnnualBaseline({ ...annual, view: null }, filings)
        ?.target,
    ).toBe(response.evidence.target);
  });

  it.each([
    "current-use-unavailable",
    "income-invalid",
    "source-unavailable",
  ] as const)(
    "admits a resolved target with %s financial evidence",
    async (mode) => {
      const { annual, filings } = snapshots(
        await annualComparisonResponse("left", { mode }),
      );
      expect(getManagedFilingsAnnualBaseline(annual, filings)?.response).toBe(
        annual.response,
      );
    },
  );

  it("retains the baseline during refresh, cancellation, failed checks and comparison-seeded visits", () => {
    const { annual, filings } = snapshots();
    const retainedAnnual = {
      ...annual,
      running: true,
      showingPrevious: true,
      error: true,
      responseOrigin: "watchlist-comparison" as const,
    };
    const retainedFilings = {
      ...filings,
      running: true,
      showingPrevious: true,
      error: true,
      lastCheck: filingsResponse(0, "rate_limited"),
    };
    expect(
      getManagedFilingsAnnualBaseline(retainedAnnual, retainedFilings)
        ?.response,
    ).toBe(response);
    expect(
      getManagedFilingsAnnualBaseline(
        { ...retainedAnnual, running: false },
        { ...retainedFilings, running: false },
      )?.response,
    ).toBe(response);
  });

  it("allows unknown selection CIKs only when the admitted response CIKs agree", () => {
    const { annual, filings } = snapshots();
    const selection = {
      ...filingsSelection,
      cik: null,
      origin: "watchlist" as const,
    };
    expect(
      getManagedFilingsAnnualBaseline(
        { ...annual, selection },
        { ...filings, selection },
      )?.response,
    ).toBe(response);
  });

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)("refuses a stale full selection field: %s", (field) => {
    const { annual, filings } = snapshots();
    const selection = {
      ...filingsSelection,
      listing: { ...filingsSelection.listing, [field]: "different" },
    };
    expect(
      getManagedFilingsAnnualBaseline({ ...annual, selection }, filings),
    ).toBeNull();
    expect(
      getManagedFilingsAnnualBaseline(annual, { ...filings, selection }),
    ).toBeNull();
  });

  it.each([
    "country",
    "exchangeMic",
    "issuerId",
    "issuerName",
    "listingId",
    "securityName",
    "symbol",
  ] as const)(
    "refuses an Annual response that disagrees with its selection at %s",
    (field) => {
      const { annual, filings } = snapshots();
      expect(
        getManagedFilingsAnnualBaseline(
          {
            ...annual,
            response: {
              ...response,
              security: { ...response.security, [field]: "different" },
            },
          },
          filings,
        ),
      ).toBeNull();
    },
  );

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "refuses a Filings response that disagrees with its selection at %s",
    (field) => {
      const { annual, filings, checked } = snapshots();
      expect(
        getManagedFilingsAnnualBaseline(annual, {
          ...filings,
          response: {
            ...checked,
            security: { ...checked.security, [field]: "different" },
          },
        }),
      ).toBeNull();
    },
  );

  it("refuses each independent catalog and CIK mismatch", () => {
    const { annual, filings, checked } = snapshots();
    const catalogSnapshotSha256 = `sha256:${"b".repeat(64)}` as const;
    const cik = "0000000002";
    const annualChanges: ManagedAnnualReportState[] = [
      { ...annual, selection: { ...filingsSelection, catalogSnapshotSha256 } },
      { ...annual, response: { ...response, catalogSnapshotSha256 } },
      { ...annual, selection: { ...filingsSelection, cik } },
      {
        ...annual,
        response: { ...response, security: { ...response.security, cik } },
      },
      {
        ...annual,
        response: { ...response, evidence: { ...response.evidence, cik } },
      },
    ];
    for (const changed of annualChanges)
      expect(getManagedFilingsAnnualBaseline(changed, filings)).toBeNull();
    const filingsChanges: ManagedCompanyFilingsState[] = [
      { ...filings, selection: { ...filingsSelection, catalogSnapshotSha256 } },
      { ...filings, response: { ...checked, catalogSnapshotSha256 } },
      { ...filings, selection: { ...filingsSelection, cik } },
      {
        ...filings,
        response: { ...checked, security: { ...checked.security, cik } },
      },
      {
        ...filings,
        response: { ...checked, issuer: { ...checked.issuer, cik } },
      },
    ];
    for (const changed of filingsChanges)
      expect(getManagedFilingsAnnualBaseline(annual, changed)).toBeNull();
  });

  it("refuses missing or retired selections/packets and changed catalogs", () => {
    const { annual, filings } = snapshots();
    for (const change of [
      { selection: null },
      { response: null },
      { catalogChanged: true },
    ]) {
      expect(
        getManagedFilingsAnnualBaseline({ ...annual, ...change }, filings),
      ).toBeNull();
      expect(
        getManagedFilingsAnnualBaseline(annual, { ...filings, ...change }),
      ).toBeNull();
    }
  });

  it("refuses unresolved Annual targets and unavailable Filings packets, but accepts loaded empty rows", () => {
    const { annual, filings } = snapshots();
    expect(
      getManagedFilingsAnnualBaseline(
        {
          ...annual,
          response: {
            ...response,
            evidence: {
              ...response.evidence,
              target: {
                status: "unresolved",
                reason: "no_observed_annual_target",
              },
            },
          },
        },
        filings,
      ),
    ).toBeNull();
    for (const status of [
      "not_covered",
      "invalid_response",
      "upstream_unavailable",
      "rate_limited",
    ] as const)
      expect(
        getManagedFilingsAnnualBaseline(annual, {
          ...filings,
          response: filingsResponse(0, status),
        }),
      ).toBeNull();
    expect(
      getManagedFilingsAnnualBaseline(annual, {
        ...filings,
        response: filingsResponse(0),
      })?.response,
    ).toBe(response);
  });
});
