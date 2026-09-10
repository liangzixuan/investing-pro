import { createHash } from "node:crypto";

import {
  PERSONAL_SEC_FILING_CONTEXT_LIMITS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  type PersonalSecFilingContextParserResultDto,
  type PersonalSecFilingContextSelectionDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PersonalSecFilingContextParserError,
  type PersonalSecFilingContextParser,
} from "./personal-sec-filing-context-parser";
import {
  createSecPersonalFilingContextProvider,
  isPersonalSecFilingContextSelection,
} from "./personal-sec-filing-context-provider";
import {
  normalizePersonalSecCompanyFacts,
  parsePersonalSecSourceJson,
} from "./personal-sec-quarterly-evidence-provider";
import {
  createPersonalSecRequestScheduler,
  PersonalSecRequestSchedulerError,
} from "./personal-sec-request-scheduler";

const NOW = new Date("2026-09-10T12:00:00.000Z");
const USER_AGENT = "SyntheticResearch/1.0 owner@example.test";
const CIK = "0000000042";
const ACCESSION = "0000999999-26-000001";
const FACTS_URL = `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`;
const SUBMISSIONS_URL = `https://data.sec.gov/submissions/CIK${CIK}.json`;
const DOCUMENT_URL = `https://www.sec.gov/Archives/edgar/data/42/${ACCESSION.replaceAll("-", "")}/report.htm`;
const DOCUMENT = "<html><body>synthetic document only</body></html>";
const ANALYSIS: PersonalSecFilingContextParserResultDto = Object.freeze({
  status: "no_corresponding_fact",
  reason: null,
  candidates: Object.freeze([]),
  correspondingCandidateLocators: Object.freeze([]),
});

