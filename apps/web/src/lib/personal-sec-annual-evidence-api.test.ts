import {
  MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecAnnualCanonicalRequestDto,
  type PersonalSecAnnualCanonicalResponseDto,
} from "@research-cockpit/contracts";
import { derivePersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canonicalAnnualPacket,
  canonicalAnnualRequest,
  canonicalFixtureHash,
  withCanonicalAnnualGeneration,
} from "../features/research/sec-annual-canonical-fixture";
import {
  bindAnnualPacket,
  replaceConceptRows,
  testAnnualPacket,
  type TestAnnualPacket,
  type Mutable,
} from "./test-personal-sec-annual-api-fixture";
import { fetchPersonalSecAnnualEvidence } from "./personal-sec-annual-evidence-api";
import {
  parseSecAnnualCanonicalResponse,
  isOwnedSecAnnualCanonicalResponse,
} from "./sec-annual-canonical-response";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const request = (): PersonalSecAnnualCanonicalRequestDto => ({
  ...canonicalAnnualRequest,
});
const signal = () => new AbortController().signal;
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
async function load(wire: unknown) {
  fetchMock.mockResolvedValueOnce(json(wire));
  return fetchPersonalSecAnnualEvidence(request(), signal());
}
function scan(packet: TestAnnualPacket, concept = "Revenues") {
  const item = packet.evidence.facts.scans.find(
    (item) => item.concept === concept,
  )!;
  if (item.scan.status !== "available")
    throw new Error("Expected available fixture scan");
  return item.scan;
}
function statementCell(
  view: ReturnType<typeof derivePersonalSecAnnualCanonicalView>,
  concept: string,
  endDate = "2025-12-31",
) {
  return view.statements.statements
    .flatMap((statement) => statement.rows)
    .find((row) => row.concept === concept)
    ?.cells.find((cell) => cell.endDate === endDate);
}

