import type {
  PersonalSecAnnualEvidenceRequestDto,
  PersonalSecAnnualEvidenceResponseDto,
  PersonalSecAnnualResolutionInput,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import {
  getPersonalSecAnnualRefusalReason,
  resolvePersonalSecAnnualEvidence,
  serializePersonalSecAnnualGeneration,
} from "@research-cockpit/personal-financial-analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPersonalSecAnnualEvidence } from "./personal-sec-annual-evidence-api";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("annual SEC evidence browser client", () => {
  it("posts only the exact admitted request and preserves/freeze-checks signed exact evidence", async () => {
    const wire = await response([
      row("Revenues", "12345678901234567890.12"),
      row("NetIncomeLoss", "-25"),
    ]);
    fetchMock.mockResolvedValue(json(wire));
    const abort = new AbortController();
    const result = await fetchPersonalSecAnnualEvidence(
      request(),
      abort.signal,
    );
    expect(result).toEqual(wire);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/sec-annual-evidence",
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request()),
        signal: abort.signal,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(Object.isFrozen(result.evidence.observations[0]?.filing)).toBe(true);
    expect(Object.isFrozen(result.evidence.resolution.bases[1]?.pairs)).toBe(
      true,
    );
  });

  it.each(["0", "-25", "12345678901234567890.12"])(
    "accepts exact income %s and recomputes its margin",
    async (income) => {
      const wire = await response([
        row("Revenues", "1000"),
        row("NetIncomeLoss", income),
      ]);
      fetchMock.mockResolvedValue(json(wire));
      const result = await fetchPersonalSecAnnualEvidence(request(), signal());
      expect(result.evidence.resolution.bases[1]?.pairs[0]?.netIncome).toBe(
        income,
      );
    },
  );

  it("preserves comparative observations, rejected conflicts and all three revenue bases", async () => {
    const wire = await response([
      row("Revenues", "1000"),
      row("Revenues", "1001", {
        frame: null,
        sourceLocator: "/facts/us-gaap/Revenues/units/USD/1",
      }),
      row("NetIncomeLoss", "100"),
      row("SalesRevenueNet", "900", {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
      }),
    ]);
    fetchMock.mockResolvedValue(json(wire));
    const result = await fetchPersonalSecAnnualEvidence(request(), signal());
    expect(result.evidence.observations).toHaveLength(4);
    expect(
      result.evidence.resolution.bases.map((basis) => basis.status),
    ).toEqual(["missing", "rejected", "missing"]);
    expect(result.evidence.resolution.bases[1]?.pairs[0]?.status).toBe(
      "ambiguous_revenue_period_or_value",
    );
  });

  it("keeps missing required income unavailable without substituting another concept", async () => {
    const wire = await response([row("Revenues", "1000")]);
    fetchMock.mockResolvedValue(json(wire));
    expect(
      (await fetchPersonalSecAnnualEvidence(request(), signal())).evidence
        .resolution.bases[1]?.pairs[0],
    ).toMatchObject({
      status: "income_missing_same_filing_period",
      netIncome: null,
      netMarginPercent: null,
    });
  });

  it.each([
    { ...request(), schemaVersion: "2.0.0" },
    { ...request(), catalogSnapshotSha256: "bad" },
    { ...request(), listingId: "https://evil.invalid" },
    { ...request(), symbol: "zero" },
    { ...request(), cik: "0000000001" },
    { ...request(), sourceUrl: "https://data.sec.gov" },
  ])("rejects malformed request %# before IO", async (input) => {
    await expect(
      fetchPersonalSecAnnualEvidence(
        input as PersonalSecAnnualEvidenceRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["extra envelope", (v: Wire) => ({ ...v, token: "private" })],
    [
      "catalog",
      (v: Wire) => ({
        ...v,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ],
    [
      "listing",
      (v: Wire) => ({
        ...v,
        security: { ...v.security, listingId: "listing-other" },
      }),
    ],
    [
      "symbol",
      (v: Wire) => ({ ...v, security: { ...v.security, symbol: "OTHER" } }),
    ],
    [
      "identity control text",
      (v: Wire) => ({
        ...v,
        security: { ...v.security, issuerName: "Bad\u0000" },
      }),
    ],
    ["CIK", (v: Wire) => patch(v, { cik: "0000000002" })],
    [
      "counts",
      (v: Wire) =>
        patch(v, {
          coverage: {
            ...v.evidence.coverage,
            returned: { observations: 1, revenue: 1, netIncome: 0 },
          },
        }),
    ],
    [
      "extra coverage",
      (v: Wire) =>
        patch(v, {
          coverage: { ...v.evidence.coverage, implicitComplete: true },
        }),
    ],
    [
      "history flag",
      (v: Wire) =>
        patch(v, {
          coverage: {
            ...v.evidence.coverage,
            history: {
              returned: { observations: 2, revenue: 1, netIncome: 1 },
              truncated: true,
            },
          },
        }),
    ],
    [
      "complete false reason",
      (v: Wire) =>
        patch(v, {
          completeness: { status: "refused", reason: "invalid_source_rows" },
          observations: [],
        }),
    ],
    [
      "generation digest",
      (v: Wire) =>
        patch(v, {
          generation: {
            ...v.evidence.generation,
            sha256: `sha256:${"f".repeat(64)}`,
          },
        }),
    ],
    [
      "completion before cutoff",
      (v: Wire) =>
        patch(v, {
          generation: {
            ...v.evidence.generation,
            completedAt: "2026-09-19T00:00:00.000Z",
          },
        }),
    ],
    [
      "future capture",
      (v: Wire) =>
        patch(v, {
          generation: {
            ...v.evidence.generation,
            sources: {
              ...v.evidence.generation.sources,
              companyFacts: {
                ...v.evidence.generation.sources.companyFacts,
                fetchedAt: "2027-01-01T00:00:00.000Z",
              },
            },
          },
        }),
    ],
    [
      "forged eligibility",
      (v: Wire) =>
        patch(v, {
          resolution: {
            ...v.evidence.resolution,
            selectedReportPairEligible: false,
          },
        }),
    ],
    [
      "forged utility",
      (v: Wire) =>
        patch(v, {
          resolution: {
            ...v.evidence.resolution,
            utilityAge: {
              endAgeDays: 0,
              sourceAgeDays: [0, 0],
              withinWindow: true,
            },
          },
        }),
    ],
    [
      "forged numeric margin",
      (v: Wire) =>
        patch(v, {
          resolution: {
            ...v.evidence.resolution,
            pairs: v.evidence.resolution.pairs.map((p) => ({
              ...p,
              netMarginPercent: "99",
            })),
          },
        }),
    ],
    [
      "forged references",
      (v: Wire) =>
        patch(v, {
          resolution: {
            ...v.evidence.resolution,
            pairs: v.evidence.resolution.pairs.map((p) => ({
              ...p,
              incomeObservationIds: p.revenueObservationIds,
            })),
          },
        }),
    ],
    [
      "basis omission",
      (v: Wire) =>
        patch(v, {
          resolution: {
            ...v.evidence.resolution,
            bases: v.evidence.resolution.bases.slice(1),
          },
        }),
    ],
    [
      "unsafe source link",
      (v: Wire) =>
        patch(v, {
          generation: {
            ...v.evidence.generation,
            sources: {
              ...v.evidence.generation.sources,
              submissions: {
                ...v.evidence.generation.sources.submissions,
                sourceUrl: "https://evil.invalid",
              },
            },
          },
        }),
    ],
    [
      "reversed order",
      (v: Wire) =>
        patch(v, { observations: [...v.evidence.observations].reverse() }),
    ],
    [
      "duplicate observation",
      (v: Wire) =>
        patch(v, {
          observations: [
            v.evidence.observations[0],
            v.evidence.observations[0],
          ],
        }),
    ],
  ] as const)("rejects forged %s", async (_label, forge) => {
    fetchMock.mockResolvedValue(json(forge(await response())));
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "empty invalid body",
    "transport failure",
    "global invalid row",
    "target tie",
    "selected overflow",
  ] as const)("accepts truthful refusal: %s", async (kind) => {
    const base = await response();
    const old = base.evidence;
    const zero = { observations: 0, revenue: 0, netIncome: 0 };
    let input: PersonalSecAnnualResolutionInput = { ...old, observations: [] };
    if (kind === "empty invalid body" || kind === "transport failure") {
      input = {
        ...input,
        coverage: null,
        generation: {
          ...old.generation,
          sources: {
            ...old.generation.sources,
            companyFacts: {
              ...old.generation.sources.companyFacts,
              status:
                kind === "empty invalid body"
                  ? "invalid_response"
                  : "upstream_unavailable",
              fetchedAt:
                kind === "empty invalid body"
                  ? old.generation.sources.companyFacts.fetchedAt
                  : null,
              bytes: kind === "empty invalid body" ? 0 : null,
              sha256: kind === "empty invalid body" ? await hash("") : null,
            },
          },
        },
      };
    } else if (old.coverage !== null) {
      const selected =
        kind === "selected overflow"
          ? { observations: 102, revenue: 101, netIncome: 1 }
          : { observations: 2, revenue: 1, netIncome: 1 };
      input = {
        ...input,
        target:
          kind === "target tie"
            ? { status: "unresolved", reason: "target_ambiguous" }
            : old.target,
        coverage: {
          ...old.coverage,
          full: {
            ...old.coverage.full,
            ...selected,
            uniqueObservations: selected.observations,
            inspectedRows:
              selected.observations + (kind === "global invalid row" ? 1 : 0),
            invalidRows: kind === "global invalid row" ? 1 : 0,
          },
          selected: kind === "target tie" ? null : selected,
          otherAccessions: kind === "target tie" ? null : zero,
          returned: zero,
          omittedSelected: kind === "target tie" ? null : selected,
          history:
            kind === "selected overflow"
              ? {
                  returned: { observations: 101, revenue: 100, netIncome: 1 },
                  truncated: true,
                }
              : old.coverage.history,
        },
      };
    }
    const refusal = getPersonalSecAnnualRefusalReason(input);
    if (refusal === null) throw new Error("Expected refusal fixture");
    input = {
      ...input,
      completeness: { status: "refused", reason: refusal },
      generation: {
        ...input.generation,
        sha256: await hash(serializePersonalSecAnnualGeneration(input)),
      },
    };
    const wire = {
      ...base,
      evidence: {
        ...input,
        resolution: resolvePersonalSecAnnualEvidence(input),
      },
    };
    fetchMock.mockResolvedValue(json(wire));
    const loaded = await fetchPersonalSecAnnualEvidence(request(), signal());
    expect(loaded.evidence.completeness).toEqual({
      status: "refused",
      reason: refusal,
    });
    expect(loaded.evidence.observations).toEqual([]);
    expect(
      loaded.evidence.resolution.bases.every(
        (basis) => basis.status === "withheld",
      ),
    ).toBe(true);
  });

  it("admits a complete selected report while keeping unrelated history truncation truthful", async () => {
    const wire = await response();
    if (wire.evidence.coverage === null) throw new Error("Fixture coverage");
    const input = {
      ...wire.evidence,
      coverage: {
        ...wire.evidence.coverage,
        full: {
          ...wire.evidence.coverage.full,
          observations: 1000,
          revenue: 500,
          netIncome: 500,
          inspectedRows: 1000,
          uniqueObservations: 1000,
        },
        otherAccessions: { observations: 998, revenue: 499, netIncome: 499 },
        history: {
          returned: { observations: 200, revenue: 100, netIncome: 100 },
          truncated: true,
        },
      },
    };
    fetchMock.mockResolvedValue(
      json({
        ...wire,
        evidence: {
          ...input,
          resolution: resolvePersonalSecAnnualEvidence(input),
        },
      }),
    );
    expect(
      (await fetchPersonalSecAnnualEvidence(request(), signal())).evidence
        .coverage?.history.truncated,
    ).toBe(true);
  });

  it.each([
    { id: `sec-fact:${"f".repeat(64)}` },
    { value: "1001" },
    { value: "-0" },
    { value: "1e3" },
    { value: "1000.00" },
    { value: "9".repeat(65) },
    { sourceLocator: "/facts/us-gaap/NetIncomeLoss/units/USD/0" },
    { durationDays: 364 },
    { accessionNumber: "0000000001-26-000002" },
    { unit: "CAD" },
    { endDate: "2025-02-30" },
    { filing: { ...row().filing, sourceUrl: "javascript:alert(1)" } },
    { filing: { ...row().filing, reportDate: "2024-12-31" } },
  ])("rejects corrupted observation %#", async (changes) => {
    const wire = await response();
    const observations = wire.evidence.observations.map((item) =>
      item.metric === "revenue" ? { ...item, ...changes } : item,
    );
    fetchMock.mockResolvedValue(json(patch(wire, { observations })));
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
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
    [500, "unavailable"],
    [503, "not_configured"],
  ] as const)("maps HTTP %i without retry", async (status, code) => {
    fetchMock.mockResolvedValue(json({ code: "not_configured" }, status));
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
    ).rejects.toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects invalid UTF-8 and an over-limit streamed response", async () => {
    for (const body of [
      new Uint8Array([0xff]),
      new Uint8Array(2 * 1024 * 1024 + 1),
    ]) {
      fetchMock.mockResolvedValue(new Response(body));
      await expect(
        fetchPersonalSecAnnualEvidence(request(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("aborts before IO and while a pending response body is read", async () => {
    const early = new AbortController();
    early.abort();
    await expect(
      fetchPersonalSecAnnualEvidence(request(), early.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const cancel = vi.fn();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const held = new AbortController();
    const promise = fetchPersonalSecAnnualEvidence(request(), held.signal);
    await Promise.resolve();
    await Promise.resolve();
    held.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});

type Wire = PersonalSecAnnualEvidenceResponseDto;
function request(): PersonalSecAnnualEvidenceRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listingId: "listing-zero",
    symbol: "ZERO",
  };
}
function signal() {
  return new AbortController().signal;
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function patch(value: Wire, evidence: object) {
  return { ...value, evidence: { ...value.evidence, ...evidence } };
}
function row(
  concept: PersonalSecQuarterlyObservationDto["concept"] = "Revenues",
  value = "1000",
  changes: Partial<PersonalSecQuarterlyObservationDto> = {},
): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${"0".repeat(64)}`,
    metric: concept === "NetIncomeLoss" ? "net_income" : "revenue",
    taxonomy: "us-gaap",
    concept,
    unit: "USD",
    value,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    durationDays: 365,
    periodBasis: "unresolved",
    filingFocusYear: 2025,
    filingFocusPeriod: "FY",
    frame: "CY2025",
    accessionNumber: "0000000001-26-000001",
    form: "10-K",
    filedDate: "2026-02-01",
    sourceLocator: `/facts/us-gaap/${concept}/units/USD/0`,
    filing: {
      status: "matched",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T00:00:00.000Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    },
    ...changes,
  };
}
async function hash(value: string): Promise<`sha256:${string}`> {
  return `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
async function response(
  rows = [row(), row("NetIncomeLoss", "100")],
): Promise<Wire> {
  const observations = await Promise.all(
    rows.map(async (item) => {
      const fields = Object.fromEntries(
        Object.entries(item).filter(
          ([key]) => !["id", "sourceLocator", "filing"].includes(key),
        ),
      );
      return {
        ...item,
        id: `sec-fact:${(await hash(JSON.stringify(fields))).slice(7)}` as const,
      };
    }),
  );
  observations.sort(
    (a, b) =>
      b.endDate.localeCompare(a.endDate) ||
      (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
      b.filedDate.localeCompare(a.filedDate) ||
      a.accessionNumber.localeCompare(b.accessionNumber) ||
      a.concept.localeCompare(b.concept) ||
      a.id.localeCompare(b.id),
  );
  const counts = {
    observations: observations.length,
    revenue: observations.filter((o) => o.metric === "revenue").length,
    netIncome: observations.filter((o) => o.metric === "net_income").length,
  };
  const zero = { observations: 0, revenue: 0, netIncome: 0 };
  const input: PersonalSecAnnualResolutionInput = {
    cik: "0000000001",
    generation: {
      definitionVersion: "1.0.0",
      cutoffAt: "2026-09-20T00:00:00.000Z",
      completedAt: "2026-09-20T00:00:02.000Z",
      sha256: `sha256:${"0".repeat(64)}`,
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
          fetchedAt: "2026-09-20T00:00:01.000Z",
          bytes: 1000,
          sha256: `sha256:${"b".repeat(64)}`,
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
          fetchedAt: "2026-09-20T00:00:02.000Z",
          bytes: 500,
          sha256: `sha256:${"c".repeat(64)}`,
        },
      },
    },
    target: {
      status: "target",
      accessionNumber: "0000000001-26-000001",
      form: "10-K",
      filedDate: "2026-02-01",
      reportDate: "2025-12-31",
      acceptedAt: "2026-02-01T00:00:00.000Z",
    },
    targetScan: {
      currentFilings: 1,
      annualFilings: 1,
      olderHistoryAvailable: false,
    },
    completeness: { status: "complete", reason: null },
    coverage: {
      full: {
        ...counts,
        inspectedRows: observations.length,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: observations.length,
        conceptsWithoutUsd: [],
      },
      selected: counts,
      otherAccessions: zero,
      returned: counts,
      omittedSelected: zero,
      history: { returned: counts, truncated: false },
    },
    observations,
  };
  const generation = {
    ...input.generation,
    sha256: await hash(serializePersonalSecAnnualGeneration(input)),
  };
  const evidence = { ...input, generation };
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: request().catalogSnapshotSha256,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Company",
      listingId: "listing-zero",
      securityName: "Zero Class A",
      symbol: "ZERO",
      cik: "0000000001",
    },
    evidence: {
      ...evidence,
      resolution: resolvePersonalSecAnnualEvidence(evidence),
    },
  };
}
