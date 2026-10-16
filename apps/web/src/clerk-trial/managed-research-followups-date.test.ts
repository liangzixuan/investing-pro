import { expect, it } from "vitest";
import type { ResearchFollowup } from "@research-cockpit/contracts";
import { groupResearchFollowupsByDueDate } from "./managed-research-followups-date";

function entry(
  index: number,
  dueOn: string,
  completedOn: string | null = null,
): ResearchFollowup {
  return Object.freeze({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    listing: Object.freeze({
      country: "US",
      exchangeMic: "XNAS",
      instrumentType: "common_stock",
      issuerId: `issuer-${index}`,
      issuerName: `Invented company ${index}`,
      listingId: `listing-${index}`,
      securityId: `security-${index}`,
      securityName: `Invented common stock ${index}`,
      shareClassId: `class-${index}`,
      shareClassName: "Common stock",
      symbol: `Q${index}`,
    }),
    check: "Read the next filing and record my assessment.",
    dueOn,
    ...(completedOn === null
      ? ({ status: "open", completedOn: null } as const)
      : ({ status: "completed", completedOn } as const)),
    result: completedOn === null ? "" : "Café 東京 📈 authored result",
  });
}

it("groups admitted planning dates without changing saved order or authored entries", () => {
  const later = entry(1, "2026-10-17");
  const overdue = entry(2, "2026-10-14");
  const completed = entry(3, "2026-10-15", "2026-10-15");
  const today = entry(4, "2026-10-15");
  const earlier = entry(5, "2026-10-13");
  const entries = Object.freeze([later, overdue, completed, today, earlier]);
  const groups = groupResearchFollowupsByDueDate(
    entries,
    new Date("2026-10-15T12:34:56.000Z"),
  );
  expect(groups).toEqual({
    assessedOn: "2026-10-15",
    overdue: [overdue, earlier],
    today: [today],
    later: [later],
    completed: [completed],
    invalidDates: [],
  });
  expect(groups?.completed[0]).toBe(completed);
  expect(groups?.completed[0]?.result).toBe("Café 東京 📈 authored result");
  expect(entries).toEqual([later, overdue, completed, today, earlier]);
  expect(Object.isFrozen(groups)).toBe(true);
  for (const group of ["overdue", "today", "later", "completed"] as const)
    expect(Object.isFrozen(groups?.[group])).toBe(true);
});

it("uses UTC midnight rather than the input offset or local calendar day", () => {
  const fifteenth = entry(1, "2026-10-15");
  const sixteenth = entry(2, "2026-10-16");
  const entries = Object.freeze([fifteenth, sixteenth]);
  const before = groupResearchFollowupsByDueDate(
    entries,
    new Date("2026-10-15T18:59:59.999-05:00"),
  );
  const after = groupResearchFollowupsByDueDate(
    entries,
    new Date("2026-10-15T19:00:00.000-05:00"),
  );
  expect(before).toMatchObject({
    assessedOn: "2026-10-15",
    overdue: [],
    today: [fifteenth],
    later: [sixteenth],
  });
  expect(after).toMatchObject({
    assessedOn: "2026-10-16",
    overdue: [fifteenth],
    today: [sixteenth],
    later: [],
  });
  expect(before?.assessedOn).toBe("2026-10-15");
});

it.each([
  ["0001-01-01T00:00:00.000Z", "0001-01-01"],
  ["2000-02-29T23:59:59.999Z", "2000-02-29"],
  ["2026-03-08T01:59:59.000-06:00", "2026-03-08"],
  ["9999-12-31T23:59:59.999Z", "9999-12-31"],
  ["0000-01-01T00:00:00.000Z", null],
  ["+010000-01-01T00:00:00.000Z", null],
  ["invalid", null],
] as const)("bounds the captured assessment clock %s", (clock, expected) => {
  const result = groupResearchFollowupsByDueDate([], new Date(clock));
  if (expected === null) expect(result).toBeNull();
  else expect(result?.assessedOn).toBe(expected);
});

it("keeps invalid raw dates outside every due group without changing authored text", () => {
  const invalid = [
    entry(1, "2026-02-29"),
    entry(2, "0000-01-01"),
    entry(3, "bad \ud800"),
    entry(4, "2026-2-01"),
  ];
  const valid = entry(5, "2000-02-29");
  const groups = groupResearchFollowupsByDueDate(
    [...invalid, valid],
    new Date("2026-10-15T00:00:00Z"),
  );
  expect(groups?.invalidDates).toEqual(invalid);
  expect(groups?.overdue).toEqual([valid]);
  expect(groups?.invalidDates[2]).toBe(invalid[2]);
  expect(Object.isFrozen(groups?.invalidDates)).toBe(true);
});
