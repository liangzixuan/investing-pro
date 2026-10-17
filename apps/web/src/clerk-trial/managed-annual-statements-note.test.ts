import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  PERSONAL_SEC_ANNUAL_STATEMENT_REGISTRY as registry,
  serializePersonalSecAnnualStatementObservation,
  type PersonalSecAnnualCanonicalResponseDto,
  type PersonalSecAnnualStatementConcept,
  type PersonalSecAnnualStatementObservationDto,
} from "@research-cockpit/contracts";
import {
  canonicalAnnualPacket,
  canonicalAnnualRequest,
  canonicalFixtureHash,
  withCanonicalAnnualGeneration,
} from "../features/research/sec-annual-canonical-fixture";
import { parseSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";
import {
  appendManagedAnnualStatementsNote as append,
  isManagedAnnualStatementsNoteCurrent as current,
  prepareManagedAnnualStatementsNote as prepare,
  type ManagedAnnualStatementsNoteCapture,
  type PreparedManagedAnnualStatementsNote,
} from "./managed-annual-statements-note";

type Packet = PersonalSecAnnualCanonicalResponseDto;
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
let admitted: Packet;
beforeAll(async () => {
  admitted = await admit(await canonicalAnnualPacket());
});
async function admit(packet: Packet): Promise<Packet> {
  const result = await parseSecAnnualCanonicalResponse(
    packet,
    canonicalAnnualRequest,
    new AbortController().signal,
  );
  if (!result) throw new Error("Invented canonical packet was not admitted.");
  return result;
}
function options(
  concept: PersonalSecAnnualStatementConcept = "StockholdersEquity",
  response = admitted,
) {
  const apply = vi.fn();
  const capture: ManagedAnnualStatementsNoteCapture = {
    response,
    selection: [{ concept, endDate: "2025-12-31" }],
    note: "  Cafe\u0301 😀 thesis  ",
    showingPrevious: false,
    isCurrent: () => true,
    apply,
  };
  return { capture, apply };
}
async function withRows(
  concept: PersonalSecAnnualStatementConcept,
  changes: readonly Partial<PersonalSecAnnualStatementObservationDto>[],
): Promise<Packet> {
  const packet = structuredClone(admitted) as Mutable<Packet>;
  const base = packet.evidence.facts.observations.find(
    (row) => row.concept === concept,
  )!;
  const rows: PersonalSecAnnualStatementObservationDto[] = [];
  for (const [index, change] of changes.entries()) {
    const fields = {
      ...base,
      frame: `fixture-${index}`,
      sourceLocator: `/facts/us-gaap/${concept}/units/USD/${index}`,
      ...change,
    };
    rows.push({
      ...fields,
      id: `sec-fact:${await canonicalFixtureHash(serializePersonalSecAnnualStatementObservation(fields))}`,
    });
  }
  packet.evidence.facts.observations = [
    ...packet.evidence.facts.observations.filter(
      (row) => row.concept !== concept,
    ),
    ...rows,
  ].sort(
    (a, b) =>
      registry.findIndex((e) => e.concept === a.concept) -
        registry.findIndex((e) => e.concept === b.concept) ||
      compare(b.endDate, a.endDate) ||
      compare(b.startDate ?? "", a.startDate ?? "") ||
      compare(b.filedDate, a.filedDate) ||
      compare(a.id, b.id),
  );
  const scan = packet.evidence.facts.scans.find(
    (item) => item.concept === concept,
  )!.scan;
  if (scan.status !== "available") throw Error();
  const count = rows.length;
  scan.absence = count === 0 ? "concept_missing" : null;
  scan.coverage = {
    full: {
      candidateRows: count,
      inspectedRows: count,
      invalidRows: 0,
      duplicateRows: 0,
      uniqueObservations: count,
    },
    selected: count,
    otherAccessions: 0,
    returned: count,
    omittedSelected: 0,
  };
  return admit(await withCanonicalAnnualGeneration(packet));
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

describe("selected annual statement note preparation", () => {
  it.each([
    "StockholdersEquity",
    "NetIncomeLoss",
    "NetCashProvidedByUsedInInvestingActivities",
  ] as const)(
    "preserves exact signed unsafe %s values with narrow registry meaning and original evidence",
    (concept) => {
      const { capture, apply } = options(concept);
      const result = prepare(capture);
      expect(result.reason).toBeNull();
      const preview = result.preview!;
      const entry = registry.find((e) => e.concept === concept)!;
      const row = admitted.evidence.facts.observations.find(
        (row) => row.concept === concept,
      )!;
      expect(preview.excerpt).toContain(
        "USD -9007199254740993.000000000000000001",
      );
      expect(preview.excerpt).toContain(entry.label);
      expect(preview.excerpt).toContain(entry.qualification);
      expect(preview.excerpt).toContain(concept);
      expect(preview.excerpt).toContain(
        entry.periodType === "instant"
          ? "as of 2025-12-31"
          : "period 2025-01-01 to 2025-12-31",
      );
      expect(preview.excerpt).toContain(row.id);
      expect(preview.excerpt).toContain(admitted.catalogSnapshotSha256);
      expect(preview.excerpt).toContain(admitted.security.listingId);
      expect(preview.excerpt).toContain(admitted.security.issuerId);
      expect(preview.excerpt).toContain(admitted.evidence.generation.sha256);
      expect(preview.excerpt).toContain("canonical 6.0.0, registry 1.0.0");
      for (const source of Object.values(
        admitted.evidence.generation.sources,
      )) {
        expect(preview.excerpt).toContain(source.sourceUrl);
        expect(preview.excerpt).toContain(source.fetchedAt!);
        expect(preview.excerpt).toContain(source.sha256!);
        expect(preview.excerpt).toContain(`bytes ${source.bytes}`);
      }
      const target = admitted.evidence.target;
      if (target.status !== "target") throw Error();
      expect(preview.excerpt).toContain(target.accessionNumber);
      expect(preview.excerpt).toContain(target.filedDate);
      expect(preview.excerpt).toContain(target.acceptedAt!);
      expect(preview.excerpt).toContain(row.filing.sourceUrl!);
      expect(preview.excerpt).toContain(admitted.evidence.generation.cutoffAt);
      expect(preview.excerpt).toContain(
        admitted.evidence.generation.completedAt,
      );
      expect(preview.excerpt).toContain(
        "Evidence dates are unchanged; this action does not refresh sources.",
      );
      expect(preview.note).toBe(`${capture.note} ${preview.excerpt}`);
      expect(apply).not.toHaveBeenCalled();
      expect(current(preview)).toBe(true);
      expect(preview.selection[0]).toMatchObject({
        concept,
        value: row.value,
        startDate: row.startDate,
        endDate: row.endDate,
        lineId: entry.lineId,
        periodType: entry.periodType,
      });
      expect(Object.isFrozen(preview)).toBe(true);
      expect(Object.isFrozen(preview.selection)).toBe(true);
      expect(Object.isFrozen(preview.selection[0])).toBe(true);
      expect(Object.isFrozen(preview.selection[0]!.observationIds)).toBe(true);
    },
  );
  it("keeps selected comparative dates, starts and historical qualification", async () => {
    const response = await withRows("NetIncomeLoss", [
      {},
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        durationDays: 366,
        filingFocusYear: 2024,
        value: "-7.125",
      },
    ]);
    const { capture } = options("NetIncomeLoss", response);
    const result = prepare({
      ...capture,
      selection: [{ concept: "NetIncomeLoss", endDate: "2024-12-31" }],
      showingPrevious: true,
    });
    expect(result.preview!.excerpt).toContain(
      "USD -7.125; period 2024-01-01 to 2024-12-31",
    );
    expect(result.preview!.excerpt).toContain(
      "historical; current use ineligible at original load",
    );
    expect(result.preview!.excerpt).toContain(
      "Retained previous report; a newer report was not confirmed.",
    );
    expect(result.preview!.selection[0]!.currentUseEligible).toBe(false);
  });
  it.each([
    "OperatingExpenses",
    "FiniteLivedIntangibleAssetsNet",
    "ShareBasedCompensation",
    "SalesRevenueNet",
  ] as const)("uses the exact narrow %s label and qualification", (concept) => {
    const { capture } = options(concept);
    const preview = prepare({ ...capture, note: "" }).preview!;
    const entry = registry.find((e) => e.concept === concept)!;
    expect(preview.excerpt).toContain(entry.label);
    expect(preview.excerpt).toContain(entry.qualification);
  });
  it("can select independent cells from separate statements without requiring net income", async () => {
    const response = await withRows("NetIncomeLoss", []);
    const { capture } = options("Assets", response);
    const result = prepare({
      ...capture,
      note: "",
      selection: [
        { concept: "Assets", endDate: "2025-12-31" },
        {
          concept: "NetCashProvidedByUsedInOperatingActivities",
          endDate: "2025-12-31",
        },
      ],
    });
    expect(result.reason).toBeNull();
    expect(result.preview!.selection.map((c) => c.statement)).toEqual([
      "balance_sheet",
      "cash_flow",
    ]);
    expect(result.preview!.excerpt).toContain(
      "NetCashProvidedByUsedInOperatingActivities",
    );
  });
  it("preserves reported zero without constructing a zero for a missing cell", async () => {
    const response = await withRows("Revenues", [{ value: "0" }]);
    const { capture } = options("Revenues", response);
    expect(prepare(capture).preview!.excerpt).toContain("USD 0;");
  });
  it("refuses an unavailable or ambiguous cell rather than copying caller text", async () => {
    const { capture, apply } = options(
      "NetIncomeLoss",
      await withRows("NetIncomeLoss", []),
    );
    expect(prepare(capture).preview).toBeNull();
    expect(apply).not.toHaveBeenCalled();
    const ambiguous = await withRows("NetIncomeLoss", [
      { value: "1" },
      { value: "2" },
    ]);
    expect(prepare({ ...capture, response: ambiguous }).preview).toBeNull();
  });
  it.each(
    [
      [],
      [{ concept: "Unknown", endDate: "2025-12-31" }],
      [{ concept: "StockholdersEquity", endDate: "2024-12-31" }],
      [
        { concept: "StockholdersEquity", endDate: "2025-12-31" },
        { concept: "StockholdersEquity", endDate: "2025-12-31" },
      ],
      [{ concept: "StockholdersEquity", endDate: "2025-12-31", value: "100" }],
      null,
      "StockholdersEquity",
    ].map((selection) => ({ selection })),
  )("refuses invalid selection $selection", ({ selection }) => {
    const { capture, apply } = options();
    expect(
      prepare({
        ...capture,
        selection: selection as ManagedAnnualStatementsNoteCapture["selection"],
      }).preview,
    ).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
  it("rejects selection accessors without invoking them", () => {
    const { capture } = options();
    let calls = 0;
    const item = { endDate: "2025-12-31" };
    Object.defineProperty(item, "concept", {
      enumerable: true,
      get() {
        calls++;
        return "StockholdersEquity";
      },
    });
    expect(
      prepare({
        ...capture,
        selection: [
          item,
        ] as unknown as ManagedAnnualStatementsNoteCapture["selection"],
      }).preview,
    ).toBeNull();
    expect(calls).toBe(0);
    const array = [{ concept: "StockholdersEquity", endDate: "2025-12-31" }];
    Object.defineProperty(array, "0", {
      enumerable: true,
      get() {
        calls++;
        return item;
      },
    });
    expect(
      prepare({
        ...capture,
        selection: array as ManagedAnnualStatementsNoteCapture["selection"],
      }).preview,
    ).toBeNull();
    expect(calls).toBe(0);
  });
  it("previews exactly 2000 raw code points without clipping or rewriting", () => {
    const { capture } = options();
    const excerpt = prepare({ ...capture, note: "" }).preview!.excerpt;
    const prefix = `Cafe\u0301 ${"😀".repeat(2000 - [...excerpt].length - 7)}`;
    const exact = prepare({ ...capture, note: prefix });
    expect(exact.reason).toBeNull();
    expect([...exact.preview!.note]).toHaveLength(2000);
    expect(exact.preview!.note).toBe(`${prefix} ${excerpt}`);
    expect(prepare({ ...capture, note: `${prefix}😀` }).preview).toBeNull();
    expect(prepare({ ...capture, note: "x".repeat(2000) }).preview).toBeNull();
  });
  it.each([
    "draft\n",
    "\r",
    "\t",
    "draft\u0000next",
    "draft\u200bnext",
    "draft\ud800",
  ])("refuses forbidden raw whole-note content %j", (note) => {
    const { capture, apply } = options();
    expect(prepare({ ...capture, note }).preview).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
  it("refuses the complete oversized excerpt without dropping selected IDs", async () => {
    const response = await withRows(
      "StockholdersEquity",
      Array.from({ length: 100 }, () => ({ value: "-1" })),
    );
    const { capture, apply } = options("StockholdersEquity", response);
    const result = prepare({ ...capture, note: "" });
    expect(result.preview).toBeNull();
    expect(result.reason).toContain("2,000-character limit");
    expect(apply).not.toHaveBeenCalled();
    expect(
      response.evidence.facts.observations.filter(
        (row) => row.concept === "StockholdersEquity",
      ),
    ).toHaveLength(100);
  });
  it("refuses an already appended complete excerpt", () => {
    const { capture } = options();
    const preview = prepare(capture).preview!;
    const duplicate = prepare({ ...capture, note: preview.note });
    expect(duplicate.preview).toBeNull();
    expect(duplicate.reason).toContain("already at the end");
  });
});

describe("annual statement note append capability", () => {
  it("applies the exact whole draft once and rejects cloned or forged handles", () => {
    const { capture, apply } = options();
    const preview = prepare(capture).preview!;
    expect(append({ ...preview }).appended).toBe(false);
    expect(append(structuredClone(preview)).appended).toBe(false);
    expect(
      append({ note: "forged" } as PreparedManagedAnnualStatementsNote)
        .appended,
    ).toBe(false);
    expect(current(preview)).toBe(true);
    expect(append(preview).appended).toBe(true);
    expect(apply).toHaveBeenCalledExactlyOnceWith(preview.note);
    expect(current(preview)).toBe(false);
    expect(append(preview).appended).toBe(false);
  });
  it("consumes before reentrant or throwing apply", () => {
    const { capture } = options();
    const apply = vi.fn(() => {
      expect(append(preview).appended).toBe(false);
      throw Error("apply failed");
    });
    const preview: PreparedManagedAnnualStatementsNote = prepare({
      ...capture,
      apply,
    }).preview!;
    expect(append(preview).appended).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(append(preview).appended).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it("captures callbacks and an owned selection before later caller mutations", () => {
    const { capture, apply } = options();
    const mutable = {
      ...capture,
      selection: [
        { concept: "StockholdersEquity" as const, endDate: "2025-12-31" },
      ],
    };
    const preview = prepare(mutable).preview!;
    mutable.selection[0]!.endDate = "2024-12-31";
    mutable.selection.push({
      concept: "StockholdersEquity",
      endDate: "2023-12-31",
    });
    const otherApply = vi.fn();
    mutable.apply = otherApply;
    mutable.isCurrent = () => false;
    mutable.note = "retargeted";
    mutable.showingPrevious = true;
    expect(preview.selection).toHaveLength(1);
    expect(preview.selection[0]!.endDate).toBe("2025-12-31");
    expect(preview.note).not.toContain("retargeted");
    expect(preview.showingPrevious).toBe(false);
    expect(append(preview).appended).toBe(true);
    expect(apply).toHaveBeenCalledExactlyOnceWith(preview.note);
    expect(otherApply).not.toHaveBeenCalled();
  });
  it("refuses note edit then restore using the caller's captured opaque revision", () => {
    const { capture, apply } = options();
    let revision = Symbol("note");
    const captured = revision;
    const preview = prepare({
      ...capture,
      isCurrent: () => revision === captured,
    }).preview!;
    revision = Symbol("edited");
    revision = Symbol("restored text");
    expect(append(preview).appended).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
  it.each([
    "company",
    "catalog",
    "generation",
    "visit",
    "session",
    "selection",
    "retained-response status",
  ] as const)(
    "permanently retires when the %s guard becomes stale",
    (event) => {
      const { capture, apply } = options();
      const captured = Symbol("captured lifetime");
      const state = { [event]: captured };
      const preview = prepare({
        ...capture,
        isCurrent: () => state[event] === captured,
      }).preview!;
      state[event] = Symbol("retired lifetime");
      expect(current(preview)).toBe(false);
      state[event] = captured;
      expect(current(preview)).toBe(false);
      expect(append(preview).appended).toBe(false);
      expect(apply).not.toHaveBeenCalled();
    },
  );
  it("checks currentness before preparation and again after recomputation", () => {
    const { capture, apply } = options();
    expect(prepare({ ...capture, isCurrent: () => false }).preview).toBeNull();
    expect(
      prepare({
        ...capture,
        isCurrent: () => {
          throw Error("retired");
        },
      }).preview,
    ).toBeNull();
    let calls = 0;
    expect(
      prepare({ ...capture, isCurrent: () => ++calls === 1 }).preview,
    ).toBeNull();
    expect(calls).toBe(2);
    expect(apply).not.toHaveBeenCalled();
  });
  it("stays retired after a guard throws once", () => {
    const { capture, apply } = options();
    let throwing = false;
    const preview = prepare({
      ...capture,
      isCurrent: () => {
        if (throwing) throw Error("retired");
        return true;
      },
    }).preview!;
    throwing = true;
    expect(current(preview)).toBe(false);
    throwing = false;
    expect(append(preview).appended).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });
  it.each(["value", "generation", "catalog", "listing"] as const)(
    "detects caller mutation of captured %s independently of an incorrect true guard",
    (field) => {
      const response = structuredClone(admitted) as Mutable<Packet>;
      const { capture, apply } = options("StockholdersEquity", response);
      const preview = prepare(capture).preview!;
      const before = structuredClone(response);
      if (field === "value")
        response.evidence.facts.observations[0]!.value = "42";
      if (field === "generation")
        response.evidence.generation.sha256 = `sha256:${"b".repeat(64)}`;
      if (field === "catalog")
        response.catalogSnapshotSha256 = `sha256:${"b".repeat(64)}`;
      if (field === "listing") response.security.listingId = "listing-other";
      expect(current(preview)).toBe(false);
      Object.assign(response, before);
      expect(append(preview).appended).toBe(false);
      expect(apply).not.toHaveBeenCalled();
    },
  );
  it("refuses a malformed canonical packet without converting supplied values into note text", () => {
    const { capture, apply } = options();
    const response = structuredClone(admitted) as Mutable<Packet>;
    Object.assign(response, { schemaVersion: "5.0.0" });
    expect(prepare({ ...capture, response }).preview).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});
