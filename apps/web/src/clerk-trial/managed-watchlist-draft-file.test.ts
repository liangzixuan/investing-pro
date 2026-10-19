import { describe, expect, it, vi } from "vitest";
import {
  encodeMainWatchlistPayload,
  isMainWatchlistPayload,
  MANAGED_WATCHLIST_LIMITS,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  formatManagedWatchlistDraftFile,
  isManagedWatchlistDraftFileDocument,
  MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
  parseManagedWatchlistDraftFile,
  type ManagedWatchlistDraftFileContent,
  type ManagedWatchlistDraftFileInput,
} from "./managed-watchlist-draft-file";

const SCOPE = `sha256:${"a".repeat(64)}`;
const SNAPSHOT = `sha256:${"c".repeat(64)}`;
const TIME = "2026-10-18T23:01:02.345Z";
const encoder = new TextEncoder();
function member(
  changes: Partial<WatchlistMembership> = {},
): WatchlistMembership {
  return {
    country: "US",
    exchangeMic: "XNYS",
    instrumentType: "common_stock",
    issuerId: "issuer-nova",
    issuerName: "Nova Group",
    listingId: "listing-nova-c",
    note: "Unconfirmed source: https://example.test/filing",
    securityId: "security-nova-c",
    securityName: "Nova Group Class C",
    shareClassId: "class-nova-c",
    shareClassName: "Class C",
    symbol: "NOVC",
    ...changes,
  };
}
function input(
  memberships: readonly WatchlistMembership[] = [member()],
): ManagedWatchlistDraftFileInput {
  return {
    accountScope: SCOPE,
    capturedAt: TIME,
    baseVersion: 7,
    draft: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: SNAPSHOT,
      memberships,
    },
  };
}
function content(): ManagedWatchlistDraftFileContent {
  return { format: "investment-watchlist-draft", version: 1, ...input() };
}
function parse(value: unknown) {
  return parseManagedWatchlistDraftFile(JSON.stringify(value), SCOPE);
}
function format(value: unknown) {
  return formatManagedWatchlistDraftFile(
    value as ManagedWatchlistDraftFileInput,
  );
}

describe("explicit Watchlist draft JSON transfer", () => {
  it("round-trips exact order, full share-class identities and the source catalog without saving", () => {
    const draft = input([
      member(),
      member({
        listingId: "listing-nova-a",
        securityId: "security-nova-a",
        securityName: "Nova Group Class A",
        shareClassId: "class-nova-a",
        shareClassName: "Class A",
        symbol: "NOVA",
        exchangeMic: "XNAS",
        note: "",
      }),
    ]);
    const document = formatManagedWatchlistDraftFile(draft)!;
    expect(document).toMatchObject({
      filename: "Investment-watchlist-draft-2026-10-18T23-01-02-345Z.json",
      mime: "application/json",
      membershipCount: 2,
      accountScope: SCOPE,
      capturedAt: TIME,
      baseVersion: 7,
    });
    expect(document.byteLength).toBe(encoder.encode(document.text).byteLength);
    expect(isManagedWatchlistDraftFileDocument(document)).toBe(true);
    expect(parseManagedWatchlistDraftFile(document.text, SCOPE)).toEqual({
      format: "investment-watchlist-draft",
      version: 1,
      ...draft,
    });
    expect(document.text).not.toContain("session");
    expect(document.text).not.toContain("token");
  });
});

describe("raw editing note preservation", () => {
  it.each([
    "  leading and trailing space  ",
    "line one\nline two\t\u0000",
    "Cafe\u0301 and \u202eRTL",
    "x".repeat(2_001),
    "lone \ud800 and \udfff",
  ])(
    "preserves a complete raw invalid note %# without making it valid to save",
    (note) => {
      const document = formatManagedWatchlistDraftFile(
        input([member({ note })]),
      )!;
      const candidate = parseManagedWatchlistDraftFile(document.text, SCOPE)!;
      expect(candidate.draft.memberships[0]!.note).toBe(note);
      expect(isMainWatchlistPayload(candidate.draft)).toBe(false);
      expect(isManagedWatchlistDraftFileDocument(document)).toBe(true);
    },
  );
  it("preserves supplementary Unicode and JSON punctuation without ambiguity", () => {
    const note = '📈 research {"note":"literal"} \\ end';
    const document = formatManagedWatchlistDraftFile(
      input([member({ note })]),
    )!;
    expect(
      parseManagedWatchlistDraftFile(document.text, SCOPE)?.draft
        .memberships[0]!.note,
    ).toBe(note);
  });
});

