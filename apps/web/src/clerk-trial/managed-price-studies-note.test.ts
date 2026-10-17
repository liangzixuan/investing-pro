import { describe, expect, it, vi } from "vitest";
import { eodResponse } from "./eod-history-fixture";
import {
  ManagedPriceStudiesNote,
  type PriceStudiesNoteCapture,
} from "./managed-price-studies-note";

function capture(
  overrides: Partial<PriceStudiesNoteCapture> = {},
): PriceStudiesNoteCapture {
  return {
    response: eodResponse(),
    note: "Existing authored note.",
    keys: ["windowChange"],
    showingPrevious: false,
    isCurrent: () => true,
    apply: vi.fn(),
    ...overrides,
  };
}
describe("workspace-owned raw close study notes", () => {
  it("previews the exact whole note and source-qualified value, then applies once without saving", () => {
    const review = new ManagedPriceStudiesNote();
    const note = "Authored  spacing e\u0301";
    const input = capture({ note, showingPrevious: true });
    const preview = review.prepare(input).preview!;
    expect(preview.note.startsWith(`${note} `)).toBe(true);
    expect(preview.excerpt).toContain("1.2469%");
    expect(preview.excerpt).toContain(
      "2 observed closes; 2026-09-18 through 2026-09-19",
    );
    expect(preview.excerpt).toContain("2026-09-20T00:00:01.000Z");
    expect(preview.excerpt).toContain("unadjusted for splits/dividends");
    expect(preview.excerpt).toContain("Retained previous history");
    expect(input.apply).not.toHaveBeenCalled();
    expect(review.append(preview).appended).toBe(true);
    expect(input.apply).toHaveBeenCalledExactlyOnceWith(preview.note);
    expect(review.append(preview).appended).toBe(false);
  });
  it("refuses the complete oversized note, unavailable selections and duplicate/unknown keys", () => {
    const review = new ManagedPriceStudiesNote();
    const input = capture({ note: "x".repeat(2000) });
    expect(review.prepare(input)).toMatchObject({ preview: null });
    expect(input.apply).not.toHaveBeenCalled();
    for (const keys of [
      [],
      ["sma200"],
      ["windowChange", "windowChange"],
      ["unknown"],
    ])
      expect(
        review.prepare(capture({ keys: keys as never })).preview,
      ).toBeNull();
  });
  it("copies keys before callbacks and rejects accessor or hidden choices without reading them", () => {
    const review = new ManagedPriceStudiesNote();
    const keys: PriceStudiesNoteCapture["keys"][number][] = ["windowChange"];
    const preview = review.prepare(
      capture({
        keys,
        isCurrent: () => {
          keys[0] = "sma200";
          return true;
        },
      }),
    ).preview!;
    expect(preview.keys).toEqual(["windowChange"]);
    const read = vi.fn(() => "windowChange");
    const accessor: PriceStudiesNoteCapture["keys"][number][] = [];
    Object.defineProperty(accessor, "0", { enumerable: true, get: read });
    expect(review.prepare(capture({ keys: accessor })).preview).toBeNull();
    expect(read).not.toHaveBeenCalled();
    const hidden = ["windowChange"];
    Object.defineProperty(hidden, "extra", { value: "drawdown" });
    expect(
      review.prepare(capture({ keys: hidden as never })).preview,
    ).toBeNull();
  });
  it("rejects foreign and forged handles, stale captures and edit-then-restore", () => {
    const review = new ManagedPriceStudiesNote();
    let current = true;
    const input = capture({ isCurrent: () => current });
    const preview = review.prepare(input).preview!;
    expect(new ManagedPriceStudiesNote().append(preview).appended).toBe(false);
    expect(review.append({ ...preview }).appended).toBe(false);
    current = false;
    expect(review.isCurrent(preview)).toBe(false);
    current = true;
    expect(review.append(preview).appended).toBe(false);
    expect(input.apply).not.toHaveBeenCalled();
  });
  it("latches a changed packet and consumes a failing apply without retry", () => {
    const review = new ManagedPriceStudiesNote();
    const source = eodResponse();
    const response = {
      ...source,
      rows: source.rows.map((row) => ({ ...row })),
    };
    const input = capture({ response });
    const preview = review.prepare(input).preview!;
    response.rows[0] = { ...response.rows[0]!, close: "99" };
    expect(review.isCurrent(preview)).toBe(false);
    response.rows[0] = { ...response.rows[0], close: "100.25" };
    expect(review.append(preview).appended).toBe(false);
    const apply = vi.fn(() => {
      throw new Error("invented apply failure");
    });
    const failed = review.prepare(capture({ apply })).preview!;
    expect(review.append(failed).appended).toBe(false);
    expect(review.append(failed).appended).toBe(false);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
