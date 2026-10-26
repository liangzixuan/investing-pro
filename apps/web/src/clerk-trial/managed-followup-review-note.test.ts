import { describe, expect, it } from "vitest";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import { eodSelection } from "./eod-history-fixture";
import { prepareFollowupReviewNote } from "./managed-followup-review-note";

const recordedAt = "2026-10-26T02:00:00.123Z";
const entry: ResearchFollowup = {
  id: "00000000-0000-4000-8000-000000000001",
  catalogSnapshotSha256: eodSelection.catalogSnapshotSha256,
  listing: eodSelection.listing,
  check: "Inspect capacity · Café 東京",
  dueOn: "2026-10-20",
  status: "open",
  completedOn: null,
  result: "My conclusion · 東京 😀",
};
const prepare = (
  change: Partial<Parameters<typeof prepareFollowupReviewNote>[0]> = {},
) => prepareFollowupReviewNote({ entry, note: "", recordedAt, ...change });

describe("complete authored Follow-up review note", () => {
  it("preserves raw note/assessment Unicode and whitespace and distinguishes every clock", () => {
    const note =
      "  Cafe\u0301 source completed 2026-09-20T00:00:01.000Z https://example.test/filing  ";
    const raw = { ...entry, result: "  Cafe\u0301 assessment 😀  " };
    const result = prepare({ entry: raw, note }).preview!;
    expect(result.note).toBe(
      `${note} Follow-up assessment for ZERO (Class A, XNAS). Question: Inspect capacity · Café 東京 | Due date (UTC): 2026-10-20 | State: open | My assessment:   Cafe\u0301 assessment 😀   | Authored assessment recorded at (UTC): 2026-10-26T02:00:00.123Z. Authored text; original source dates remain unchanged.`,
    );
    expect(result.recordedAt).toBe(recordedAt);
    expect(raw.result).toBe("  Cafe\u0301 assessment 😀  ");
    expect(entry.dueOn).toBe("2026-10-20");
  });
  it("keeps an existing completion date distinct from the authored capture", () => {
    const result = prepare({
      entry: { ...entry, status: "completed", completedOn: "2026-10-21" },
    }).preview!;
    expect(result.excerpt).toContain("Completed on (UTC): 2026-10-21");
    expect(result.excerpt).toContain(`recorded at (UTC): ${recordedAt}`);
  });
  it("refuses duplicate content after the clock advances, but permits changed authored content", () => {
    const note = prepare().preview!.note;
    expect(
      prepare({ note, recordedAt: "2026-10-27T04:00:00.000Z" }).reason,
    ).toContain("already");
    for (const changed of [
      { ...entry, result: "A changed assessment" },
      { ...entry, dueOn: "2026-10-22" },
      { ...entry, status: "completed" as const, completedOn: "2026-10-21" },
    ])
      expect(prepare({ note, entry: changed }).preview).not.toBeNull();
  });
  it("admits exactly 2000 raw code points and refuses overflow without clipping", () => {
    const excerpt = prepare().preview!.excerpt;
    const prefix = "😀".repeat(2_000 - [...excerpt].length - 1);
    expect([...prepare({ note: prefix }).preview!.note]).toHaveLength(2_000);
    expect(prepare({ note: prefix + "😀" }).reason).toContain(
      "Nothing was clipped",
    );
    expect(prepare({ note: " ".repeat(2_000) + "x" }).preview).toBeNull();
  });
  it.each([
    "",
    "   ",
    "x\n",
    "x\u0000",
    "x\u200d",
    "\ud800",
    "😀".repeat(2_001),
  ])(
    "refuses invalid or empty raw assessment without modifying it %#",
    (result) => {
      const raw = { ...entry, result };
      expect(prepare({ entry: raw }).preview).toBeNull();
      expect(raw.result).toBe(result);
    },
  );
  it.each(["2026-02-30", "0000-01-01", "2026-1-01"])(
    "refuses invalid due date %s",
    (dueOn) => {
      expect(prepare({ entry: { ...entry, dueOn } }).preview).toBeNull();
    },
  );
  it.each([
    "invalid",
    "2026-02-30T02:00:00.123Z",
    "2026-10-26T02:00:00Z",
    "0000-10-26T02:00:00.123Z",
  ])("refuses an invalid authored clock %s", (recordedAt) => {
    expect(prepare({ recordedAt }).preview).toBeNull();
  });
});

it("compares only duplicate identity text in NFC while preserving the raw proposal", () => {
  const raw = { ...entry, result: "  Cafe\u0301 assessment  " };
  const prepared = prepare({ entry: raw }).preview!;
  expect(prepared.note).toContain("Cafe\u0301 assessment");
  expect(
    prepare({
      entry: raw,
      note: prepared.note.normalize("NFC"),
      recordedAt: "2026-10-28T02:00:00.000Z",
    }).reason,
  ).toContain("already");
});