describe("draft ownership and captured provenance", () => {
  it("returns detached frozen candidate data and a frozen delivery document", () => {
    const original = input();
    const document = formatManagedWatchlistDraftFile(original)!;
    const candidate = parseManagedWatchlistDraftFile(document.text, SCOPE)!;
    expect(candidate.draft).not.toBe(original.draft);
    expect(candidate.draft.memberships[0]).not.toBe(
      original.draft.memberships[0],
    );
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(candidate.draft)).toBe(true);
    expect(Object.isFrozen(candidate.draft.memberships)).toBe(true);
    expect(Object.isFrozen(candidate.draft.memberships[0])).toBe(true);
    const mutable = original.draft.memberships[0] as { note: string };
    mutable.note = "later edit";
    expect(candidate.draft.memberships[0]!.note).not.toBe(mutable.note);
    expect(formatManagedWatchlistDraftFile(candidate)).toBeNull();
  });
  it("accepts an empty draft and a new unsaved base without inventing saved state", () => {
    const document = formatManagedWatchlistDraftFile({
      ...input([]),
      baseVersion: 0,
    })!;
    const restored = parseManagedWatchlistDraftFile(document.text, SCOPE)!;
    expect(restored.baseVersion).toBe(0);
    expect(restored.draft.memberships).toEqual([]);
    expect(document.membershipCount).toBe(0);
  });
  it("retains a different well-formed source catalog; admission remains a separate review", () => {
    const value = content();
    const snapshotSha256 = `sha256:${"d".repeat(64)}`;
    const restored = parse({
      ...value,
      draft: { ...value.draft, snapshotSha256 },
    });
    expect(restored?.draft.snapshotSha256).toBe(snapshotSha256);
  });
});

describe("strict scope, metadata and JSON admission", () => {
  it.each([
    `sha256:${"b".repeat(64)}`,
    "a".repeat(64),
    `sha256:${"A".repeat(64)}`,
    "",
    "unhashed-owner",
  ])("refuses a foreign or malformed expected account scope %#", (scope) => {
    expect(
      parseManagedWatchlistDraftFile(JSON.stringify(content()), scope),
    ).toBeNull();
  });
  it.each([
    { format: "saved-watchlist-export" },
    { version: 2 },
    { version: "1" },
    { accountScope: `sha256:${"b".repeat(64)}` },
    { accountScope: "owner" },
    { capturedAt: "2026-10-18T23:01:02Z" },
    { capturedAt: "2026-10-18T18:01:02.345-05:00" },
    { capturedAt: "2026-02-30T00:00:00.000Z" },
    { capturedAt: "not-a-date" },
    { baseVersion: -1 },
    { baseVersion: 0.5 },
    { baseVersion: "7" },
    { baseVersion: Number.MAX_SAFE_INTEGER + 1 },
    { privateToken: "invented" },
  ])("refuses changed or extra envelope metadata %j", (change) => {
    expect(parse({ ...content(), ...change })).toBeNull();
  });
  it.each([NaN, Infinity, -Infinity])(
    "refuses nonfinite formatter version %s",
    (baseVersion) => {
      expect(
        formatManagedWatchlistDraftFile({ ...input(), baseVersion }),
      ).toBeNull();
    },
  );
  it.each([
    "",
    "null",
    "[]",
    "{}",
    "{",
    "true false",
    '{"format":1,}',
    "[".repeat(258) + "0" + "]".repeat(258),
  ])("refuses malformed or wrong-root JSON %#", (text) => {
    expect(parseManagedWatchlistDraftFile(text, SCOPE)).toBeNull();
  });
  it("refuses duplicate decoded keys rather than accepting JSON.parse's last value", () => {
    const text = JSON.stringify(content());
    for (const duplicate of [
      text.replace('"version":1', '"version":1,"version":1'),
      text.replace('"note":', '"\\u006eote":"ignored","note":'),
      text.replace('"format":', '"__proto__":{},"format":'),
    ])
      expect(parseManagedWatchlistDraftFile(duplicate, SCOPE)).toBeNull();
  });
  it("requires every declared envelope field", () => {
    for (const key of Object.keys(content())) {
      const value: Record<string, unknown> = { ...content() };
      delete value[key];
      expect(parse(value)).toBeNull();
    }
  });
});

