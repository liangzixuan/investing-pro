import { COMPANY_REPORT_DOCUMENT_MAX_BYTES } from "./managed-company-report-document";
import { beforeAll, describe, expect, it } from "vitest";
import { reportAnnualPacket } from "./managed-annual-statements-report-fixture";
import { inventedManagedResearchCoverage } from "./test-managed-research-coverage-fixture";
import { eodSelection, eodResponse } from "./eod-history-fixture";
import { filingsResponse } from "./sec-filings-fixture";
import { ManagedEodHistory } from "./managed-eod-history";
import { ManagedAnnualReport } from "./managed-annual-report";
import { ManagedCompanyFilings } from "./managed-company-filings";
import { companySnapshotEvidence } from "./managed-company-snapshot";
import {
  prepareCompanyReport,
  type PreparedCompanyReport,
} from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import {
  parseCompanyReportArchive,
  decodeCompanyReportArchive,
  assertCompanyReportArchiveSize,
  COMPANY_REPORT_ARCHIVE_MAX_BYTES,
  companyReportArchiveMatches,
  projectCurrentCompanyReport,
} from "./managed-company-report-archive";

const signal = () => new AbortController().signal;
const encoder = new TextEncoder();
const note =
  "My Cafe\u0301 東京 📈 draft\n<unverified-link> & exact whitespace  ";
let report: PreparedCompanyReport;
let text: string;
async function preparedReport(selection = eodSelection) {
  const price = new ManagedEodHistory(
    () => Promise.resolve(eodResponse()),
    () => {},
    undefined,
    [eodSelection.listing],
  );
  const packet = await reportAnnualPacket();
  const annual = new ManagedAnnualReport(
    () => Promise.resolve(packet),
    () => {},
    undefined,
    { coverage: inventedManagedResearchCoverage },
  );
  const filings = new ManagedCompanyFilings(
    () => Promise.resolve(filingsResponse(2)),
    () => {},
    undefined,
    { coverage: inventedManagedResearchCoverage },
  );
  for (const model of [price, annual, filings]) {
    model.open(selection);
    await model.load();
  }
  const evidence = companySnapshotEvidence(
    selection,
    price.getSnapshot(),
    annual.getSnapshot(),
    filings.getSnapshot(),
    null,
  );
  return prepareCompanyReport(
    selection,
    evidence,
    {
      member: { ...eodSelection.listing, note },
      canEdit: true,
      canAdd: false,
      reason: null,
    },
    () => new Date("2026-10-15T00:00:00.000Z"),
  )!;
}
function data(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}
function document() {
  return data(JSON.parse(text));
}
function source(value: Record<string, unknown>, key: string) {
  return data(data(value.sources)[key]);
}
async function parse(value: unknown) {
  return parseCompanyReportArchive(JSON.stringify(value), signal());
}
beforeAll(async () => {
  report = await preparedReport();
  text = formatCompanyReportDocument(report)!.text;
});

