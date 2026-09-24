import { createHash } from "node:crypto";
import type {
  PersonalSecQuarterAssessmentSelectionDto,
  PersonalSecQuarterAssessmentTargetDto,
} from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonalSecFilingContextParserError,
  type PersonalSecPrimaryParser,
} from "./personal-sec-filing-context-parser";
import {
  createSecPersonalQuarterAssessmentProvider,
  type PersonalSecQuarterAssessmentProvider,
  type SecPersonalQuarterAssessmentDependencies,
} from "./personal-sec-quarter-assessment-provider";

const providers: PersonalSecQuarterAssessmentProvider[] = [];
afterEach(() => {
  providers.splice(0).forEach((provider) => provider.close());
  vi.useRealTimers();
});

describe("selected SEC quarter acquisition", () => {
  it("makes three serial fixed-origin reads and retains exact source byte hashes", async () => {
    const fixture = setup();
    const result = await fixture.provider.assess(target(), selection());
    expect(result).toMatchObject({
      status: "unavailable",
      stage: "parser",
      reason: "structural_limit",
    });
    expect(fixture.fetch.mock.calls.map(([url]) => url)).toEqual([
      "https://data.sec.gov/submissions/CIK0000000001.json",
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
      "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/report.htm",
    ]);
    expect(
      result.sources.map((source) => [source.id, source.bytes, source.sha256]),
    ).toEqual(
      ["submissions", "company_facts", "primary"].map((id, index) => {
        const bytes = [fixture.submissions, fixture.facts, fixture.document][
          index
        ]!;
        return [
          id,
          Buffer.byteLength(bytes, "utf8"),
          `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        ];
      }),
    );
    for (const [, options] of fixture.fetch.mock.calls) {
      expect(options).toMatchObject({
        method: "GET",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: { "User-Agent": "SyntheticResearch owner@example.test" },
      });
    }
    expect(JSON.stringify(result)).not.toContain("owner@example.test");
    expect(JSON.stringify(result)).not.toContain("<html");
    const parserInput =
      fixture.parser.parseAccessionEvidence.mock.calls[0]?.[0];
    expect(parserInput).toEqual({
      document: new TextEncoder().encode(fixture.document),
      cik: "0000000001",
      selection: selection(),
    });
  });

  it.each(["form", "filedDate", "reportDate"] as const)(
    "refuses changed %s before later reads",
    async (field) => {
      const fixture = setup();
      const changed = {
        ...selection(),
        [field]:
          field === "form"
            ? "10-Q/A"
            : field === "reportDate"
              ? "2026-03-30"
              : "2026-06-30",
      };
      // Amendments are intentionally held before any acquisition.
      const result = await fixture.provider.assess(target(), changed);
      expect(result).toMatchObject(
        field === "form"
          ? { status: "held", reason: "unsupported_amendment" }
          : { status: "unavailable", reason: "submission_metadata_conflict" },
      );
      expect(fixture.fetch).toHaveBeenCalledTimes(field === "form" ? 0 : 1);
      expect(fixture.parser.parseAccessionEvidence).not.toHaveBeenCalled();
    },
  );

  it("holds missing report dates without acquiring", async () => {
    const fixture = setup();
    expect(
      await fixture.provider.assess(target(), {
        ...selection(),
        reportDate: null,
      }),
    ).toMatchObject({
      status: "held",
      stage: "selection",
      reason: "report_date_unresolved",
      sources: [],
    });
    expect(fixture.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "../report.htm",
    "https://evil.invalid/report.htm",
    "report.htm?x=1",
  ])("refuses unsupported primary basename %s", async (document) => {
    const fixture = setup({
      sourceSubmissions: JSON.stringify(submissions(document)),
    });
    expect(await fixture.provider.assess(target(), selection())).toMatchObject({
      status: "unavailable",
      reason: "primary_document_unavailable",
    });
    expect(fixture.fetch).toHaveBeenCalledOnce();
  });

  it("rejects duplicate Submissions keys before normalizing them", async () => {
    const fixture = setup({
      sourceSubmissions: JSON.stringify(submissions()).replace(
        '"cik":1',
        '"cik":2,"ci\\u006b":1',
      ),
    });
    expect(await fixture.provider.assess(target(), selection())).toMatchObject({
      status: "unavailable",
      stage: "submissions",
      reason: "duplicate_json_key",
    });
    expect(fixture.fetch).toHaveBeenCalledOnce();
  });

  it("does not fetch a primary document after incomplete Company Facts", async () => {
    const fixture = setup({
      sourceFacts:
        '{"cik":1,"facts":{"us-gaap":{"Revenues":{"units":{"USD":null}}}}}',
    });
    expect(await fixture.provider.assess(target(), selection())).toMatchObject({
      status: "unavailable",
      stage: "company_facts",
      reason: "company_facts_structure_invalid",
    });
    expect(fixture.fetch).toHaveBeenCalledTimes(2);
    expect(fixture.parser.parseAccessionEvidence).not.toHaveBeenCalled();
  });

  it("checks the whole-operation deadline after queueing before issuing a late fetch", async () => {
    let elapsed = 0;
    const fixture = setup({
      dependencies: {
        monotonicNow: () => elapsed,
        scheduler: {
          wait: () => {
            elapsed = 60_000;
            return Promise.resolve();
          },
        },
      },
    });
    expect(await fixture.provider.assess(target(), selection())).toMatchObject({
      status: "unavailable",
      reason: "operation_deadline",
    });
    expect(fixture.fetch).not.toHaveBeenCalled();
  });

  it("aborts a request waiting in the shared queue at 60 seconds", async () => {
    vi.useFakeTimers();
    const fixture = setup({
      dependencies: {
        scheduler: {
          wait: (signal) =>
            new Promise((_resolve, reject) =>
              signal.addEventListener(
                "abort",
                () => reject(new Error("retired")),
                { once: true },
              ),
            ),
        },
      },
    });
    const pending = fixture.provider.assess(target(), selection());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await pending).toMatchObject({
      status: "unavailable",
      reason: "operation_deadline",
    });
    expect(fixture.fetch).not.toHaveBeenCalled();
  });

  it("retains the provider busy guard until a cancelled parser's owned child retires", async () => {
    const fixture = setup();
    let retire!: () => void;
    fixture.parser.parseAccessionEvidence.mockImplementation(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          retire = () =>
            reject(new PersonalSecFilingContextParserError("aborted"));
          expect(signal?.aborted).toBe(false);
        }),
    );
    const controller = new AbortController();
    const pending = fixture.provider.assess(
      target(),
      selection(),
      controller.signal,
    );
    await vi.waitFor(() =>
      expect(fixture.parser.parseAccessionEvidence).toHaveBeenCalledOnce(),
    );
    controller.abort();
    await expect(
      fixture.provider.assess(target(), selection()),
    ).rejects.toMatchObject({ code: "busy" });
    retire();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    fixture.parser.parseAccessionEvidence.mockRejectedValue(
      new PersonalSecFilingContextParserError("runtime_unavailable"),
    );
    expect(await fixture.provider.assess(target(), selection())).toMatchObject({
      reason: "runtime_unavailable",
    });
  });

  it("copies the complete target and selection before the first await", async () => {
    let release!: () => void;
    const fixture = setup({
      dependencies: {
        scheduler: {
          wait: vi
            .fn()
            .mockImplementationOnce(
              () =>
                new Promise<void>((resolve) => {
                  release = resolve;
                }),
            )
            .mockResolvedValue(undefined),
        },
      },
    });
    const selected = structuredClone(selection());
    const company = structuredClone(target());
    const pending = fixture.provider.assess(company, selected);
    (selected as { reportDate: string }).reportDate = "2026-06-30";
    (company.security as { cik: string }).cik = "0000000002";
    release();
    const result = await pending;
    expect(result.cik).toBe("0000000001");
    expect(result.selection.reportDate).toBe("2026-03-31");
  });

  it("does not retain a busy operation when its initial monotonic clock is invalid", async () => {
    let clock = NaN;
    const fixture = setup({ dependencies: { monotonicNow: () => clock } });
    await expect(
      fixture.provider.assess(target(), selection()),
    ).rejects.toThrow(TypeError);
    clock = 0;
    expect(await fixture.provider.assess(target(), selection())).toMatchObject({
      reason: "structural_limit",
    });
  });
});

function setup(
  options: {
    sourceSubmissions?: string;
    sourceFacts?: string;
    dependencies?: SecPersonalQuarterAssessmentDependencies;
  } = {},
) {
  const sourceSubmissions =
    options.sourceSubmissions ?? JSON.stringify(submissions());
  const sourceFacts = options.sourceFacts ?? '{"cik":1,"facts":{"us-gaap":{}}}';
  const document = "<html><body>synthetic quarter</body></html>";
  const fetch = vi.fn<typeof globalThis.fetch>((url) =>
    Promise.resolve(
      (url instanceof Request ? url.url : String(url)).includes("/submissions/")
        ? new Response(sourceSubmissions, {
            headers: { "content-type": "application/json" },
          })
        : (url instanceof Request ? url.url : String(url)).includes(
              "/companyfacts/",
            )
          ? new Response(sourceFacts, {
              headers: { "content-type": "application/json" },
            })
          : new Response(document, {
              headers: { "content-type": "text/html" },
            }),
    ),
  );
  const parser = {
    parse: vi.fn<PersonalSecPrimaryParser["parse"]>(),
    close: vi.fn(),
    parseAccessionEvidence: vi.fn<
      PersonalSecPrimaryParser["parseAccessionEvidence"]
    >((input) =>
      Promise.resolve({
        schemaVersion: "1.0.0",
        mode: "accession_evidence",
        documentSha256: `sha256:${createHash("sha256").update(input.document).digest("hex")}`,
        documentBytes: input.document.byteLength,
        cik: input.cik,
        selection: input.selection,
        status: "unavailable",
        reason: "structural_limit",
        concepts: [],
        contexts: [],
        units: [],
        reportingMetadata: null,
        structure: null,
      }),
    ),
  };
  const provider = createSecPersonalQuarterAssessmentProvider(
    "SyntheticResearch owner@example.test",
    {
      fetch,
      parser,
      now: () => new Date("2026-09-24T18:00:00.000Z"),
      scheduler: { wait: () => Promise.resolve() },
      ...options.dependencies,
    },
  );
  providers.push(provider);
  return {
    provider,
    fetch,
    parser,
    submissions: sourceSubmissions,
    facts: sourceFacts,
    document,
  };
}
function target(): PersonalSecQuarterAssessmentTargetDto {
  return {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common",
      symbol: "ZERO",
      cik: "0000000001",
    },
  };
}
function selection(): PersonalSecQuarterAssessmentSelectionDto {
  return {
    accessionNumber: "0000000001-26-000001",
    form: "10-Q",
    filedDate: "2026-05-01",
    reportDate: "2026-03-31",
  };
}
function submissions(primaryDocument = "report.htm") {
  return {
    cik: 1,
    filings: {
      recent: {
        accessionNumber: [selection().accessionNumber],
        form: [selection().form],
        filingDate: [selection().filedDate],
        reportDate: [selection().reportDate],
        acceptanceDateTime: ["2026-05-01T12:00:00Z"],
        primaryDocument: [primaryDocument],
      },
      files: [],
    },
  };
}