describe("editing shape and bounded raw content", () => {
  it.each([
    { country: "GB" },
    { symbol: "novc" },
    { exchangeMic: "xnys" },
    { instrumentType: "fund" },
    { listingId: " bad-id " },
    { issuerId: "" },
    { issuerName: "Nova\nGroup" },
    { shareClassName: "Class C " },
    { note: 42 },
    { extra: "unexpected" },
  ])(
    "refuses noncanonical typed listing identity or member shape %j",
    (change) => {
      const value = content();
      expect(
        parse({
          ...value,
          draft: { ...value.draft, memberships: [{ ...member(), ...change }] },
        }),
      ).toBeNull();
    },
  );
  it.each([
    { name: "Another Watchlist" },
    { schemaVersion: 2 },
    { snapshotSha256: "not-a-hash" },
    { snapshotSha256: `sha256:${"F".repeat(64)}` },
    { memberships: {} },
    { extra: true },
  ])("refuses malformed draft structure %j", (change) => {
    const value = content();
    expect(
      parse({ ...value, draft: { ...value.draft, ...change } }),
    ).toBeNull();
  });
  it("refuses duplicate listing IDs and excessive membership counts", () => {
    expect(
      formatManagedWatchlistDraftFile(
        input([member(), member({ note: "other" })]),
      ),
    ).toBeNull();
    expect(
      formatManagedWatchlistDraftFile(
        input(
          Array.from({ length: 10_001 }, (_, index) =>
            member({ listingId: `listing-${index}` }),
          ),
        ),
      ),
    ).toBeNull();
  });
});

describe("plain draft data properties", () => {
  it("refuses non-data properties, inherited fields and extra array keys without invoking getters", () => {
    const getter = vi.fn(() => "must not run");
    const inherited = Object.assign(
      Object.create({ extra: true }) as object,
      input(),
    );
    expect(format(inherited)).toBeNull();
    const withGetter = { ...input() };
    Object.defineProperty(withGetter, "accountScope", {
      enumerable: true,
      get: getter,
    });
    expect(format(withGetter)).toBeNull();
    const raw = member();
    Object.defineProperty(raw, "note", { enumerable: true, get: getter });
    expect(formatManagedWatchlistDraftFile(input([raw]))).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    const entries = [member()];
    Object.defineProperty(entries, "extra", { value: true });
    expect(formatManagedWatchlistDraftFile(input(entries))).toBeNull();
    expect(
      formatManagedWatchlistDraftFile(input(new Array<WatchlistMembership>(1))),
    ).toBeNull();
  });
  it("refuses hidden and symbol extras at the input and member boundaries", () => {
    const hidden = input();
    Object.defineProperty(hidden, "private", { value: true });
    expect(format(hidden)).toBeNull();
    const extraMember = { ...member(), [Symbol("extra")]: true };
    expect(formatManagedWatchlistDraftFile(input([extraMember]))).toBeNull();
  });
});