function fact(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    start: "2025-01-01",
    end: "2025-03-31",
    val: 120,
    accn: ACCESSION,
    fy: 2026,
    fp: "Q1",
    form: "10-Q",
    filed: "2026-05-01",
    frame: "CY2025Q1",
    ...overrides,
  };
}
function facts(rows: readonly unknown[] = [fact()]): Record<string, unknown> {
  return {
    cik: 42,
    facts: { "us-gaap": { Revenues: { units: { USD: rows } } } },
  };
}
function submissions(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    cik: 42,
    filings: {
      recent: {
        accessionNumber: [ACCESSION],
        form: ["10-Q"],
        filingDate: ["2026-05-01"],
        reportDate: ["2025-03-31"],
        acceptanceDateTime: ["2026-05-01T16:00:00Z"],
        primaryDocument: ["report.htm"],
        ...overrides,
      },
      files: [{ name: "https://attacker.invalid/never-fetch.json" }],
    },
  };
}
function selection(
  rows: readonly unknown[] = [fact()],
): PersonalSecFilingContextSelectionDto {
  const row = normalizePersonalSecCompanyFacts(
    parsePersonalSecSourceJson(JSON.stringify(facts(rows))),
    CIK,
  ).observations[0]!;
  return {
    id: row.id,
    metric: row.metric,
    taxonomy: row.taxonomy,
    concept: row.concept,
    unit: row.unit,
    value: row.value,
    startDate: row.startDate,
    endDate: row.endDate,
    accessionNumber: row.accessionNumber,
    form: row.form,
    filedDate: row.filedDate,
  };
}
function url(input: RequestInfo | URL): string {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
function responseAt(index: number): Response {
  return index === 0
    ? Response.json(facts())
    : index === 1
      ? Response.json(submissions())
      : new Response(DOCUMENT, {
          headers: { "Content-Type": "text/html; charset=UTF-8" },
        });
}
function setup(
  replies: readonly (() => Response | Promise<Response>)[] = [],
  customParser?: PersonalSecFilingContextParser,
) {
  const starts: number[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>((_input, _init) => {
    void _input;
    void _init;
    const index = starts.length;
    starts.push(Date.now());
    return Promise.resolve(replies[index]?.() ?? responseAt(index));
  });
  const parse = vi
    .fn<PersonalSecFilingContextParser["parse"]>()
    .mockResolvedValue(ANALYSIS);
  const close = vi.fn();
  const parser = customParser ?? { parse, close };
  const provider = createSecPersonalFilingContextProvider(USER_AGENT, {
    fetch,
    now: () => NOW,
    scheduler: createPersonalSecRequestScheduler({ now: () => Date.now() }),
    parser,
  });
  return { provider, fetch, starts, parse, close };
}
async function finish<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return pending;
}

describe("SEC selected filing context acquisition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("revalidates exact retained source rows before fetching one fixed primary document", async () => {
    const fixture = setup();
    expect(fixture.fetch).not.toHaveBeenCalled();
    const result = await finish(fixture.provider.loadContext(CIK, selection()));
    expect(result.status).toBe("available");
    if (result.status !== "available")
      throw Error("Expected available context");
    expect(result.cik).toBe(CIK);
    expect(result.observation).toMatchObject({
      ...selection(),
      filing: { status: "matched", acceptedAt: "2026-05-01T16:00:00Z" },
    });
    expect(result.document).toEqual({
      sourceUrl: DOCUMENT_URL,
      fetchedAt: NOW.toISOString(),
      sha256: `sha256:${createHash("sha256").update(DOCUMENT).digest("hex")}`,
      bytes: Buffer.byteLength(DOCUMENT),
    });
    expect(result.companyFacts).toEqual({
      sourceUrl: FACTS_URL,
      fetchedAt: NOW.toISOString(),
    });
    expect(result.submissions).toEqual({
      sourceUrl: SUBMISSIONS_URL,
      fetchedAt: NOW.toISOString(),
    });
    expect(result.analysis).toBe(ANALYSIS);
    expect(fixture.fetch.mock.calls.map(([input]) => url(input))).toEqual([
      FACTS_URL,
      SUBMISSIONS_URL,
      DOCUMENT_URL,
    ]);
    for (const [, init] of fixture.fetch.mock.calls)
      expect(init).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        headers: { "User-Agent": USER_AGENT },
      });
    expect(fixture.starts[1]! - fixture.starts[0]!).toBeGreaterThanOrEqual(220);
    expect(fixture.starts[2]! - fixture.starts[1]!).toBeGreaterThanOrEqual(220);
    expect(fixture.parse).toHaveBeenCalledOnce();
    expect(fixture.parse.mock.calls[0]?.[0]).toEqual({
      document: new TextEncoder().encode(DOCUMENT),
      cik: CIK,
      selection: selection(),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.observation.filing)).toBe(true);
    fixture.provider.close();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("performs fresh revalidation on every explicit inspection", async () => {
    const fixture = setup(
      Array.from({ length: 6 }, (_, index) => () => responseAt(index % 3)),
    );
    await finish(fixture.provider.loadContext(CIK, selection()));
    await finish(fixture.provider.loadContext(CIK, selection()));
    expect(fixture.fetch).toHaveBeenCalledTimes(6);
    expect(fixture.parse).toHaveBeenCalledTimes(2);
  });

  it.each([
    { id: `sec-fact:${"0".repeat(64)}` },
    { value: "121" },
    { concept: "SalesRevenueNet" },
    { startDate: "2025-01-02" },
    { endDate: "2025-03-30" },
    { accessionNumber: "0000999999-26-000002" },
    { form: "10-Q/A" },
    { filedDate: "2026-05-02" },
  ])(
    "withholds changed selected field %j before further source requests",
    async (overrides) => {
      const fixture = setup();
      const result = await finish(
        fixture.provider.loadContext(CIK, {
          ...selection(),
          ...overrides,
        } as PersonalSecFilingContextSelectionDto),
      );
      expect(result).toEqual({
        status: "unavailable",
        cik: CIK,
        stage: "company_facts",
        reason: "selection_changed_or_not_retained",
      });
      expect(fixture.fetch).toHaveBeenCalledOnce();
      expect(fixture.parse).not.toHaveBeenCalled();
    },
  );

  it.each([
    { rows: [] },
    { rows: [fact({ fy: 2025 })] },
    { rows: [fact({ fp: "Q2" })] },
    { rows: [fact({ frame: "CY2025Q2" })] },
  ])(
    "refuses absent or changed normalized source membership",
    async ({ rows }) => {
      const fixture = setup([() => Response.json(facts(rows))]);
      const result = await finish(
        fixture.provider.loadContext(CIK, selection()),
      );
      expect(result).toMatchObject({
        status: "unavailable",
        reason: "selection_changed_or_not_retained",
      });
      expect(fixture.fetch).toHaveBeenCalledOnce();
    },
  );

  it("does not re-admit an observation omitted by the existing per-metric retention cap", async () => {
    const rows = [
      fact(),
      ...Array.from({ length: 100 }, (_, index) =>
        fact({ val: index, filed: "2026-05-02" }),
      ),
    ];
    const fixture = setup([() => Response.json(facts(rows))]);
    expect(
      await finish(fixture.provider.loadContext(CIK, selection())),
    ).toMatchObject({ reason: "selection_changed_or_not_retained" });
    expect(fixture.fetch).toHaveBeenCalledOnce();
  });

  it("preserves exact large decimals and snapshots caller input before awaiting", async () => {
    const text = JSON.stringify(facts()).replace(
      '"val":120',
      '"val":9007199254740993.25',
    );
    const chosen = {
      ...selection(),
      ...normalizePersonalSecCompanyFacts(parsePersonalSecSourceJson(text), CIK)
        .observations[0]!,
    };
    const requested = Object.fromEntries(
      Object.keys(selection()).map((key) => [
        key,
        chosen[key as keyof typeof chosen],
      ]),
    ) as unknown as PersonalSecFilingContextSelectionDto;
    const fixture = setup([
      () =>
        new Response(text, { headers: { "Content-Type": "application/json" } }),
    ]);
    const pending = fixture.provider.loadContext(CIK, requested);
    Object.assign(requested, { value: "999" });
    const result = await finish(pending);
    expect(result.status).toBe("available");
    if (result.status === "available")
      expect(result.observation.value).toBe("9007199254740993.25");
    expect(fixture.parse.mock.calls[0]?.[0].selection.value).toBe(
      "9007199254740993.25",
    );
  });

  it.each([0, 1])(
    "rejects wrong-issuer source at stage %s without a document fetch",
    async (index) => {
      const replies = [() => responseAt(0), () => responseAt(1)];
      replies[index] = () =>
        Response.json({ ...(index === 0 ? facts() : submissions()), cik: 43 });
      const fixture = setup(replies);
      expect(
        await finish(fixture.provider.loadContext(CIK, selection())),
      ).toMatchObject({ status: "unavailable", reason: "invalid_response" });
      expect(fixture.fetch).toHaveBeenCalledTimes(index + 1);
      expect(fixture.parse).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      { accessionNumber: ["0000999999-26-000002"] },
      "accession_not_in_current_submissions",
    ],
    [{ form: ["10-Q/A"] }, "submission_metadata_conflict"],
    [{ filingDate: ["2026-05-02"] }, "submission_metadata_conflict"],
  ] as const)(
    "requires matching current submission metadata %j",
    async (overrides, reason) => {
      const fixture = setup([
        () => responseAt(0),
        () => Response.json(submissions(overrides)),
      ]);
      expect(
        await finish(fixture.provider.loadContext(CIK, selection())),
      ).toEqual({
        status: "unavailable",
        cik: CIK,
        stage: "submissions",
        reason,
      });
      expect(fixture.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    null,
    [],
    ["https://attacker.invalid/report.htm"],
    ["../report.htm"],
    ["report..htm"],
    ["/report.htm"],
    ["report%2ehtm"],
    ["report.htm?x=1"],
    ["report.htm#x"],
    ["report\\x.htm"],
    ["report.pdf"],
    ["report.htm", "extra.htm"],
    [`${"a".repeat(252)}.htm`],
  ])(
    "rejects unsafe or missing primary document %j",
    async (primaryDocument) => {
      const fixture = setup([
        () => responseAt(0),
        () => Response.json(submissions({ primaryDocument })),
      ]);
      expect(
        await finish(fixture.provider.loadContext(CIK, selection())),
      ).toMatchObject({
        stage: "submissions",
        reason: "primary_document_unavailable",
      });
      expect(fixture.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it("accepts the exact basename bound and supported uppercase XML extension", async () => {
    const basename = `${"a".repeat(251)}.XML`;
    const fixture = setup([
      () => responseAt(0),
      () => Response.json(submissions({ primaryDocument: [basename] })),
    ]);
    expect(
      (await finish(fixture.provider.loadContext(CIK, selection()))).status,
    ).toBe("available");
    expect(url(fixture.fetch.mock.calls[2]![0])).toBe(
      DOCUMENT_URL.replace("report.htm", basename),
    );
  });

  it("refuses conflicting primary basenames for duplicate accession entries", async () => {
    const fixture = setup([
      () => responseAt(0),
      () =>
        Response.json(
          submissions({
            accessionNumber: [ACCESSION, ACCESSION],
            form: ["10-Q", "10-Q"],
            filingDate: ["2026-05-01", "2026-05-01"],
            reportDate: ["2025-03-31", "2025-03-31"],
            acceptanceDateTime: [
              "2026-05-01T16:00:00Z",
              "2026-05-01T16:00:00Z",
            ],
            primaryDocument: ["a.htm", "b.htm"],
          }),
        ),
    ]);
    expect(
      await finish(fixture.provider.loadContext(CIK, selection())),
    ).toMatchObject({ reason: "primary_document_unavailable" });
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([0, 1, 2])(
    "stops the pipeline on source rate limiting at stage %s",
    async (index) => {
      const replies = Array.from(
        { length: 3 },
        (_, current) => () =>
          current === index
            ? new Response("private-source-canary", { status: 429 })
            : responseAt(current),
      );
      const fixture = setup(replies);
      const result = await finish(
        fixture.provider.loadContext(CIK, selection()),
      );
      expect(result).toMatchObject({
        status: "unavailable",
        stage: ["company_facts", "submissions", "document"][index],
        reason: "rate_limited",
      });
      expect(JSON.stringify(result)).not.toContain("private-source-canary");
      expect(fixture.fetch).toHaveBeenCalledTimes(index + 1);
      expect(fixture.parse).not.toHaveBeenCalled();
    },
  );

  it.each([
    "application/pdf",
    "text/html; charset=iso-8859-1",
    "text/html; charset=utf-8; charset=utf-8",
    "",
  ])("rejects document media %s", async (media) => {
    const fixture = setup([
      () => responseAt(0),
      () => responseAt(1),
      () => new Response(DOCUMENT, { headers: { "Content-Type": media } }),
    ]);
    expect(
      await finish(fixture.provider.loadContext(CIK, selection())),
    ).toMatchObject({ stage: "document", reason: "invalid_response" });
    expect(fixture.parse).not.toHaveBeenCalled();
  });

  it.each([0, 1])("requires JSON media at stage %s", async (index) => {
    const fixture = setup(
      Array.from(
        { length: 2 },
        (_, current) => () =>
          current === index
            ? new Response(
                JSON.stringify(current === 0 ? facts() : submissions()),
                { headers: { "Content-Type": "text/html" } },
              )
            : responseAt(current),
      ),
    );
    expect(
      await finish(fixture.provider.loadContext(CIK, selection())),
    ).toMatchObject({ reason: "invalid_response" });
    expect(fixture.fetch).toHaveBeenCalledTimes(index + 1);
  });

  it.each(["redirected", "url"] as const)(
    "rejects a document with unsafe response %s",
    async (field) => {
      const fixture = setup([
        () => responseAt(0),
        () => responseAt(1),
        () => {
          const response = responseAt(2);
          Object.defineProperty(response, field, {
            value: field === "url" ? "https://attacker.invalid/doc.htm" : true,
          });
          return response;
        },
      ]);
      expect(
        await finish(fixture.provider.loadContext(CIK, selection())),
      ).toMatchObject({ stage: "document", reason: "invalid_response" });
      expect(fixture.fetch).toHaveBeenCalledTimes(3);
      expect(fixture.parse).not.toHaveBeenCalled();
    },
  );

  it("applies the existing JSON and candidate caps before document acquisition", async () => {
    const tooLarge = setup([
      () =>
        new Response("x", {
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(
              PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.responseBytes + 1,
            ),
          },
        }),
    ]);
    expect(
      await finish(tooLarge.provider.loadContext(CIK, selection())),
    ).toMatchObject({ stage: "company_facts", reason: "response_too_large" });
    expect(tooLarge.fetch).toHaveBeenCalledOnce();
    const rows = Array.from(
      { length: PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS.candidateRows + 1 },
      () => fact(),
    );
    const tooMany = setup([() => Response.json(facts(rows))]);
    expect(
      await finish(tooMany.provider.loadContext(CIK, selection())),
    ).toMatchObject({ stage: "company_facts", reason: "candidate_limit" });
    expect(tooMany.fetch).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "rejects a document above32MiB from %s size evidence",
    async (streamed) => {
      const fixture = setup([
        () => responseAt(0),
        () => responseAt(1),
        () =>
          streamed
            ? new Response(
                new Uint8Array(
                  PERSONAL_SEC_FILING_CONTEXT_LIMITS.documentBytes + 1,
                ),
                { headers: { "Content-Type": "text/html" } },
              )
            : new Response("x", {
                headers: {
                  "Content-Type": "text/html",
                  "Content-Length": String(
                    PERSONAL_SEC_FILING_CONTEXT_LIMITS.documentBytes + 1,
                  ),
                },
              }),
      ]);
      expect(
        await finish(fixture.provider.loadContext(CIK, selection())),
      ).toMatchObject({ stage: "document", reason: "response_too_large" });
      expect(fixture.parse).not.toHaveBeenCalled();
    },
  );

  it("accepts exactly32MiB without losing the raw byte digest", async () => {
    const bytes = new Uint8Array(
      PERSONAL_SEC_FILING_CONTEXT_LIMITS.documentBytes,
    ).fill(32);
    const fixture = setup([
      () => responseAt(0),
      () => responseAt(1),
      () => new Response(bytes, { headers: { "Content-Type": "text/html" } }),
    ]);
    const result = await finish(fixture.provider.loadContext(CIK, selection()));
    expect(result).toMatchObject({
      status: "available",
      document: {
        bytes: bytes.byteLength,
        sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      },
    });
  });

  it("rejects malformed UTF8 document bytes before parsing", async () => {
    const fixture = setup([
      () => responseAt(0),
      () => responseAt(1),
      () =>
        new Response(new Uint8Array([0xc3, 0x28]), {
          headers: { "Content-Type": "text/html" },
        }),
    ]);
    expect(
      await finish(fixture.provider.loadContext(CIK, selection())),
    ).toMatchObject({ stage: "document", reason: "invalid_response" });
    expect(fixture.parse).not.toHaveBeenCalled();
  });

  it.each([
    "runtime_unavailable",
    "timeout",
    "worker_failed",
    "invalid_output",
    "output_too_large",
    "invalid_request",
  ] as const)(
    "exposes parser failure %s without source or process details",
    async (code) => {
      const fixture = setup();
      fixture.parse.mockRejectedValueOnce(
        new PersonalSecFilingContextParserError(code),
      );
      expect(
        await finish(fixture.provider.loadContext(CIK, selection())),
      ).toEqual({
        status: "unavailable",
        cik: CIK,
        stage: "parser",
        reason:
          code === "timeout"
            ? "parser_timeout"
            : code === "invalid_request"
              ? "invalid_output"
              : code,
      });
    },
  );

  it.each([0, 1, 2])(
    "cancels during fetch %s and ignores its late completion",
    async (index) => {
      let release: ((response: Response) => void) | undefined;
      const fixture = setup(
        Array.from({ length: 3 }, (_, current) =>
          current === index
            ? () =>
                new Promise<Response>((resolve) => {
                  release = resolve;
                })
            : () => responseAt(current),
        ),
      );
      const controller = new AbortController();
      const pending = fixture.provider.loadContext(
        CIK,
        selection(),
        controller.signal,
      );
      const rejected = expect(pending).rejects.toMatchObject({
        code: "aborted",
      });
      await vi.advanceTimersByTimeAsync(index * 221 + 1);
      expect(fixture.fetch).toHaveBeenCalledTimes(index + 1);
      controller.abort();
      await rejected;
      expect(fixture.fetch.mock.calls[index]?.[1]?.signal?.aborted).toBe(true);
      release!(responseAt(index));
      await vi.runAllTimersAsync();
      expect(fixture.fetch).toHaveBeenCalledTimes(index + 1);
      expect(fixture.parse).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("cancels a queued request without fetching or consuming another slot", async () => {
    const scheduler = createPersonalSecRequestScheduler({
      now: () => Date.now(),
    });
    await scheduler.wait(new AbortController().signal);
    await vi.advanceTimersByTimeAsync(0);
    const fetch = vi.fn<typeof globalThis.fetch>();
    const controller = new AbortController();
    const provider = createSecPersonalFilingContextProvider(USER_AGENT, {
      fetch,
      scheduler,
      parser: { parse: vi.fn(), close: vi.fn() },
    });
    const pending = provider.loadContext(CIK, selection(), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: "aborted" });
    controller.abort();
    await rejected;
    await vi.runAllTimersAsync();
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])(
    "cancels active parsing on owner abort/shutdown=%s",
    async (shutdown) => {
      let release:
        ((result: PersonalSecFilingContextParserResultDto) => void) | undefined;
      const fixture = setup();
      fixture.parse.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const controller = new AbortController();
      const pending = fixture.provider.loadContext(
        CIK,
        selection(),
        controller.signal,
      );
      const rejected = expect(pending).rejects.toMatchObject({
        code: "aborted",
      });
      await vi.runAllTimersAsync();
      expect(fixture.parse).toHaveBeenCalledOnce();
      if (shutdown) fixture.provider.close();
      else controller.abort();
      await rejected;
      expect(fixture.parse.mock.calls[0]?.[1]?.aborted).toBe(true);
      release!(ANALYSIS);
      await Promise.resolve();
      expect(fixture.fetch).toHaveBeenCalledTimes(3);
      if (shutdown) {
        expect(fixture.close).toHaveBeenCalledOnce();
        expect(fixture.provider.status()).toEqual({ configured: false });
      }
    },
  );

  it("keeps transport deadline after queue wait and releases busy state after timeout", async () => {
    let release: (() => void) | undefined;
    const scheduler = {
      wait: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              release = resolve;
            }),
        )
        .mockResolvedValue(undefined),
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(() => new Promise<Response>(() => undefined));
    const provider = createSecPersonalFilingContextProvider(USER_AGENT, {
      fetch,
      scheduler,
      parser: { parse: vi.fn(), close: vi.fn() },
    });
    const pending = provider.loadContext(CIK, selection());
    await expect(provider.loadContext(CIK, selection())).rejects.toMatchObject({
      code: "busy",
    });
    await vi.advanceTimersByTimeAsync(12_000);
    expect(fetch).not.toHaveBeenCalled();
    release!();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(await pending).toMatchObject({
      stage: "company_facts",
      reason: "upstream_unavailable",
    });
    fetch.mockResolvedValueOnce(new Response("unavailable", { status: 404 }));
    expect(await finish(provider.loadContext(CIK, selection()))).toMatchObject({
      reason: "not_covered",
    });
  });

  it("maps shared scheduler saturation to a sanitized busy error", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const provider = createSecPersonalFilingContextProvider(USER_AGENT, {
      fetch,
      scheduler: {
        wait: () =>
          Promise.reject(new PersonalSecRequestSchedulerError("busy")),
      },
      parser: { parse: vi.fn(), close: vi.fn() },
    });
    await expect(provider.loadContext(CIK, selection())).rejects.toMatchObject({
      code: "busy",
      name: "PersonalSecFilingContextProviderError",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unconfigured, unsupported, URL-bearing and malformed requests before any source call", async () => {
    const fixture = setup();
    const values: unknown[] = [
      null,
      [],
      { ...selection(), form: "10-K" },
      { ...selection(), startDate: null },
      { ...selection(), sourceUrl: DOCUMENT_URL },
      { ...selection(), value: "1e2" },
      { ...selection(), value: "-0" },
      { ...selection(), startDate: "2025-02-30" },
      { ...selection(), unit: "EUR" },
      { ...selection(), metric: "net_income" },
    ];
    for (const value of values) {
      expect(isPersonalSecFilingContextSelection(value)).toBe(false);
      await expect(
        fixture.provider.loadContext(
          CIK,
          value as PersonalSecFilingContextSelectionDto,
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    await expect(
      fixture.provider.loadContext("0000000000", selection()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    const disabled = createSecPersonalFilingContextProvider(undefined, {
      fetch: fixture.fetch,
      parser: { parse: vi.fn(), close: vi.fn() },
    });
    expect(disabled.status()).toEqual({ configured: false });
    await expect(disabled.loadContext(CIK, selection())).rejects.toMatchObject({
      code: "not_configured",
    });
    expect(fixture.fetch).not.toHaveBeenCalled();
  });

  it("runs synthetic source transport through the real asynchronous worker", async () => {
    vi.useRealTimers();
    const document = `<html xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:us-gaap="http://fasb.org/us-gaap/2025" xmlns:iso4217="http://www.xbrl.org/2003/iso4217">
      <xbrli:context id="c"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0000000042</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate></xbrli:period></xbrli:context>
      <xbrli:unit id="u"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
      <ix:nonFraction id="revenue" name="us-gaap:Revenues" contextRef="c" unitRef="u" decimals="0">120</ix:nonFraction>
    </html>`;
    const fetch = vi.fn<typeof globalThis.fetch>((input) =>
      Promise.resolve(
        url(input) === DOCUMENT_URL
          ? new Response(document, { headers: { "Content-Type": "text/html" } })
          : url(input) === FACTS_URL
            ? responseAt(0)
            : responseAt(1),
      ),
    );
    const provider = createSecPersonalFilingContextProvider(USER_AGENT, {
      fetch,
      now: () => NOW,
      scheduler: { wait: () => Promise.resolve() },
    });
    try {
      const result = await provider.loadContext(CIK, selection());
      expect(result.status).toBe("available");
      if (result.status !== "available")
        throw Error(`Unavailable synthetic context: ${result.reason}`);
      expect(result.analysis).toMatchObject({
        status: "matched",
        reason: null,
      });
      expect(result.analysis.candidates).toHaveLength(1);
      expect(result.analysis.candidates[0]).toMatchObject({
        factId: "revenue",
        contextId: "c",
        unitId: "u",
        entityCik: CIK,
        unit: "USD",
        value: "120",
        startDate: "2025-01-01",
        endDate: "2025-03-31",
        issues: [],
      });
      expect(result.document.sha256).toBe(
        `sha256:${createHash("sha256").update(document).digest("hex")}`,
      );
      expect(fetch.mock.calls.map(([input]) => url(input))).toEqual([
        FACTS_URL,
        SUBMISSIONS_URL,
        DOCUMENT_URL,
      ]);
    } finally {
      provider.close();
    }
  });
});
