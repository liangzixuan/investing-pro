import type {
  PersonalSecQuarterlyEvidenceRequestDto,
  PersonalSecQuarterlyEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPersonalSecQuarterlyEvidence } from "./personal-sec-quarterly-evidence-api";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("SEC quarterly evidence browser client", () => {
  it("uses only the authenticated loopback POST and freezes the exact response", async () => {
    fetchMock.mockResolvedValue(json(response()));
    const controller = new AbortController();
    const result = await fetchPersonalSecQuarterlyEvidence(
      request(),
      controller.signal,
    );
    expect(result).toEqual(response());
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/sec-quarterly-evidence",
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request()),
        signal: controller.signal,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(Object.isFrozen(result.evidence.observations[0]?.filing)).toBe(true);
    expect(Object.isFrozen(result.evidence.coverage.conceptsWithoutUsd)).toBe(
      true,
    );
    expect(result.evidence.observations[0]?.value).toBe(
      "12345678901234567890.12",
    );
  });

  it.each([
    { ...request(), schemaVersion: "2.0.0" },
    { ...request(), catalogSnapshotSha256: "bad" },
    { ...request(), listingId: "https://evil.invalid" },
    { ...request(), symbol: "zero" },
    { ...request(), cik: "0000000001" },
    { ...request(), sourceUrl: "https://data.sec.gov" },
  ])("rejects malformed request %# before network", async (input) => {
    await expect(
      fetchPersonalSecQuarterlyEvidence(
        input as PersonalSecQuarterlyEvidenceRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["extra wrapper fields", () => ({ ...response(), token: "private" })],
    [
      "catalog mismatch",
      () => ({
        ...response(),
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ],
    [
      "listing mismatch",
      () => ({
        ...response(),
        security: { ...response().security, listingId: "lst-other" },
      }),
    ],
    [
      "symbol mismatch",
      () => ({
        ...response(),
        security: { ...response().security, symbol: "OTHER" },
      }),
    ],
    [
      "issuer control text",
      () => ({
        ...response(),
        security: { ...response().security, issuerName: "Private\u0000" },
      }),
    ],
    ["different source CIK", () => evidencePatch({ cik: "0000000002" })],
    [
      "wrong source URL",
      () =>
        evidencePatch({
          sources: {
            ...response().evidence.sources,
            companyFacts: {
              status: "available",
              sourceUrl: "https://evil.invalid",
            },
          },
        }),
    ],
    [
      "invalid fetched date",
      () => evidencePatch({ fetchedAt: "2026-02-30T10:00:00.000Z" }),
    ],
    [
      "unrecognized source status",
      () =>
        evidencePatch({
          sources: {
            ...response().evidence.sources,
            companyFacts: {
              status: "ready",
              sourceUrl: response().evidence.sources.companyFacts.sourceUrl,
            },
          },
        }),
    ],
    [
      "mismatched returned count",
      () => coveragePatch({ returnedObservations: 0 }),
    ],
    ["false truncation", () => coveragePatch({ truncated: true })],
    ["unreconciled counts", () => coveragePatch({ inspectedRows: 2 })],
    [
      "too many candidates",
      () => coveragePatch({ inspectedRows: 20_001, invalidRows: 20_000 }),
    ],
    [
      "missing USD contradicts observation",
      () => coveragePatch({ conceptsWithoutUsd: ["Revenues"] }),
    ],
    [
      "duplicate missing-USD concepts",
      () =>
        coveragePatch({
          conceptsWithoutUsd: ["NetIncomeLoss", "NetIncomeLoss"],
        }),
    ],
    [
      "invented TTM",
      () => evidencePatch({ ttm: { status: "available", value: "10" } }),
    ],
    [
      "observations after failed source",
      () =>
        evidencePatch({
          sources: {
            ...response().evidence.sources,
            companyFacts: {
              ...response().evidence.sources.companyFacts,
              status: "candidate_limit",
            },
          },
        }),
    ],
  ])("rejects invalid response: %s", async (_label, build) => {
    fetchMock.mockResolvedValue(json(build()));
    await expect(
      fetchPersonalSecQuarterlyEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    { id: "not-a-fact" },
    { metric: "net_income" },
    { taxonomy: "custom" },
    { concept: "UnknownRevenue" },
    { unit: "CAD" },
    { value: "1e6" },
    { value: "1.00" },
    { value: "-0" },
    { value: "9".repeat(65) },
    { startDate: "2026-02-30" },
    { startDate: "2026-07-01" },
    { durationDays: 90 },
    { startDate: null, durationDays: 91 },
    { periodBasis: "standalone_quarter" },
    { filingFocusYear: 2026.5 },
    { sourceLocator: "https://evil.invalid" },
    { sourceLocator: "/facts/us-gaap/NetIncomeLoss/units/USD/0" },
    { sourceLocator: "/facts/us-gaap/Revenues/units/USD/20000" },
    { accessionNumber: "../../outside" },
    { filing: { ...observation().filing, sourceUrl: "javascript:alert(1)" } },
    {
      filing: {
        ...observation().filing,
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/2/0000000001-26-000001-index.htm",
      },
    },
    { filing: { ...observation().filing, form: "10-K" } },
    { filing: { ...observation().filing, status: "metadata_conflict" } },
    {
      filing: { ...observation().filing, status: "not_in_current_submissions" },
    },
    { filing: { ...observation().filing, status: "submissions_unavailable" } },
    {
      filing: {
        ...observation().filing,
        acceptedAt: "2026-02-30T00:00:00.000Z",
      },
    },
  ])("rejects malformed observation %#", async (patch) => {
    fetchMock.mockResolvedValue(
      json(evidencePatch({ observations: [{ ...observation(), ...patch }] })),
    );
    await expect(
      fetchPersonalSecQuarterlyEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("preserves distinct revision metadata and explicit conflicts without promoting them", async () => {
    const value = evidencePatch({
      observations: [
        {
          ...observation(),
          filing: {
            ...observation().filing,
            status: "metadata_conflict",
            form: "10-Q/A",
          },
        },
      ],
    });
    fetchMock.mockResolvedValue(json(value));
    const result = await fetchPersonalSecQuarterlyEvidence(request(), signal());
    expect(result.evidence.observations[0]?.filing.status).toBe(
      "metadata_conflict",
    );
    expect(result.evidence.observations[0]?.periodBasis).toBe("unresolved");
  });

  it.each([
    null,
    "2026-08-01T20:00:00Z",
    "2026-08-01T20:00:00.000Z",
    "2026-08-01T20:00:00.123Z",
  ])(
    "accepts the producer's source timestamp %s and metadata bounds",
    async (acceptedAt) => {
      fetchMock.mockResolvedValue(
        json(
          evidencePatch({
            observations: [
              {
                ...observation(),
                filingFocusPeriod: "Q".repeat(32),
                frame: "C".repeat(128),
                filing: { ...observation().filing, acceptedAt },
              },
            ],
          }),
        ),
      );
      const result = await fetchPersonalSecQuarterlyEvidence(
        request(),
        signal(),
      );
      expect(result.evidence.observations[0]?.filing.acceptedAt).toBe(
        acceptedAt,
      );
      expect(result.evidence.observations[0]?.filingFocusPeriod).toHaveLength(
        32,
      );
      expect(result.evidence.observations[0]?.frame).toHaveLength(128);
    },
  );

  it("keeps source observations when submissions are unavailable and exposes no filing link", async () => {
    const value = evidencePatch({
      sources: {
        ...response().evidence.sources,
        submissions: {
          ...response().evidence.sources.submissions,
          status: "rate_limited",
        },
      },
      observations: [
        {
          ...observation(),
          filing: {
            status: "submissions_unavailable",
            form: null,
            filedDate: null,
            reportDate: null,
            acceptedAt: null,
            sourceUrl: null,
          },
        },
      ],
    });
    fetchMock.mockResolvedValue(json(value));
    expect(
      (await fetchPersonalSecQuarterlyEvidence(request(), signal())).evidence
        .observations,
    ).toHaveLength(1);
  });

  it("accepts zero/loss and missing start dates without inventing durations", async () => {
    for (const value of ["0", "-12.5"]) {
      fetchMock.mockResolvedValue(
        json(
          evidencePatch({
            observations: [
              {
                ...observation(),
                value,
                startDate: null,
                durationDays: null,
                filingFocusYear: null,
                filingFocusPeriod: null,
                frame: null,
              },
            ],
          }),
        ),
      );
      const result = await fetchPersonalSecQuarterlyEvidence(
        request(),
        signal(),
      );
      expect(result.evidence.observations[0]).toMatchObject({
        value,
        startDate: null,
        durationDays: null,
      });
    }
  });

  it("rejects duplicate identities and identical observations disguised with another id", async () => {
    for (const second of [
      observation(),
      { ...observation(), id: `sec-fact:${"b".repeat(64)}` },
    ]) {
      fetchMock.mockResolvedValue(
        json(
          evidencePatch({
            coverage: {
              ...response().evidence.coverage,
              inspectedRows: 2,
              availableObservations: 2,
              returnedObservations: 2,
            },
            observations: [observation(), second],
          }),
        ),
      );
      await expect(
        fetchPersonalSecQuarterlyEvidence(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("enforces per-metric caps and newest-first ordering", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => observation(index));
    fetchMock.mockResolvedValue(
      json(
        evidencePatch({
          coverage: {
            ...response().evidence.coverage,
            inspectedRows: 101,
            availableObservations: 101,
            returnedObservations: 101,
          },
          observations: rows,
        }),
      ),
    );
    await expect(
      fetchPersonalSecQuarterlyEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockResolvedValue(
      json(
        evidencePatch({
          coverage: {
            ...response().evidence.coverage,
            inspectedRows: 2,
            availableObservations: 2,
            returnedObservations: 2,
          },
          observations: [observation(1), observation(0)],
        }),
      ),
    );
    await expect(
      fetchPersonalSecQuarterlyEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    [401, "session_unavailable"],
    [403, "session_unavailable"],
    [400, "invalid_request"],
    [404, "not_covered"],
    [409, "conflict"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "not_configured"],
  ] as const)("maps HTTP %s to a sanitized %s error", async (status, code) => {
    fetchMock.mockResolvedValue(
      json({ code, detail: "Never display this private source error" }, status),
    );
    await expect(
      fetchPersonalSecQuarterlyEvidence(request(), signal()),
    ).rejects.toMatchObject({
      code,
      message: "The personal workspace request was not accepted.",
    });
  });

  it("rejects malformed JSON, invalid UTF-8 and oversized private replies", async () => {
    for (const body of [
      "not json",
      new Uint8Array([0xc3, 0x28]),
      " ".repeat(2 * 1024 * 1024 + 1),
    ]) {
      fetchMock.mockResolvedValue(new Response(body));
      await expect(
        fetchPersonalSecQuarterlyEvidence(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("does not start an aborted request and cancels a pending response body", async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      fetchPersonalSecQuarterlyEvidence(request(), aborted.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const controller = new AbortController();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const pending = fetchPersonalSecQuarterlyEvidence(
      request(),
      controller.signal,
    );
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});

function request(): PersonalSecQuarterlyEvidenceRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "lst-zero",
    symbol: "ZERO",
  };
}
function response(): PersonalSecQuarterlyEvidenceResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    security: {
      cik: "0000000001",
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    evidence: {
      cik: "0000000001",
      fetchedAt: "2026-09-10T10:00:00.000Z",
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        },
      },
      olderHistoryAvailable: false,
      coverage: {
        inspectedRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        availableObservations: 1,
        returnedObservations: 1,
        truncated: false,
        conceptsWithoutUsd: [],
      },
      observations: [observation()],
      ttm: {
        status: "unavailable",
        reason: "period_and_revision_not_admitted",
      },
    },
  };
}
function observation(index = 0): PersonalSecQuarterlyObservationDto {
  const accessionNumber = `0000000001-26-${String(index + 1).padStart(6, "0")}`;
  return {
    id: `sec-fact:${String(index + 1).padStart(64, "0")}`,
    metric: "revenue",
    taxonomy: "us-gaap",
    concept: "Revenues",
    unit: "USD",
    value: "12345678901234567890.12",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    durationDays: 91,
    periodBasis: "unresolved",
    filingFocusYear: 2026,
    filingFocusPeriod: "Q2",
    frame: "CY2026Q2",
    accessionNumber,
    form: "10-Q",
    filedDate: "2026-08-01",
    sourceLocator: `/facts/us-gaap/Revenues/units/USD/${index}`,
    filing: {
      status: "matched",
      form: "10-Q",
      filedDate: "2026-08-01",
      reportDate: "2026-06-30",
      acceptedAt: "2026-08-01T20:00:00.000Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${accessionNumber}-index.htm`,
    },
  };
}
function evidencePatch(patch: Record<string, unknown>): unknown {
  const base = response();
  return { ...base, evidence: { ...base.evidence, ...patch } };
}
function coveragePatch(patch: Record<string, unknown>): unknown {
  return evidencePatch({
    coverage: { ...response().evidence.coverage, ...patch },
  });
}
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function signal(): AbortSignal {
  return new AbortController().signal;
}