describe("current company report archive admission", () => {
  it("retains review filing provenance and the complete original packet when reopening its report", async () => {
    const original = (await parseCompanyReportArchive(text, signal()))!;
    const value = document();
    source(value, "filings").responseOrigin = "followups-review";
    const archive = (await parse(value))!;
    expect(archive).not.toBeNull();
    expect(archive.preparedAt).toBe(original.preparedAt);
    expect(archive.listing).toEqual(original.listing);
    expect(archive.sources).toEqual(
      original.sources.map((row) =>
        row.source === "filings"
          ? { ...row, responseOrigin: "followups-review" }
          : row,
      ),
    );
    expect(archive.note).toBe(original.note);
  });
  it.each(["followups", "review", "followups-review ", "arbitrary"])(
    "refuses an unrecognized filing origin %s",
    async (origin) => {
      const value = document();
      source(value, "filings").responseOrigin = origin;
      expect(await parse(value)).toBeNull();
    },
  );
  it("retains exact identity, raw authored note and original canonical provenance in a distinct immutable archive", async () => {
    const archive = (await parseCompanyReportArchive(text, signal()))!;
    expect(archive).not.toBeNull();
    expect(archive.kind).toBe("company_report_archive");
    expect(archive.note).toBe(note);
    expect(archive.listing).toEqual(eodSelection.listing);
    expect(archive.preparedAt).toBe(report.preparedAt);
    expect(archive.byteLength).toBe(encoder.encode(text).byteLength);
    expect(archive.sources.map((value) => value.status)).toEqual([
      "loaded",
      "loaded",
      "not_loaded",
      "loaded",
    ]);
    expect(archive.sources[0]!.fields).toContainEqual({
      label: "Requested",
      value: "2026-09-20T00:00:00.000Z",
    });
    expect(
      archive.sources[1]!.fields.find(
        (value) => value.label === "Filing target",
      )!.value,
    ).toContain("0000000001-26-000001");
    expect(
      archive.sources[3]!.fields.filter((value) => value.label === "Filing"),
    ).toHaveLength(2);
    expect(archive.sources[3]!.references).toHaveLength(3);
    expect(Object.isFrozen(archive)).toBe(true);
    expect(Object.isFrozen(archive.sources[3]!.fields[0])).toBe(true);
    expect(Object.hasOwn(archive, "evidence")).toBe(false);
    expect(Object.hasOwn(archive, "valuation")).toBe(false);
    expect(archive.unverifiedAppendix).toContain("financials");
    expect(companyReportArchiveMatches(archive, eodSelection)).toBe(true);
  });
  it("roundtrips a real current report with null selected CIK and matching known Annual/Filings source CIKs", async () => {
    const selected = { ...eodSelection, cik: null };
    const current = await preparedReport(selected);
    expect(current.selection.cik).toBeNull();
    expect(current.evidence.annual!.response!.security.cik).toBe("0000000001");
    expect(current.evidence.filings!.response!.security.cik).toBe("0000000001");
    const document = formatCompanyReportDocument(current)!;
    expect(document).not.toBeNull();
    const archive = (await parseCompanyReportArchive(document.text, signal()))!;
    expect(archive).not.toBeNull();
    expect(archive.selectionCik).toBeNull();
    for (const key of ["annual", "filings"])
      expect(
        archive.sources.find((source) => source.source === key)!.fields,
      ).toContainEqual({ label: "Source CIK", value: "0000000001" });
    expect(projectCurrentCompanyReport(current)).toEqual({
      preparedAt: archive.preparedAt,
      listing: archive.listing,
      catalogSnapshotSha256: archive.catalogSnapshotSha256,
      selectionCik: null,
      note: archive.note,
      sources: archive.sources,
    });
    expect(companyReportArchiveMatches(archive, selected)).toBe(true);
    expect(companyReportArchiveMatches(archive, eodSelection)).toBe(false);
  });
  it("refuses conflicting independently valid Annual and Filings CIKs beneath a null selected CIK", async () => {
    const value = document();
    value.selectionCik = null;
    source(value, "filings").response = filingsResponse(2, "available", {
      ...eodSelection,
      cik: "0000000002",
    });
    expect(await parse(value)).toBeNull();
  });
  it("projects a decoder-owned current report without refreshing its dates", () => {
    const current = projectCurrentCompanyReport(report)!;
    expect(current.note).toBe(note);
    expect(current.preparedAt).toBe(report.preparedAt);
    expect(current.sources[0]!.fields).toContainEqual({
      label: "Completed",
      value: "2026-09-20T00:00:01.000Z",
    });
    expect(
      projectCurrentCompanyReport({
        ...report,
        evidence: {
          ...report.evidence,
          annual: {
            ...report.evidence.annual!,
            response: structuredClone(report.evidence.annual!.response),
          },
        },
      }),
    ).toBeNull();
  });
  it("preserves loaded/previous/failed/origin flags and absent versus empty note", async () => {
    const value = document();
    source(value, "price").retainedPrevious = true;
    source(value, "price").lastAttemptFailed = true;
    data(value.sources).filings = {
      status: "not_loaded",
      lastAttemptFailed: true,
    };
    value.authoredResearch = { status: "watchlist_draft", note: "" };
    const archive = (await parse(value))!;
    expect(archive.note).toBe("");
    expect(archive.sources[0]).toMatchObject({
      retainedPrevious: true,
      lastAttemptFailed: true,
      responseOrigin: "company",
    });
    expect(archive.sources[3]).toMatchObject({
      status: "not_loaded",
      lastAttemptFailed: true,
      fields: [],
      references: [],
    });
    value.authoredResearch = { status: "not_in_watchlist", note: null };
    expect((await parse(value))!.note).toBeNull();
  });
  it("never promotes arbitrary imported calculations to source evidence", async () => {
    const value = document();
    value.valuation = { unverified: "made-up valuation" };
    data(source(value, "annual").financials).income = {
      unverified: "made-up income",
    };
    const archive = (await parse(value))!;
    expect(archive.unverifiedAppendix).toContain("made-up income");
    expect(JSON.stringify(archive.sources)).not.toContain("made-up");
  });
  it("accepts the exact whole-file cap with an opaque appendix and refuses the next byte", async () => {
    const value = document();
    const annual = source(value, "annual");
    annual.statements = { ...data(annual.statements), fileReportedPadding: "" };
    const baseline = JSON.stringify(value);
    const padding =
      COMPANY_REPORT_ARCHIVE_MAX_BYTES - encoder.encode(baseline).byteLength;
    data(annual.statements).fileReportedPadding = "x".repeat(padding);
    const bounded = JSON.stringify(value);
    expect(encoder.encode(bounded).byteLength).toBe(
      COMPANY_REPORT_ARCHIVE_MAX_BYTES,
    );
    const accepted = (await parseCompanyReportArchive(bounded, signal()))!;
    expect(accepted).not.toBeNull();
    expect(accepted.unverifiedAppendix).toContain("fileReportedPadding");
    expect(JSON.stringify(accepted.sources)).not.toContain(
      "fileReportedPadding",
    );
    expect(await parseCompanyReportArchive(bounded + " ", signal())).toBeNull();
  });
  it("requires owned archive, all eleven company fields and exact nullable CIK, independently of current catalog", async () => {
    const archive = (await parseCompanyReportArchive(text, signal()))!;
    expect(companyReportArchiveMatches({ ...archive }, eodSelection)).toBe(
      false,
    );
    expect(
      companyReportArchiveMatches(archive, {
        ...eodSelection,
        catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
      }),
    ).toBe(true);
    for (const key of Object.keys(eodSelection.listing)) {
      const listing = { ...eodSelection.listing, [key]: "changed" };
      expect(
        companyReportArchiveMatches(archive, { ...eodSelection, listing }),
      ).toBe(false);
    }
    expect(
      companyReportArchiveMatches(archive, { ...eodSelection, cik: null }),
    ).toBe(false);
    expect(
      companyReportArchiveMatches(archive, {
        ...eodSelection,
        cik: "0000000002",
      }),
    ).toBe(false);
  });
});

