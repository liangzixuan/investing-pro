import { describe, expect, it } from "vitest";
import {
  CpiHeadlinesProviderError,
  parseCpiHeadlinesAtom,
} from "./cpi-headlines-parser";
import {
  cpiAtom,
  cpiEntry,
  cpiItem,
  CPI_FETCHED_AT,
} from "./test-cpi-headlines-fixture";
const parse = (text: string) => parseCpiHeadlinesAtom(text, CPI_FETCHED_AT);
function rejects(text: string) {
  expect(() => parse(text)).toThrowError(
    new CpiHeadlinesProviderError("invalid_response"),
  );
}
describe("qualified CPI Atom metadata", () => {
  it("admits only headline metadata, retains exact independent clocks and omits content/images", () => {
    const parsed = parse(cpiAtom());
    expect(parsed.items).toEqual([cpiItem()]);
    expect(parsed.availableItemCount).toBe(1);
    expect(parsed.fetchedAt).toBe(CPI_FETCHED_AT);
    expect(parsed.feedUpdatedAt).toBe("2026-10-01T07:50:31.2-04:00");
    expect(JSON.stringify(parsed)).not.toMatch(/Excluded|favicon|\.gif/u);
    for (const value of [parsed, parsed.items, parsed.items[0]])
      expect(Object.isFrozen(value)).toBe(true);
  });
  it("keeps missing clocks independently unknown and accepts checked-empty", () => {
    const noPublished = cpiEntry().replace(
      /<published>[^<]*<\/published>/u,
      "",
    );
    expect(parse(cpiAtom(noPublished)).items[0]).toMatchObject({
      publishedAt: null,
      updatedAt: cpiItem().updatedAt,
    });
    const noUpdated = cpiEntry().replace(/<updated>[^<]*<\/updated>/u, "");
    expect(parse(cpiAtom(noUpdated)).items[0]).toMatchObject({
      publishedAt: cpiItem().publishedAt,
      updatedAt: null,
    });
    expect(
      parse(cpiAtom("").replace(/<updated>[^<]*<\/updated>/u, "")),
    ).toMatchObject({ feedUpdatedAt: null, availableItemCount: 0, items: [] });
  });
  it("deduplicates identical entries before the ten-row cap and validates all128 inputs", () => {
    const entries = Array.from({ length: 12 }, (_, index) => cpiEntry(index));
    const parsed = parse(cpiAtom(entries.join("") + entries[0]));
    expect(parsed.availableItemCount).toBe(12);
    expect(parsed.items).toHaveLength(10);
    expect(parsed.items.map((item) => item.sourceId)).toEqual(
      Array.from({ length: 10 }, (_, i) => `invented-cpi-${i}`),
    );
    expect(parse(cpiAtom(cpiEntry().repeat(128))).availableItemCount).toBe(1);
    const complete = Array.from({ length: 128 }, (_, index) => {
      const month = String(Math.floor(index / 28) + 1).padStart(2, "0");
      const day = String((index % 28) + 1).padStart(2, "0");
      return cpiEntry(index).replace(
        /cpi_10\d+2026\.htm/u,
        `cpi_${month}${day}2026.htm`,
      );
    });
    const maximum = parse(cpiAtom(complete.join("")));
    expect(maximum.availableItemCount).toBe(128);
    expect(maximum.items).toHaveLength(10);
    rejects(cpiAtom(cpiEntry().repeat(129)));
    rejects(
      cpiAtom(
        entries.join("") + cpiEntry(12).replace("Invented café", "bad\u202e"),
      ),
    );
  });
  it("sorts equivalent-offset exact fractions with stable equal-time ties and unknown last", () => {
    const a = cpiEntry(0).replace(
      cpiItem().publishedAt!,
      "2026-10-01T11:50:31.0000001Z",
    );
    const b = cpiEntry(1).replace(
      cpiItem().publishedAt!,
      "2026-10-01T07:50:31.0000002-04:00",
    );
    const c = cpiEntry(2).replace(
      cpiItem().publishedAt!,
      "2026-10-01T11:50:31.00000020Z",
    );
    const unknown = cpiEntry(3).replace(/<published>[^<]*<\/published>/u, "");
    expect(
      parse(cpiAtom(unknown + a + b + c)).items.map((item) => item.sourceId),
    ).toEqual([
      "invented-cpi-1",
      "invented-cpi-2",
      "invented-cpi-0",
      "invented-cpi-3",
    ]);
  });
  it.each([
    (s: string) =>
      s.replace("http://www.w3.org/2005/Atom", "https://other.invalid"),
    (s: string) => s.replace("bls.gov:feed:cpi", "bls.gov:feed:empsit"),
    (s: string) => s.replace("Consumer Price Index", "Other title"),
    (s: string) => s.replace("<entry>", '<entry xmlns="urn:other">'),
    (s: string) => s.replace("<title>Invented", '<title type="html">Invented'),
    (s: string) => s.replace("<title>Invented", "<title><b>Invented</b>"),
    (s: string) => s.replace("<category>", '<category term="News Release">'),
    (s: string) =>
      s.replace(
        "<category>News Release</category>",
        "<category>Other</category>",
      ),
    (s: string) => s.replace("<link href=", '<link rel="alternate" href='),
    (s: string) =>
      s.replace("<content>", '<content src="https://private.invalid">'),
    (s: string) =>
      s.replace(
        "<id>invented-cpi-0</id>",
        "<id>invented-cpi-0</id><id>duplicate</id>",
      ),
    (s: string) =>
      s.replace(
        "<updated>2025-01-01T00:00:00Z</updated>",
        "<updated>2025-02-30T00:00:00Z</updated>",
      ),
    (s: string) =>
      s.replace(
        "<published>2026-10-01T07:50:31.2000001-04:00</published>",
        "<published/>",
      ),
    (s: string) => s.replace("cpi_10012026.htm", "cpi_02302026.htm"),
    (s: string) =>
      s.replace(
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml version="1.0" encoding="UTF-16"?>',
      ),
    (s: string) => s.replace("<entry>", "<!-- private source --> <entry>"),
    (s: string) => s.replace("<entry>", "<?private source?> <entry>"),
    (s: string) => s.replace("<entry>", "<unexpected/><entry>"),
    (s: string) => s.replace("Invented café", "&unknown;"),
    (s: string) => '<!DOCTYPE feed [<!ENTITY secret "private">]>' + s,
    (s: string) => s + "<feed/>",
    () => "x".repeat(262145),
  ])(
    "refuses malformed/unqualified complete source input %# without excerpts",
    (change) => rejects(change(cpiAtom())),
  );
  it.each([
    cpiEntry().replace("Invented café", "Different"),
    cpiEntry(1).replace("invented-cpi-1", "invented-cpi-0"),
    cpiEntry(1).replace("cpi_10022026.htm", "cpi_10012026.htm"),
  ])("refuses conflicting duplicate IDs or URLs", (conflicting) =>
    rejects(cpiAtom(cpiEntry() + conflicting)),
  );
  it("decodes ordinary XML text entities without parsing economic values", () => {
    expect(
      parse(cpiAtom(cpiEntry().replace("café", "café &amp; &#x754c;")))
        .items[0]!.title,
    ).toContain("café & 界");
  });
});
