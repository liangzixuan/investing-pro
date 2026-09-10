import type {
  PersonalSecFilingContextCandidateDto,
  PersonalSecFilingContextRequestDto,
  PersonalSecFilingContextResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersonalSecFilingContext,
  selectPersonalSecFilingContextObservation,
} from "./personal-sec-filing-context-api";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("filing-context browser decoder", () => {
  it("sends only the URL-free selection through authenticated POST and freezes exact evidence", async () => {
    fetchMock.mockResolvedValue(json(response()));
    const controller = new AbortController();
    const result = await fetchPersonalSecFilingContext(
      request(),
      controller.signal,
    );
    expect(result).toEqual(response());
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/sec-filing-context",
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
    expect(request().selection).not.toHaveProperty("filing");
    expect(request().selection).not.toHaveProperty("sourceLocator");
    if (result.inspection.status !== "available") throw new Error();
    expect(result.inspection.analysis.candidates[0]?.value).toBe(
      "12345678901234567890.12",
    );
    expect(
      Object.isFrozen(result.inspection.analysis.candidates[0]?.concept),
    ).toBe(true);
    expect(Object.isFrozen(result.inspection.observation.filing)).toBe(true);
  });
  it.each([
    "value_differs",
    "ambiguous",
    "unsupported",
    "no_corresponding_fact",
  ] as const)("accepts honest %s outcomes", async (status) => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    let candidates: PersonalSecFilingContextCandidateDto[] = [candidate()];
    let locators = ["/elements/1"];
    if (status === "value_differs")
      candidates = [{ ...candidate(), value: "12345678901234567890.13" }];
    if (status === "ambiguous") {
      candidates.push({
        ...candidate(),
        locator: "/elements/2",
        value: "-12.5",
      });
      locators.push("/elements/2");
    }
    if (status === "unsupported") {
      candidates = [
        { ...candidate(), unit: null, issues: ["unsupported_unit"] },
      ];
      locators = [];
    }
    if (status === "no_corresponding_fact") {
      candidates = [
        {
          ...candidate(),
          entityCik: "0000000002",
          issues: ["entity_mismatch"],
        },
      ];
      locators = [];
    }
    const value = {
      ...base,
      inspection: {
        ...base.inspection,
        analysis: {
          status,
          reason: status === "unsupported" ? "unsupported_unit" : null,
          candidates,
          correspondingCandidateLocators: locators,
        },
      },
    };
    fetchMock.mockResolvedValue(json(value));
    expect(await fetchPersonalSecFilingContext(request(), signal())).toEqual(
      value,
    );
  });
  it("preserves bounded unsupported raw provenance and gives no partial prefix for a global failure", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    const unsupported = {
      ...candidate(),
      concept: { raw: "", namespace: null, localName: null },
      value: null,
      rawText: "\n  \t12.5\r\n",
      issues: ["invalid_namespace"],
    };
    fetchMock.mockResolvedValueOnce(
      json({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            status: "unsupported",
            reason: "invalid_namespace",
            candidates: [unsupported],
            correspondingCandidateLocators: [],
          },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).resolves.toMatchObject({
      inspection: { analysis: { candidates: [unsupported] } },
    });
    fetchMock.mockResolvedValueOnce(
      json({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            status: "unsupported",
            reason: "candidate_limit",
            candidates: [],
            correspondingCandidateLocators: [],
          },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).resolves.toMatchObject({
      inspection: { analysis: { reason: "candidate_limit", candidates: [] } },
    });
  });
  it.each([
    "selection_changed_or_not_retained",
    "submission_metadata_conflict",
    "parser_timeout",
    "runtime_unavailable",
  ] as const)("retains the %s unavailable explanation", async (reason) => {
    const value = {
      ...response(),
      inspection: {
        status: "unavailable",
        cik: "0000000001",
        stage:
          reason === "selection_changed_or_not_retained"
            ? "company_facts"
            : reason === "submission_metadata_conflict"
              ? "submissions"
              : "parser",
        reason,
      },
    };
    fetchMock.mockResolvedValue(json(value));
    expect(await fetchPersonalSecFilingContext(request(), signal())).toEqual(
      value,
    );
  });
  it.each([
    { ...request(), sourceUrl: "https://evil.invalid" },
    { ...request(), schemaVersion: "2" },
    { ...request(), selection: { ...request().selection, filing: {} } },
    { ...request(), selection: { ...request().selection, startDate: null } },
    { ...request(), selection: { ...request().selection, form: "10-K" } },
    { ...request(), selection: { ...request().selection, value: "1.0" } },
    { ...request(), selection: { ...request().selection, value: "-0" } },
    {
      ...request(),
      selection: { ...request().selection, metric: "net_income" },
    },
  ])(
    "rejects malformed or broadened request %# before network",
    async (input) => {
      await expect(
        fetchPersonalSecFilingContext(
          input as PersonalSecFilingContextRequestDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it.each([
    [
      "catalog",
      (value: Record<string, unknown>) => {
        value.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      },
    ],
    [
      "issuer binding",
      (value: Record<string, unknown>) => {
        (value.inspection as Record<string, unknown>).cik = "0000000002";
      },
    ],
    [
      "extra wrapper fields",
      (value: Record<string, unknown>) => {
        value.token = "private";
      },
    ],
    [
      "selected value",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).observation as Record<
            string,
            unknown
          >
        ).value = "1";
      },
    ],
    [
      "document host",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).sourceUrl = "https://evil.invalid/file.htm";
      },
    ],
    [
      "document traversal",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).sourceUrl =
          "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/../file.htm";
      },
    ],
    [
      "document bytes",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).bytes = 33_554_433;
      },
    ],
    [
      "invalid date",
      (value: Record<string, unknown>) => {
        (
          (value.inspection as Record<string, unknown>).document as Record<
            string,
            unknown
          >
        ).fetchedAt = "2026-02-30T10:00:00.000Z";
      },
    ],
  ] as const)("rejects invalid %s", async (_name, mutate) => {
    const value = structuredClone(response()) as unknown as Record<
      string,
      unknown
    >;
    mutate(value);
    fetchMock.mockResolvedValue(json(value));
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    { locator: "/elements/0" },
    { locator: "/elements/1000001" },
    { contextId: null },
    { contextId: "bad:id" },
    { unitId: "" },
    { factId: "bad id" },
    { value: "12345678901234567890.13" },
    { value: "1.00" },
    { entityCik: "0000000002" },
    { entityScheme: "https://evil.invalid" },
    {
      concept: {
        raw: "us-gaap:Revenues",
        namespace: "https://evil.invalid",
        localName: "Revenues",
      },
    },
    {
      concept: {
        ...candidate().concept,
        namespace: "http://fasb.org/us-gaap/3000",
      },
    },
    {
      concept: {
        ...candidate().concept,
        namespace: "http://fasb.org/us-gaap/2026-02-30",
      },
    },
    { rawText: "\u0000" },
    { rawText: "x".repeat(4097) },
    { issues: ["made_up"] },
    {
      unitMeasures: Array.from(
        { length: 33 },
        () => candidate().unitMeasures[0],
      ),
    },
  ])("rejects invalid or falsely matching candidate %#", async (patch) => {
    const value = response();
    if (value.inspection.status !== "available") throw new Error();
    fetchMock.mockResolvedValue(
      json({
        ...value,
        inspection: {
          ...value.inspection,
          analysis: {
            ...value.inspection.analysis,
            candidates: [{ ...candidate(), ...patch }],
          },
        },
      }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    {
      status: "matched",
      reason: null,
      candidates: [],
      correspondingCandidateLocators: [],
    },
    {
      status: "matched",
      reason: "node_limit",
      candidates: [candidate()],
      correspondingCandidateLocators: ["/elements/1"],
    },
    {
      status: "matched",
      reason: null,
      candidates: [candidate()],
      correspondingCandidateLocators: [],
    },
    {
      status: "matched",
      reason: null,
      candidates: [candidate(), candidate()],
      correspondingCandidateLocators: ["/elements/1"],
    },
    {
      status: "matched",
      reason: null,
      candidates: [{ ...candidate(), locator: "/elements/2" }, candidate()],
      correspondingCandidateLocators: ["/elements/2", "/elements/1"],
    },
    {
      status: "matched",
      reason: null,
      candidates: Array.from({ length: 101 }, (_, index) => ({
        ...candidate(),
        locator: `/elements/${index + 1}`,
      })),
      correspondingCandidateLocators: [],
    },
  ])("rejects inconsistent analysis %#", async (analysis) => {
    const base = response();
    fetchMock.mockResolvedValue(
      json({ ...base, inspection: { ...base.inspection, analysis } }),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [403, "session_unavailable"],
    [409, "conflict"],
    [429, "rate_limited"],
    [502, "provider_unavailable"],
    [503, "not_configured"],
  ] as const)(
    "maps HTTP %s without leaking response text",
    async (status, code) => {
      fetchMock.mockResolvedValue(
        json({ code: "not_configured", private: "sensitive" }, status),
      );
      await expect(
        fetchPersonalSecFilingContext(request(), signal()),
      ).rejects.toMatchObject({ code });
    },
  );
  it("rejects oversized and invalid UTF-8 responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(" ".repeat(2 * 1024 * 1024 + 1)),
    );
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([0xc3, 0x28])));
    await expect(
      fetchPersonalSecFilingContext(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("does not request after abort and cancels an in-flight response reader", async () => {
    const first = new AbortController();
    first.abort();
    await expect(
      fetchPersonalSecFilingContext(request(), first.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const second = new AbortController();
    const pending = fetchPersonalSecFilingContext(request(), second.signal);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    second.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalled();
  });
});

function signal() {
  return new AbortController().signal;
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function request(): PersonalSecFilingContextRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "lst-zero",
    symbol: "ZERO",
    selection: selectPersonalSecFilingContextObservation(observation()),
  };
}
function observation(): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${"1".repeat(64)}`,
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
    accessionNumber: "0000000001-26-000001",
    form: "10-Q",
    filedDate: "2026-08-01",
    sourceLocator: "/facts/us-gaap/Revenues/units/USD/0",
    filing: {
      status: "matched",
      form: "10-Q",
      filedDate: "2026-08-01",
      reportDate: "2026-06-30",
      acceptedAt: "2026-08-01T20:00:00Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    },
  };
}
function candidate(): PersonalSecFilingContextCandidateDto {
  return {
    locator: "/elements/1",
    factId: "revenue",
    contextId: "duration",
    unitId: "USD",
    concept: {
      raw: "us-gaap:Revenues",
      namespace: "http://fasb.org/us-gaap/2026",
      localName: "Revenues",
    },
    entityIdentifier: "0000000001",
    entityScheme: "http://www.sec.gov/CIK",
    entityCik: "0000000001",
    dimensions: [],
    periodKind: "duration",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    unit: "USD",
    unitMeasures: [
      {
        raw: "iso4217:USD",
        namespace: "http://www.xbrl.org/2003/iso4217",
        localName: "USD",
      },
    ],
    rawText: "12345678901234567890.12",
    format: null,
    sign: null,
    scale: null,
    decimals: "2",
    precision: null,
    value: "12345678901234567890.12",
    issues: [],
  };
}
function response(): PersonalSecFilingContextResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
      cik: "0000000001",
    },
    inspection: {
      status: "available",
      cik: "0000000001",
      observation: observation(),
      companyFacts: {
        sourceUrl:
          "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
        fetchedAt: "2026-09-10T10:00:00.000Z",
      },
      submissions: {
        sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        fetchedAt: "2026-09-10T10:00:00.000Z",
      },
      document: {
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/filing.htm",
        fetchedAt: "2026-09-10T10:00:00.000Z",
        sha256: `sha256:${"d".repeat(64)}`,
        bytes: 1000,
      },
      analysis: {
        status: "matched",
        reason: null,
        candidates: [candidate()],
        correspondingCandidateLocators: ["/elements/1"],
      },
    },
  };
}