const mutations: readonly [string, (value: Record<string, unknown>) => void][] =
  [
    [
      "unsupported schema",
      (value) => {
        value.schemaVersion = "4.0.0";
      },
    ],
    [
      "wrong purpose",
      (value) => {
        value.purpose = "other";
      },
    ],
    [
      "unknown envelope",
      (value) => {
        value.unknown = true;
      },
    ],
    [
      "unknown scope",
      (value) => {
        data(value.scope).unknown = true;
      },
    ],
    [
      "invalid time",
      (value) => {
        value.preparedAt = "2026-02-30T00:00:00.000Z";
      },
    ],
    [
      "bad catalog",
      (value) => {
        value.catalogSnapshotSha256 = "sha256:bad";
      },
    ],
    [
      "bad CIK",
      (value) => {
        value.selectionCik = "0000000000";
      },
    ],
    [
      "unknown identity",
      (value) => {
        data(value.listing).extra = true;
      },
    ],
    [
      "inconsistent note status",
      (value) => {
        value.authoredResearch = { status: "not_in_watchlist", note: "" };
      },
    ],
    [
      "unknown source",
      (value) => {
        data(value.sources).other = {};
      },
    ],
    [
      "unknown wrapper",
      (value) => {
        source(value, "price").unknown = true;
      },
    ],
    [
      "nonboolean previous",
      (value) => {
        source(value, "price").retainedPrevious = "true";
      },
    ],
    [
      "unknown origin",
      (value) => {
        source(value, "annual").responseOrigin = "file";
      },
    ],
    [
      "malformed study wrapper",
      (value) => {
        source(value, "price").studies = { status: "available", unknown: true };
      },
    ],
    [
      "malformed annual appendix wrapper",
      (value) => {
        data(source(value, "annual").financials).extra = true;
      },
    ],
    [
      "price foreign identity",
      (value) => {
        data(data(source(value, "price").response).security).issuerName =
          "Other Company";
      },
    ],
    [
      "price bad chronology",
      (value) => {
        data(source(value, "price").response).completedAt =
          "2026-01-01T00:00:00.000Z";
      },
    ],
    [
      "annual foreign identity",
      (value) => {
        data(data(source(value, "annual").response).security).issuerName =
          "Other Company";
      },
    ],
    [
      "annual foreign CIK",
      (value) => {
        value.selectionCik = "0000000002";
      },
    ],
    [
      "annual generation hash",
      (value) => {
        data(
          data(data(source(value, "annual").response).evidence).generation,
        ).sha256 = `sha256:${"0".repeat(64)}`;
      },
    ],
    [
      "annual observation hash",
      (value) => {
        const observations = data(
          data(data(source(value, "annual").response).evidence).facts,
        ).observations as unknown[];
        data(observations[0]).id = `sec-fact:${"0".repeat(64)}`;
      },
    ],
    [
      "filings foreign identity",
      (value) => {
        data(data(source(value, "filings").response).security).securityId =
          "other-security";
      },
    ],
    [
      "oversize valuation",
      (value) => {
        value.valuation = { text: "x".repeat(131_072) };
      },
    ],
    [
      "primitive valuation",
      (value) => {
        value.valuation = 42;
      },
    ],
  ];
