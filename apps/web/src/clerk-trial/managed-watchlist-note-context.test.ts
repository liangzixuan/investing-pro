import { describe, expect, it } from "vitest";
import {
  getWatchlistNoteContext,
  normalizeWatchlistSearch,
} from "./managed-watchlist-note-context";

describe("watchlist note context", () => {
  it.each([
    ["Company draft captured in research", "Captured in research"],
    ["  First\r\n\t\u00a0\ufeffSECOND  ", " first second "],
    ["ΟΣ then ΟΣΑ", "ος"],
    ["ΟΣ then ΟΣΑ", "οσα"],
    ["İ following needle", "needle"],
    ["İ following needle", "\u0307"],
    ["Cafe\u0301 and 👩🏽‍💻 family 👨‍👩‍👧‍👦", "\u0301"],
    ["Cafe\u0301 and 👩🏽‍💻 family 👨‍👩‍👧‍👦", "💻"],
    ["<img src=x onerror=alert(1)> exact & raw", "<IMG"],
    ["\u0000Invalid\nraw note", "invalid raw"],
  ])("keeps the complete short raw note %j for %j", (note, query) => {
    expect(getWatchlistNoteContext(note, query)).toEqual({
      text: note,
      omittedBefore: false,
      omittedAfter: false,
    });
  });

  it.each([
    ["", "needle"],
    ["note", ""],
    ["note", " \r\n\t\u00a0\ufeff"],
    ["ΟΣ", "οσ"],
    ["İ", "i alone"],
    ["two separate phrases", "two phrases"],
  ])("omits context for no normalized match: %j / %j", (note, query) => {
    expect(getWatchlistNoteContext(note, query)).toBeNull();
  });

  it.each([
    ["needle" + "x".repeat(400), "needle" + "x".repeat(174), false, true],
    ["x".repeat(400) + "needle", "x".repeat(174) + "needle", true, false],
    [
      "x".repeat(400) + "needle" + "y".repeat(400),
      "x".repeat(87) + "needle" + "y".repeat(87),
      true,
      true,
    ],
  ])(
    "provides bounded beginning, end and middle context",
    (note, text, omittedBefore, omittedAfter) => {
      expect(getWatchlistNoteContext(note, "needle")).toEqual({
        text,
        omittedBefore,
        omittedAfter,
      });
    },
  );

  it("chooses the first occurrence without altering draft order or matching rules", () => {
    const note = `first needle${"x".repeat(400)}last needle`;
    expect(getWatchlistNoteContext(note, "needle")).toEqual({
      text: `first needle${"x".repeat(168)}`,
      omittedBefore: false,
      omittedAfter: true,
    });
  });

  it("maps whole-string sigma and expanded dotted I after a clipped prefix", () => {
    const note = `${"İ".repeat(300)}ΟΣ needle${"z".repeat(300)}`;
    expect(getWatchlistNoteContext(note, "ος needle")).toEqual({
      text: `${"İ".repeat(85)}ΟΣ needle${"z".repeat(86)}`,
      omittedBefore: true,
      omittedAfter: true,
    });
  });

  it("retains raw whitespace and honestly clips a match wider than the budget", () => {
    const note = `start${"\r\n\t\u00a0".repeat(100)}end`;
    const context = getWatchlistNoteContext(note, "start end")!;
    expect(context).toEqual({
      text: note.slice(0, 180),
      omittedBefore: false,
      omittedAfter: true,
    });
    expect(normalizeWatchlistSearch(note)).toBe("start end");
  });

  it("does not cap or change query admission when the query exceeds the excerpt budget", () => {
    const note = "a".repeat(220);
    expect(getWatchlistNoteContext(note, "A".repeat(200))).toEqual({
      text: "a".repeat(180),
      omittedBefore: false,
      omittedAfter: true,
    });
  });

  it.each(["e\u0301", "👩🏽‍💻", "👨‍👩‍👧‍👦", "🇯🇵", "\r\n"])(
    "keeps %j whole at both clipping boundaries",
    (grapheme) => {
      const note = `${grapheme.repeat(150)}needle${grapheme.repeat(150)}`;
      const context = getWatchlistNoteContext(note, "needle")!;
      const before = context.text.split("needle")[0]!;
      const after = context.text.split("needle")[1]!;
      expect(before).toBe(grapheme.repeat(before.length / grapheme.length));
      expect(after).toBe(grapheme.repeat(after.length / grapheme.length));
      expect(Array.from(context.text).length).toBeLessThanOrEqual(180);
      expect(note).toContain(context.text);
      expect(context.omittedBefore).toBe(true);
      expect(context.omittedAfter).toBe(true);
    },
  );

  it("omits an indivisible over-budget grapheme instead of splitting or expanding the bound", () => {
    expect(getWatchlistNoteContext(`a${"\u0301".repeat(200)}`, "a")).toEqual({
      text: "",
      omittedBefore: false,
      omittedAfter: true,
    });
  });

  it("preserves the original predicate for raw invalid notes and mixed Unicode", () => {
    const notes = [
      "ΟΣ",
      "ΟΣΑ",
      "İ",
      "a\u0301",
      "👩🏽‍💻",
      "\ufeff A\n\tB ",
      "x".repeat(4_000) + " end",
      "\u0000raw <note>",
    ];
    for (const note of notes)
      for (const query of [
        "ος",
        "οσ",
        "\u0307",
        "\u0301",
        "💻",
        "a b",
        "end",
        "<NOTE>",
      ])
        expect(getWatchlistNoteContext(note, query) !== null).toBe(
          note
            .toLowerCase()
            .trim()
            .replace(/\s+/gu, " ")
            .includes(query.toLowerCase().trim().replace(/\s+/gu, " ")),
        );
  });
});
