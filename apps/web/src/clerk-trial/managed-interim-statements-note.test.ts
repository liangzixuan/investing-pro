import { describe, expect, it, vi } from "vitest";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";
import { parseSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
import { resolvePersonalSecInterimStatements } from "@research-cockpit/personal-financial-analytics";
import {
  prepareManagedInterimStatementsNote,
  appendManagedInterimStatementsNote,
  isManagedInterimStatementsNoteCurrent,
  retireManagedInterimStatementsNote,
} from "./managed-interim-statements-note";
import type { PersonalSecInterimStatementConcept } from "@research-cockpit/contracts";
async function setup() {
  const raw = await buildInterimFixture();
  const response = await parseSecInterimCanonicalResponse(
    raw,
    {
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: raw.catalogSnapshotSha256,
      listingId: raw.security.listingId,
      symbol: raw.security.symbol,
    },
    new AbortController().signal,
  );
  if (!response) throw new Error("Fixture admission failed");
  const rows = resolvePersonalSecInterimStatements(
    response.evidence,
  ).statements.flatMap((statement) => statement.rows);
  const choose = (
    concept: PersonalSecInterimStatementConcept,
    start: string | null,
  ) => {
    const cell = rows
      .find((row) => row.concept === concept)
      ?.cells.find((cell) => cell.period.startDate === start);
    if (!cell) throw new Error("Missing fixture cell");
    return { concept, periodKey: cell.period.key };
  };
  const selection = [
    choose("RevenueFromContractWithCustomerExcludingAssessedTax", "2026-04-01"),
    choose("NetCashProvidedByUsedInOperatingActivities", "2026-01-01"),
    choose("Assets", null),
  ];
  return { response, selection };
}
describe("owned interim statement note", () => {
  it("keeps the full independent three-cell Unicode note within the original bound", async () => {
    const { response, selection } = await setup();
    const apply = vi.fn();
    const proposal = prepareManagedInterimStatementsNote({
      response,
      selection,
      note: "Thèse café 📈",
      showingPrevious: false,
      isCurrent: () => true,
      apply,
    });
    expect(proposal.reason).toBeNull();
    expect(proposal.preview).not.toBeNull();
    const id = (
      concept: PersonalSecInterimStatementConcept,
      start: string | null,
    ) =>
      response.evidence.facts.observations.find(
        (row) => row.concept === concept && row.startDate === start,
      )!.id;
    const zero = `sha256:${"0".repeat(64)}`;
    const expected = `Thèse café 📈 Interim CompanyFacts-only: EX.C; Example Company; Example Company Class C; XNYS; listing listing:example:c; issuer issuer:example; CIK 0000000001; catalog ${zero}. 10-Q accession 0000000001-26-000002; report 2026-06-30; filed 2026-07-30; accepted 2026-07-30T14:00:00Z. RevenueFromContractWithCustomerExcludingAssessedTax: USD 40; Reported duration: 2026-04-01 to 2026-06-30 (91 days); Quarter/YTD classification not established; observations [${id("RevenueFromContractWithCustomerExcludingAssessedTax", "2026-04-01")}]; Keep this customer-contract basis separate from Revenues and legacy net sales. NetCashProvidedByUsedInOperatingActivities: USD 9; Reported duration: 2026-01-01 to 2026-06-30 (181 days); Quarter/YTD classification not established; observations [${id("NetCashProvidedByUsedInOperatingActivities", "2026-01-01")}]; Signed net operating cash movement. Not earnings, free cash flow or FCFF. Assets: USD 120; As of 2026-06-30; observations [${id("Assets", null)}]; Reported total assets. Do not reconstruct the total from this limited registry. CompanyFacts[available;https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json;retrieved 2026-08-01T12:00:02.000Z;${zero};200 bytes] Submissions[available;https://data.sec.gov/submissions/CIK0000000001.json;retrieved 2026-08-01T12:00:01.000Z;${zero};100 bytes] Load cutoff 2026-08-01T12:00:00.000Z; completed 2026-08-01T12:00:03.000Z; generation ${response.evidence.generation.sha256}. No source refresh or quarter/YTD inference.`;
    expect(proposal.preview!.note).toBe(expected);
    expect([...expected].length).toBeLessThanOrEqual(2000);
    expect(appendManagedInterimStatementsNote(proposal.preview!)).toEqual({
      appended: true,
      message:
        "Reported cells added to the note draft. Review and Save My Watchlist separately.",
    });
    expect(apply).toHaveBeenCalledExactlyOnceWith(expected);
    expect(appendManagedInterimStatementsNote(proposal.preview!).appended).toBe(
      false,
    );
  });
  it("refuses already-appended exact cells before considering a second whole-note overflow", async () => {
    const { response, selection } = await setup();
    let note = "Thèse café 📈";
    const apply = vi.fn((value: string) => {
      note = value;
    });
    const prepare = () =>
      prepareManagedInterimStatementsNote({
        response,
        selection,
        note,
        showingPrevious: false,
        isCurrent: () => true,
        apply,
      });
    const first = prepare();
    expect(first.reason).toBeNull();
    expect(first.preview).not.toBeNull();
    expect(appendManagedInterimStatementsNote(first.preview!).appended).toBe(
      true,
    );
    const appended = note;
    expect([...appended].length).toBeLessThanOrEqual(2000);
    expect([...`${appended} ${first.preview!.excerpt}`].length).toBeGreaterThan(
      2000,
    );
    expect(prepare()).toEqual({
      preview: null,
      reason:
        "These exact reported cells are already at the end of the note draft.",
    });
    expect(note).toBe(appended);
    expect(apply).toHaveBeenCalledExactlyOnceWith(appended);
    expect(appendManagedInterimStatementsNote(first.preview!).appended).toBe(
      false,
    );
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it("consumes before caller reentry and permanently retires an observed stale capture", async () => {
    const { response, selection } = await setup();
    let live = true;
    const first = prepareManagedInterimStatementsNote({
      response,
      selection: selection.slice(0, 1),
      note: "",
      showingPrevious: false,
      isCurrent: () => live,
      apply: vi.fn(),
    }).preview!;
    live = false;
    expect(isManagedInterimStatementsNoteCurrent(first)).toBe(false);
    live = true;
    expect(appendManagedInterimStatementsNote(first).appended).toBe(false);
    let again: unknown;
    const next = prepareManagedInterimStatementsNote({
      response,
      selection: selection.slice(0, 1),
      note: "",
      showingPrevious: false,
      isCurrent: () => true,
      apply: () => {
        again = appendManagedInterimStatementsNote(next);
      },
    }).preview!;
    expect(appendManagedInterimStatementsNote(next).appended).toBe(true);
    expect(again).toMatchObject({ appended: false });
  });
});

describe("interim note refusal boundaries", () => {
  it.each([
    "empty",
    "duplicate",
    "sparse",
    "unknown",
    "extra",
    "accessor",
    "unavailable",
  ])(
    "refuses %s selected cells without evaluating accessors or changing a note",
    async (kind) => {
      const f = await setup(),
        apply = vi.fn(),
        accessor = vi.fn(),
        selected: unknown[] = f.selection.slice(0, 1);
      if (kind === "empty") selected.length = 0;
      if (kind === "duplicate") selected.push(selected[0]);
      if (kind === "sparse") selected.length = 2;
      if (kind === "unknown")
        selected[0] = { concept: "Assets", periodKey: "wrong" };
      if (kind === "extra") selected[0] = { ...f.selection[0], value: "999" };
      if (kind === "accessor")
        selected[0] = Object.defineProperty(
          { ...f.selection[0] },
          "periodKey",
          { get: accessor, enumerable: true },
        );
      if (kind === "unavailable")
        selected[0] = {
          concept: "Revenues",
          periodKey: f.selection[0]!.periodKey,
        };
      const proposal = prepareManagedInterimStatementsNote({
        response: f.response,
        selection: selected as typeof f.selection,
        note: "Original",
        showingPrevious: false,
        isCurrent: () => true,
        apply,
      });
      expect(proposal.preview).toBeNull();
      expect(apply).not.toHaveBeenCalled();
      expect(accessor).not.toHaveBeenCalled();
    },
  );
  it.each(["x".repeat(2001), "line\nbreak", "bad\u200b", "bad\ud800"])(
    "refuses an invalid original note intact",
    async (note) => {
      const f = await setup(),
        apply = vi.fn();
      expect(
        prepareManagedInterimStatementsNote({
          response: f.response,
          selection: f.selection,
          note,
          showingPrevious: false,
          isCurrent: () => true,
          apply,
        }).preview,
      ).toBeNull();
      expect(apply).not.toHaveBeenCalled();
    },
  );
  it("refuses a complete overflow without clipping the raw note or selected cells", async () => {
    const f = await setup(),
      note = "📈".repeat(1800);
    const result = prepareManagedInterimStatementsNote({
      response: f.response,
      selection: f.selection,
      note,
      showingPrevious: false,
      isCurrent: () => true,
      apply: vi.fn(),
    });
    expect(result.preview).toBeNull();
    expect(result.reason).toContain("2,000-code-point");
    expect([...note]).toHaveLength(1800);
    expect(f.selection).toHaveLength(3);
  });
  it("requires decoder ownership even for byte-equal structural data", async () => {
    const f = await setup();
    expect(
      prepareManagedInterimStatementsNote({
        response: structuredClone(f.response),
        selection: f.selection,
        note: "",
        showingPrevious: false,
        isCurrent: () => true,
        apply: vi.fn(),
      }).preview,
    ).toBeNull();
  });
  it("retires reentrant currentness evaluation permanently", async () => {
    const f = await setup();
    let recurse = false;
    const preview = prepareManagedInterimStatementsNote({
      response: f.response,
      selection: f.selection.slice(0, 1),
      note: "",
      showingPrevious: false,
      isCurrent: () => {
        if (recurse) {
          recurse = false;
          isManagedInterimStatementsNoteCurrent(preview);
        }
        return true;
      },
      apply: vi.fn(),
    }).preview!;
    recurse = true;
    expect(isManagedInterimStatementsNoteCurrent(preview)).toBe(false);
    expect(appendManagedInterimStatementsNote(preview).appended).toBe(false);
  });
  it("records retained-previous status in the complete citation and cancellation is final", async () => {
    const f = await setup();
    const proposal = prepareManagedInterimStatementsNote({
      response: f.response,
      selection: f.selection.slice(0, 1),
      note: "",
      showingPrevious: true,
      isCurrent: () => true,
      apply: vi.fn(),
    });
    expect(proposal.preview!.note).toContain(
      "Retained previous report; a newer report was not confirmed.",
    );
    retireManagedInterimStatementsNote(proposal.preview!);
    expect(appendManagedInterimStatementsNote(proposal.preview!).appended).toBe(
      false,
    );
  });
});