describe("archive refusal boundaries", () => {
  it.each(mutations)(
    "refuses %s without a partial archive",
    async (_label, mutate) => {
      const value = document();
      mutate(value);
      expect(await parse(value)).toBeNull();
    },
  );
  it.each([
    "{",
    "null",
    "[]",
    '{"purpose":"investment.company-research","purpose":"investment.company-research"}',
  ])("refuses malformed or duplicate envelope %s", async (value) => {
    expect(await parseCompanyReportArchive(value, signal())).toBeNull();
  });
  it("rejects decoded duplicate keys and malformed escaped Unicode anywhere, including opaque sections", async () => {
    expect(
      await parseCompanyReportArchive(
        text.replace('"purpose":', '"\\u0070urpose":"duplicate","purpose":'),
        signal(),
      ),
    ).toBeNull();
    expect(
      await parseCompanyReportArchive(
        text.replace('"valuation":null', '"valuation":{"x":1,"\\u0078":2}'),
        signal(),
      ),
    ).toBeNull();
    expect(
      await parseCompanyReportArchive(
        text.replace('"valuation":null', '"valuation":{"x":"\\ud800"}'),
        signal(),
      ),
    ).toBeNull();
    expect(
      await parseCompanyReportArchive(
        text.replace('"valuation":null', '"valuation":{"x":1e999}'),
        signal(),
      ),
    ).toBeNull();
  });
  it("rejects excessive nesting before JSON decoding", async () => {
    const value = text.replace(
      '"valuation":null',
      `"valuation":${"[".repeat(257)}0${"]".repeat(257)}`,
    );
    expect(await parseCompanyReportArchive(value, signal())).toBeNull();
  });
  it("checks the exact whole byte ceiling before decoding and permits only a bounded complete document", async () => {
    expect(COMPANY_REPORT_ARCHIVE_MAX_BYTES).toBe(
      COMPANY_REPORT_DOCUMENT_MAX_BYTES,
    );
    expect(() =>
      assertCompanyReportArchiveSize(COMPANY_REPORT_ARCHIVE_MAX_BYTES),
    ).not.toThrow();
    for (const size of [
      0,
      -1,
      1.5,
      Infinity,
      COMPANY_REPORT_ARCHIVE_MAX_BYTES + 1,
    ])
      expect(() => assertCompanyReportArchiveSize(size)).toThrow();
    expect(
      await parseCompanyReportArchive(
        " ".repeat(COMPANY_REPORT_ARCHIVE_MAX_BYTES + 1),
        signal(),
      ),
    ).toBeNull();
    const bytes = encoder.encode(text).buffer;
    expect(
      (await decodeCompanyReportArchive(bytes, bytes.byteLength, signal()))!
        .note,
    ).toBe(note);
    expect(
      await decodeCompanyReportArchive(bytes, bytes.byteLength - 1, signal()),
    ).toBeNull();
    expect(
      await decodeCompanyReportArchive(
        new Uint8Array([0xc0, 0xaf]).buffer,
        2,
        signal(),
      ),
    ).toBeNull();
  });
  it("propagates cancellation before read and during async canonical hashing", async () => {
    const canceled = new AbortController();
    canceled.abort();
    await expect(
      parseCompanyReportArchive(text, canceled.signal),
    ).rejects.toThrow();
    await expect(
      decodeCompanyReportArchive(
        encoder.encode(text).buffer,
        encoder.encode(text).byteLength,
        canceled.signal,
      ),
    ).rejects.toThrow();
    const pending = new AbortController();
    const result = parseCompanyReportArchive(text, pending.signal);
    pending.abort();
    await expect(result).rejects.toThrow();
  });
});