describe("canonical Annual SEC local browser transport", () => {
  it("posts only the exact request with private loopback options and owns frozen signed exact evidence", async () => {
    const packet = await testAnnualPacket();
    replaceConceptRows(packet, "Revenues", [
      { value: "12345678901234567890.12" },
    ]);
    replaceConceptRows(packet, "NetIncomeLoss", [{ value: "-25" }]);
    const wire = await bindAnnualPacket(packet);
    fetchMock.mockResolvedValueOnce(json(wire));
    const abort = new AbortController();
    const result = await fetchPersonalSecAnnualEvidence(
      request(),
      abort.signal,
    );
    expect(result).toEqual(wire);
    expect(result).not.toBe(wire);
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
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }),
    );
    expect(Object.isFrozen(result.evidence.facts.observations[0]!.filing)).toBe(
      true,
    );
    expect(Object.isFrozen(result.evidence.facts.scans[0]!.scan)).toBe(true);
    expect(Object.isFrozen(wire.evidence.facts.observations)).toBe(false);
    expect(isOwnedSecAnnualCanonicalResponse(result)).toBe(true);
    const view = derivePersonalSecAnnualCanonicalView(result.evidence);
    expect(statementCell(view, "Revenues")).toMatchObject({
      status: "available",
      value: "12345678901234567890.12",
    });
    expect(statementCell(view, "NetIncomeLoss")).toMatchObject({
      status: "available",
      value: "-25",
    });
  });
  it.each(["0", "-25", "12345678901234567890.12", "9".repeat(64)])(
    "keeps exact income %s and derives its shared margin after decoding",
    async (income) => {
      const packet = await testAnnualPacket();
      replaceConceptRows(packet, "Revenues", [{ value: "1000" }]);
      replaceConceptRows(packet, "NetIncomeLoss", [{ value: income }]);
      const result = await load(await bindAnnualPacket(packet));
      const view = derivePersonalSecAnnualCanonicalView(result.evidence);
      expect(view.income.resolution.bases[1]!.pairs[0]).toMatchObject({
        netIncome: income,
      });
      expect(
        view.income.resolution.bases[1]!.pairs[0]!.netMarginPercent,
      ).not.toBeNull();
      expect(statementCell(view, "NetIncomeLoss")).toMatchObject({
        value: income,
      });
      expect(Object.hasOwn(result.evidence, "resolution")).toBe(false);
    },
  );
  it("preserves comparative dates, conflict references and three separate revenue bases", async () => {
    const packet = await testAnnualPacket();
    replaceConceptRows(packet, "Revenues", [
      { value: "1000" },
      { value: "1001", frame: null },
    ]);
    replaceConceptRows(packet, "NetIncomeLoss", [{ value: "100" }]);
    replaceConceptRows(packet, "SalesRevenueNet", [
      {
        value: "900",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
        filingFocusYear: 2024,
      },
    ]);
    const result = await load(await bindAnnualPacket(packet));
    const view = derivePersonalSecAnnualCanonicalView(result.evidence);
    expect(result.evidence.facts.observations).toHaveLength(33);
    expect(view.income.resolution.bases.map((basis) => basis.status)).toEqual([
      "eligible",
      "rejected",
      "missing",
    ]);
    expect(view.income.resolution.bases[1]!.pairs[0]!.status).toBe(
      "ambiguous_revenue_period_or_value",
    );
    expect(statementCell(view, "Revenues")).toMatchObject({
      status: "unavailable",
      reason: "ambiguous_value",
    });
    expect(statementCell(view, "Revenues")!.observationIds).toHaveLength(2);
    expect(statementCell(view, "SalesRevenueNet", "2024-12-31")).toMatchObject({
      status: "available",
      startDate: "2024-01-01",
      value: "900",
      currentUseEligible: false,
    });
  });
  it("keeps absent income unavailable while other exact concepts remain usable", async () => {
    const packet = await testAnnualPacket();
    replaceConceptRows(packet, "Revenues", [{ value: "1000" }]);
    replaceConceptRows(packet, "NetIncomeLoss", []);
    const result = await load(await bindAnnualPacket(packet));
    const view = derivePersonalSecAnnualCanonicalView(result.evidence);
    expect(view.income.resolution.bases[1]!.pairs[0]).toMatchObject({
      status: "income_missing_same_filing_period",
      netIncome: null,
      netMarginPercent: null,
    });
    expect(statementCell(view, "NetIncomeLoss")).toMatchObject({
      status: "unavailable",
      reason: "concept_missing",
    });
    expect(statementCell(view, "Assets")).toMatchObject({
      status: "available",
    });
  });
  it.each([
    { ...request(), schemaVersion: "1.0.0" },
    { ...request(), schemaVersion: "4.0.0" },
    { ...request(), schemaVersion: "5.0.0" },
    { ...request(), catalogSnapshotSha256: "bad" },
    { ...request(), listingId: "https://evil.invalid" },
    { ...request(), symbol: "zero" },
    { ...request(), cik: "0000000042" },
    { ...request(), sourceUrl: "https://data.sec.gov" },
  ])("rejects malformed request %# before IO", async (input) => {
    await expect(
      fetchPersonalSecAnnualEvidence(
        input as PersonalSecAnnualCanonicalRequestDto,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "extra envelope",
    "version5",
    "catalog",
    "listing",
    "symbol",
    "identity control text",
    "CIK",
    "scan counts",
    "extra coverage",
    "invented history",
    "false completeness",
    "generation digest",
    "forged eligibility",
    "forged utility",
    "forged numeric margin",
    "forged references",
    "basis omission",
    "injected cash calculation",
    "unsafe source link",
    "reversed observations",
    "duplicate observation",
    "reversed scans",
    "source bytes",
    "candidate count",
  ] as const)(
    "rejects forged %s without retry or a derived-wire fallback",
    async (kind) => {
      const packet = await testAnnualPacket();
      if (kind === "extra envelope")
        Object.assign(packet, { token: "private" });
      if (kind === "version5")
        Object.assign(packet, { schemaVersion: "5.0.0" });
      if (kind === "catalog")
        packet.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      if (kind === "listing") packet.security.listingId = "listing-other";
      if (kind === "symbol") packet.security.symbol = "OTHER";
      if (kind === "identity control text")
        packet.security.issuerName = "Bad\u0000";
      if (kind === "CIK") packet.evidence.cik = "0000000043";
      if (kind === "scan counts") scan(packet).coverage.returned = 0;
      if (kind === "extra coverage")
        Object.assign(scan(packet).coverage, { implicitComplete: true });
      if (kind === "invented history")
        Object.assign(scan(packet).coverage, {
          history: { returned: 1000, truncated: true },
        });
      if (kind === "false completeness")
        Object.assign(packet.evidence, {
          completeness: { status: "refused", reason: "invalid_source_rows" },
        });
      if (kind === "generation digest")
        packet.evidence.generation.sha256 = `sha256:${"f".repeat(64)}`;
      if (kind === "forged eligibility")
        Object.assign(packet.evidence, {
          resolution: { selectedReportPairEligible: false },
        });
      if (kind === "forged utility")
        Object.assign(packet.evidence, {
          resolution: { utilityAge: { withinWindow: true } },
        });
      if (kind === "forged numeric margin")
        Object.assign(packet.evidence, {
          resolution: { pairs: [{ netMarginPercent: "99" }] },
        });
      if (kind === "forged references")
        Object.assign(packet.evidence, {
          resolution: {
            pairs: [
              {
                incomeObservationIds: [
                  packet.evidence.facts.observations[0]!.id,
                ],
              },
            ],
          },
        });
      if (kind === "basis omission")
        Object.assign(packet.evidence, { resolution: { bases: [] } });
      if (kind === "injected cash calculation")
        Object.assign(packet.evidence, {
          cashGeneration: {
            resolution: {
              operatingCashFlowLessPpePurchases: {
                status: "available",
                value: "999",
              },
            },
          },
        });
      if (kind === "unsafe source link")
        packet.evidence.generation.sources.submissions.sourceUrl =
          "https://evil.invalid";
      if (kind === "reversed observations")
        packet.evidence.facts.observations.reverse();
      if (kind === "duplicate observation")
        packet.evidence.facts.observations[1] =
          packet.evidence.facts.observations[0]!;
      if (kind === "reversed scans") packet.evidence.facts.scans.reverse();
      if (kind === "source bytes")
        packet.evidence.generation.sources.companyFacts.bytes =
          PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes + 1;
      if (kind === "candidate count")
        scan(packet).coverage.full.candidateRows = 10_001;
      await expect(load(packet)).rejects.toMatchObject({
        code: "invalid_response",
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it.each([
    "completion before cutoff",
    "source before cutoff",
    "source after completion",
    "report after filed",
    "filed after cutoff",
    "accepted after cutoff",
    "accepted before report",
    "same day unknown acceptance",
  ] as const)(
    "rejects a shaped and correctly generation-bound invalid clock: %s",
    async (kind) => {
      const packet = structuredClone(
        await canonicalAnnualPacket({ rowsPerConcept: 0 }),
      ) as TestAnnualPacket;
      if (kind === "completion before cutoff")
        packet.evidence.generation.completedAt = "2026-09-19T23:59:59.000Z";
      if (kind === "source before cutoff")
        packet.evidence.generation.sources.companyFacts.fetchedAt =
          "2026-09-19T23:59:59.000Z";
      if (kind === "source after completion")
        packet.evidence.generation.sources.submissions.fetchedAt =
          "2026-09-20T00:00:04.000Z";
      if (packet.evidence.target.status !== "target")
        throw new Error("Expected target");
      if (kind === "report after filed")
        packet.evidence.target.reportDate = "2026-02-02";
      if (kind === "filed after cutoff")
        packet.evidence.target.filedDate = "2026-09-21";
      if (kind === "accepted after cutoff")
        packet.evidence.target.acceptedAt = "2026-09-20T00:00:01.000Z";
      if (kind === "accepted before report")
        packet.evidence.target.acceptedAt = "2025-12-30T00:00:00.000Z";
      if (kind === "same day unknown acceptance") {
        packet.evidence.target.filedDate = "2026-09-20";
        packet.evidence.target.acceptedAt = null;
      }
      await expect(
        load(await withCanonicalAnnualGeneration(packet)),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it.each([
    "empty invalid body",
    "transport failure",
    "per-concept invalid row",
    "target tie",
    "selected overflow",
    "candidate limit",
  ] as const)("accepts truthful canonical refusal: %s", async (kind) => {
    const packet = await testAnnualPacket();
    if (kind === "empty invalid body" || kind === "transport failure") {
      Object.assign(
        packet.evidence.generation.sources.companyFacts,
        kind === "empty invalid body"
          ? {
              status: "invalid_response",
              bytes: 0,
              sha256: `sha256:${await canonicalFixtureHash("")}`,
            }
          : {
              status: "upstream_unavailable",
              bytes: null,
              fetchedAt: null,
              sha256: null,
            },
      );
      packet.evidence.facts.observations = [];
      for (const item of packet.evidence.facts.scans)
        item.scan = {
          status: "source_unavailable",
          absence: null,
          coverage: null,
        };
    }
    if (kind === "per-concept invalid row") {
      const coverage = scan(packet, "NetIncomeLoss").coverage;
      Object.assign(coverage.full, {
        candidateRows: 2,
        inspectedRows: 2,
        invalidRows: 1,
      });
    }
    if (kind === "target tie") {
      packet.evidence.target = {
        status: "unresolved",
        reason: "target_ambiguous",
      };
      packet.evidence.facts.observations = [];
      for (const item of packet.evidence.facts.scans)
        if (item.scan.status === "available")
          Object.assign(item.scan.coverage, {
            selected: null,
            otherAccessions: null,
            returned: 0,
            omittedSelected: null,
          });
    }
    if (kind === "selected overflow") {
      replaceConceptRows(packet, "Revenues", []);
      Object.assign(scan(packet), {
        absence: null,
        coverage: {
          full: {
            candidateRows: 101,
            inspectedRows: 101,
            invalidRows: 0,
            duplicateRows: 0,
            uniqueObservations: 101,
          },
          selected: 101,
          otherAccessions: 0,
          returned: 0,
          omittedSelected: 101,
        },
      });
    }
    if (kind === "candidate limit") {
      replaceConceptRows(packet, "Revenues", []);
      packet.evidence.facts.scans.find(
        (item) => item.concept === "Revenues",
      )!.scan = { status: "candidate_limit", absence: null, coverage: null };
    }
    const wire = await bindAnnualPacket(packet);
    const result = await load(wire);
    expect(result).toEqual(wire);
    const view = derivePersonalSecAnnualCanonicalView(result.evidence);
    if (kind === "empty invalid body" || kind === "transport failure") {
      expect(view.statements.contextReason).toBe("source_unavailable");
      expect(result.evidence.facts.observations).toEqual([]);
    } else if (kind === "target tie") {
      expect(view.statements.contextReason).toBe("target_unresolved");
      expect(
        view.statements.statements.every(
          (statement) => statement.columns.length === 0,
        ),
      ).toBe(true);
    } else {
      expect(
        statementCell(
          view,
          kind === "per-concept invalid row" ? "NetIncomeLoss" : "Revenues",
        ),
      ).toMatchObject({
        status: "unavailable",
        reason:
          kind === "per-concept invalid row"
            ? "invalid_source_rows"
            : kind === "selected overflow"
              ? "selected_report_overflow"
              : "candidate_limit",
      });
      expect(statementCell(view, "Assets")).toMatchObject({
        status: "available",
      });
      expect(view.income.resolution.currentTargetEligible).toBe(false);
    }
  });
  it("keeps complete selected evidence and truthful other-accession counts without inventing retained history", async () => {
    const packet = await testAnnualPacket();
    Object.assign(scan(packet).coverage, {
      full: {
        candidateRows: 10_000,
        inspectedRows: 10_000,
        invalidRows: 0,
        duplicateRows: 0,
        uniqueObservations: 10_000,
      },
      selected: 1,
      otherAccessions: 9_999,
      returned: 1,
      omittedSelected: 0,
    });
    const result = await load(await bindAnnualPacket(packet));
    const selectedScan = result.evidence.facts.scans.find(
      (item) => item.concept === "Revenues",
    )!.scan;
    expect(selectedScan).toMatchObject({
      status: "available",
      coverage: {
        selected: 1,
        otherAccessions: 9_999,
        returned: 1,
        omittedSelected: 0,
      },
    });
    expect(
      Object.hasOwn(
        selectedScan.status === "available" ? selectedScan.coverage : {},
        "history",
      ),
    ).toBe(false);
    const view = derivePersonalSecAnnualCanonicalView(result.evidence);
    expect(statementCell(view, "Revenues")).toMatchObject({
      status: "available",
    });
    expect(view.income.summaryReturned.observations).toBe(4);
    expect(result.evidence.facts.observations).toHaveLength(32);
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
    { accessionNumber: "0000999999-26-000002" },
    { unit: "CAD" },
    { endDate: "2025-02-30" },
    { filing: { status: "matched", sourceUrl: "javascript:alert(1)" } },
    { filing: { status: "matched", reportDate: "2024-12-31" } },
  ])("rejects corrupted canonical observation %#", async (changes) => {
    const packet = await testAnnualPacket();
    const row = packet.evidence.facts.observations.find(
      (row) => row.concept === "Revenues",
    )!;
    Object.assign(
      row,
      changes,
      "filing" in changes
        ? { filing: { ...row.filing, ...changes.filing } }
        : {},
    );
    await expect(load(packet)).rejects.toMatchObject({
      code: "invalid_response",
    });
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
    fetchMock.mockResolvedValueOnce(json({ code: "not_configured" }, status));
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
    ).rejects.toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each(["not-json", '{"code":"different"}', ""])(
    "keeps generic503 failures unavailable for %s",
    async (body) => {
      fetchMock.mockResolvedValueOnce(new Response(body, { status: 503 }));
      await expect(
        fetchPersonalSecAnnualEvidence(request(), signal()),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it("maps transport failure without retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Connection unavailable"));
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each([
    new Uint8Array([0xff]),
    new Uint8Array([0xf0, 0x9f]),
    new TextEncoder().encode("{bad"),
    null,
  ])("rejects malformed or absent streamed body %#", async (body) => {
    fetchMock.mockResolvedValueOnce(new Response(body));
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("decodes Unicode split between stream chunks without losing original metadata", async () => {
    const wire = await canonicalAnnualPacket();
    const bytes = new TextEncoder().encode(JSON.stringify(wire));
    const position = bytes.findIndex((value) => value === 0xf0);
    expect(position).toBeGreaterThan(0);
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(bytes.slice(0, position + 1));
            controller.enqueue(bytes.slice(position + 1, position + 3));
            controller.enqueue(bytes.slice(position + 3));
            controller.close();
          },
        }),
      ),
    );
    expect(await fetchPersonalSecAnnualEvidence(request(), signal())).toEqual(
      wire,
    );
  });
  it("rejects the whole over-limit stream, cancels its reader and performs no hash work", async () => {
    const cancel = vi.fn();
    const digest = vi.spyOn(crypto.subtle, "digest");
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new Uint8Array(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes),
            );
            controller.enqueue(new Uint8Array([1]));
          },
          cancel,
        }),
      ),
    );
    await expect(
      fetchPersonalSecAnnualEvidence(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(digest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("aborts before IO and while a pending response body is read", async () => {
    const early = new AbortController();
    early.abort();
    await expect(
      fetchPersonalSecAnnualEvidence(request(), early.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(new ReadableStream({ cancel })),
    );
    const held = new AbortController();
    const pending = fetchPersonalSecAnnualEvidence(request(), held.signal);
    await Promise.resolve();
    await Promise.resolve();
    held.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("propagates cancellation during stream-to-decoder hashing without a late result", async () => {
    const wire = await canonicalAnnualPacket();
    const held = holdHash();
    fetchMock.mockResolvedValueOnce(json(wire));
    const abort = new AbortController();
    const pending = fetchPersonalSecAnnualEvidence(request(), abort.signal);
    await vi.waitFor(() => expect(held.spy).toHaveBeenCalled());
    abort.abort();
    held.release();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(held.spy).toHaveBeenCalledTimes(32);
  });
  it.each([false, true])(
    "admits an actual1600-observation canonical packet with escaped metadata=%s within unchanged bounds",
    async (escapedMetadata) => {
      const graph = await canonicalAnnualPacket({
        rowsPerConcept: 50,
        escapedMetadata,
      });
      const captured = {
        ...request(),
        listingId: "a".repeat(128),
        symbol: "A".repeat(15),
      };
      const wire = {
        ...graph,
        security: {
          ...graph.security,
          listingId: captured.listingId,
          symbol: captured.symbol,
          issuerId: "i".repeat(128),
          issuerName: "😀".repeat(512),
          securityName: "😀".repeat(512),
        },
      };
      expect(wire.evidence.facts.observations).toHaveLength(1600);
      expect(
        new TextEncoder().encode(JSON.stringify(wire)).byteLength,
      ).toBeLessThan(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes);
      fetchMock.mockResolvedValueOnce(json(wire));
      const result = await fetchPersonalSecAnnualEvidence(captured, signal());
      expect(result).toEqual(wire);
      expect(
        result.evidence.facts.scans.every(
          (item) =>
            item.scan.status === "available" &&
            item.scan.coverage.returned === 50,
        ),
      ).toBe(true);
      expect(Object.isFrozen(result.evidence.facts.observations[1599])).toBe(
        true,
      );
      expect(
        derivePersonalSecAnnualCanonicalView(result.evidence).statements
          .statements,
      ).toHaveLength(3);
    },
  );
  it("refuses actual escaped3200-observation wire as a whole before hashing and keeps finite limits", async () => {
    const wire = await canonicalAnnualPacket({
      rowsPerConcept: 100,
      escapedMetadata: true,
    });
    expect(wire.evidence.facts.observations).toHaveLength(3200);
    expect(
      new TextEncoder().encode(JSON.stringify(wire)).byteLength,
    ).toBeGreaterThan(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS.responseBytes);
    const hash = vi.spyOn(crypto.subtle, "digest");
    await expect(load(wire)).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(hash).not.toHaveBeenCalled();
    expect(wire.evidence.facts.observations).toHaveLength(3200);
    expect(MANAGED_SEC_ANNUAL_EVIDENCE_LIMITS).toEqual({
      requestBytes: 4096,
      responseBytes: 2_097_152,
    });
    expect(PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes).toBe(
      8 * 1024 * 1024,
    );
    expect(PERSONAL_SEC_ANNUAL_STATEMENT_FACT_LIMITS).toMatchObject({
      candidateRowsPerConcept: 10_000,
      observationsPerConcept: 100,
      observations: 3200,
      decimalCharacters: 64,
    });
  });
});

function holdHash() {
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  const spy = vi
    .spyOn(crypto.subtle, "digest")
    .mockImplementationOnce(async (algorithm, input) => {
      await gate;
      return digest(algorithm, input);
    });
  return { release, spy };
}
describe("canonical decoder ownership used by the local transport", () => {
  it("captures the unknown packet and request before hashing and freezes only its own result", async () => {
    const original = await canonicalAnnualPacket();
    const wire = structuredClone(
      original,
    ) as Mutable<PersonalSecAnnualCanonicalResponseDto>;
    const captured = request();
    const pending = parseSecAnnualCanonicalResponse(wire, captured, signal());
    Object.assign(wire.security, { symbol: "OTHER", issuerName: "Changed" });
    wire.evidence.facts.observations[0]!.value = "999";
    Object.assign(captured, { symbol: "OTHER", listingId: "listing-other" });
    const result = await pending;
    expect(result).toEqual(original);
    expect(result).not.toBe(wire);
    expect(
      Object.isFrozen(result?.evidence.facts.observations[0]!.filing),
    ).toBe(true);
    expect(Object.isFrozen(result?.evidence.facts.scans)).toBe(true);
    expect(Object.isFrozen(wire)).toBe(false);
    expect(Object.isFrozen(wire.evidence.facts.observations[0])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns null for uncloneable packets and captured request identity mismatches without fetching", async () => {
    const wire = await canonicalAnnualPacket();
    for (const bad of [null, { ...wire, unexpected: () => undefined }])
      expect(
        await parseSecAnnualCanonicalResponse(bad, request(), signal()),
      ).toBeNull();
    for (const different of [
      {
        ...request(),
        catalogSnapshotSha256: `sha256:${"d".repeat(64)}` as const,
      },
      { ...request(), listingId: "listing-other" },
      { ...request(), symbol: "OTHER" },
    ])
      expect(
        await parseSecAnnualCanonicalResponse(wire, different, signal()),
      ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("propagates early or pending-hash cancellation and does not start another digest batch", async () => {
    const wire = await canonicalAnnualPacket({ rowsPerConcept: 2 });
    const early = new AbortController();
    early.abort();
    await expect(
      parseSecAnnualCanonicalResponse(wire, request(), early.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    const held = holdHash();
    const abort = new AbortController();
    const pending = parseSecAnnualCanonicalResponse(
      wire,
      request(),
      abort.signal,
    );
    expect(held.spy).toHaveBeenCalledTimes(32);
    abort.abort();
    held.release();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(held.spy).toHaveBeenCalledTimes(32);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