describe("canonical editing payload byte budget", () => {
  it("uses the existing canonical payload byte limit without imposing saved-note validity", () => {
    const empty = input([member({ note: "" })]);
    const baseBytes = encoder.encode(
      encodeMainWatchlistPayload(empty.draft),
    ).byteLength;
    const note = "x".repeat(MANAGED_WATCHLIST_LIMITS.payloadBytes - baseBytes);
    const document = formatManagedWatchlistDraftFile(
      input([member({ note })]),
    )!;
    expect(
      encoder.encode(
        encodeMainWatchlistPayload(
          parseManagedWatchlistDraftFile(document.text, SCOPE)!.draft,
        ),
      ).byteLength,
    ).toBe(MANAGED_WATCHLIST_LIMITS.payloadBytes);
    expect(
      formatManagedWatchlistDraftFile(input([member({ note: note + "x" })])),
    ).toBeNull();
    expect(
      formatManagedWatchlistDraftFile(
        input([
          member({ note }),
          member({ listingId: "listing-second", note: "" }),
        ]),
      ),
    ).toBeNull();
    expect(
      formatManagedWatchlistDraftFile(
        input([
          member({
            note: "x".repeat(MANAGED_WATCHLIST_LIMITS.payloadBytes + 1),
          }),
        ]),
      ),
    ).toBeNull();
  });
});

describe("file UTF-8 admission", () => {
  it("checks actual UTF-8 file bytes and admits exactly the file ceiling", () => {
    const text = formatManagedWatchlistDraftFile(input())!.text;
    const padding =
      MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES - encoder.encode(text).byteLength;
    expect(
      parseManagedWatchlistDraftFile(text + " ".repeat(padding), SCOPE),
    ).not.toBeNull();
    expect(
      parseManagedWatchlistDraftFile(text + " ".repeat(padding + 1), SCOPE),
    ).toBeNull();
    const multibyte = JSON.stringify({
      ...content(),
      draft: {
        ...input().draft,
        memberships: [member({ note: "€".repeat(90_000) })],
      },
    });
    expect(multibyte.length).toBeLessThan(
      MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
    );
    expect(encoder.encode(multibyte).byteLength).toBeGreaterThan(
      MANAGED_WATCHLIST_DRAFT_FILE_MAX_BYTES,
    );
    expect(parseManagedWatchlistDraftFile(multibyte, SCOPE)).toBeNull();
  });
  it("refuses ill-formed literal file text while retaining escaped raw note code units", () => {
    const document = formatManagedWatchlistDraftFile(
      input([member({ note: "\ud800" })]),
    )!;
    expect(document.text).toContain("\\ud800");
    expect(
      parseManagedWatchlistDraftFile(
        document.text.replace("\\ud800", "\ud800"),
        SCOPE,
      ),
    ).toBeNull();
  });
});

describe("draft delivery document admission", () => {
  it.each([
    { filename: "another.json" },
    { mime: "text/plain" },
    { byteLength: 0 },
    { membershipCount: 2 },
    { accountScope: `sha256:${"b".repeat(64)}` },
    { capturedAt: "2026-10-19T00:00:00.000Z" },
    { baseVersion: 8 },
    { extra: true },
  ])("refuses mismatched wrapper metadata %j", (change) => {
    const document = formatManagedWatchlistDraftFile(input())!;
    expect(
      isManagedWatchlistDraftFileDocument({ ...document, ...change }),
    ).toBe(false);
  });
  it("refuses arbitrary or noncanonical delivery text even if other metadata looks valid", () => {
    const document = formatManagedWatchlistDraftFile(input())!;
    for (const text of [
      "arbitrary file text",
      JSON.stringify(content(), null, 2),
      document.text + " ",
    ])
      expect(
        isManagedWatchlistDraftFileDocument({
          ...document,
          text,
          byteLength: encoder.encode(text).byteLength,
        }),
      ).toBe(false);
    expect(
      parseManagedWatchlistDraftFile(JSON.stringify(content(), null, 2), SCOPE),
    ).not.toBeNull();
  });
  it("requires each exact document field and rejects hostile getters", () => {
    const document = formatManagedWatchlistDraftFile(input())!;
    for (const key of Object.keys(document)) {
      const value: Record<string, unknown> = { ...document };
      delete value[key];
      expect(isManagedWatchlistDraftFileDocument(value)).toBe(false);
    }
    const getter = vi.fn(() => document.text),
      value = { ...document };
    Object.defineProperty(value, "text", { enumerable: true, get: getter });
    expect(isManagedWatchlistDraftFileDocument(value)).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });
});
