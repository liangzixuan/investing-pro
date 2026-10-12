import { describe, expect, it } from "vitest";
import {
  encodeMainWatchlistPayload,
  MANAGED_WATCHLIST_LIMITS,
  parseManagedWatchlist,
  type MainWatchlistPayload,
  type WatchlistMembership,
} from "@research-cockpit/contracts";
import {
  formatManagedWatchlistExport,
  isSavedWatchlistExportDocument,
  MANAGED_WATCHLIST_EXPORT_MAX_BYTES,
  managedWatchlistExportUnavailableReason,
} from "./managed-watchlist-export-document";
import type { SaveState, VersionedPayload } from "./save-coordinator";

const snapshotSha256 = `sha256:${"a".repeat(64)}`;
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
    note: "Saved evidence: 2026-09-19; https://example.test/filing; USD 0.00001.",
    securityId: "security-nova-c",
    securityName: "Nova Group Class C",
    shareClassId: "class-nova-c",
    shareClassName: "Class C",
    symbol: "NOVC",
    ...changes,
  };
}

function saved(
  memberships: readonly WatchlistMembership[] = [member()],
  version = 7,
): VersionedPayload<MainWatchlistPayload> {
  return {
    version,
    payload: {
      memberships,
      name: "My Watchlist",
      schemaVersion: 1,
      snapshotSha256,
    },
  };
}

function state(
  changes: Partial<SaveState<MainWatchlistPayload>> = {},
): SaveState<MainWatchlistPayload> {
  const confirmed = saved();
  return {
    phase: "idle",
    saved: confirmed,
    draft: confirmed.payload,
    baseVersion: confirmed.version,
    dirty: false,
    conflict: false,
    latestLoaded: true,
    uncertain: false,
    replayPending: false,
    message: "",
    signOutFailed: false,
    ...changes,
  };
}

function payloadBytes(payload: MainWatchlistPayload): number {
  return encoder.encode(encodeMainWatchlistPayload(payload)).byteLength;
}

function fullPayload(): VersionedPayload<MainWatchlistPayload> {
  const memberships: WatchlistMembership[] = [];
  for (let index = 0; ; index += 1) {
    const next = member({ listingId: `listing-${index}`, note: "" });
    if (
      payloadBytes(saved([...memberships, next]).payload) >
      MANAGED_WATCHLIST_LIMITS.payloadBytes
    )
      break;
    memberships.push(next);
  }
  const remaining =
    MANAGED_WATCHLIST_LIMITS.payloadBytes -
    payloadBytes(saved(memberships).payload);
  memberships[0] = { ...memberships[0]!, note: "x".repeat(remaining) };
  return saved(memberships, Number.MAX_SAFE_INTEGER);
}

describe("confirmed saved watchlist text", () => {
  it("retains full membership order and every identity field, including same-issuer classes", () => {
    const input = saved([
      member(),
      member({
        exchangeMic: "XNAS",
        listingId: "listing-nova-a",
        securityId: "security-nova-a",
        securityName: "Nova Group Class A",
        shareClassId: "class-nova-a",
        shareClassName: "Class A",
        symbol: "NOVA",
        note: "",
      }),
    ]);
    const before = structuredClone(input);
    const document = formatManagedWatchlistExport(input)!;
    expect(document.text).toBe(
      `Investment - My Watchlist
Saved version: 7
Catalog snapshot: ${snapshotSha256}
Listings: 2
Scope: All listings from this confirmed saved version. Unsaved changes are not included.

Listing 1
Listing ID: listing-nova-c
Symbol: NOVC
Exchange MIC: XNYS
Country: US
Instrument type: common_stock
Issuer ID: issuer-nova
Issuer name: Nova Group
Security ID: security-nova-c
Security name: Nova Group Class C
Share class ID: class-nova-c
Share class name: Class C
Saved note (69 UTF-8 bytes):
Saved evidence: 2026-09-19; https://example.test/filing; USD 0.00001.
End saved note.

Listing 2
Listing ID: listing-nova-a
Symbol: NOVA
Exchange MIC: XNAS
Country: US
Instrument type: common_stock
Issuer ID: issuer-nova
Issuer name: Nova Group
Security ID: security-nova-a
Security name: Nova Group Class A
Share class ID: class-nova-a
Share class name: Class A
Saved note (0 UTF-8 bytes):

End saved note.
`,
    );
    expect(document).toMatchObject({
      filename: "Investment-watchlist-v7.txt",
      version: 7,
      membershipCount: 2,
      byteLength: encoder.encode(document.text).byteLength,
    });
    expect(input).toEqual(before);
    expect(Object.isFrozen(document)).toBe(true);
    expect(formatManagedWatchlistExport(input)).toEqual(document);
  });

  it("represents an empty confirmed initial version without inventing a save date", () => {
    const document = formatManagedWatchlistExport(saved([], 0))!;
    expect(document).toMatchObject({
      version: 0,
      membershipCount: 0,
      filename: "Investment-watchlist-v0.txt",
    });
    expect(document.text).toContain("Listings: 0\n");
    expect(document.text).toContain("\nNo saved listings.\n");
    expect(document.text).not.toMatch(/saved at|exported at|timestamp/iu);
    expect(isSavedWatchlistExportDocument(document)).toBe(true);
  });

  it("preserves Unicode, punctuation, note boundaries and unnormalized identity text exactly", () => {
    const note = 'Café 🧭  "End saved note." \\ USD -0.00001; 2026-09-19';
    const input = saved([member({ issuerName: "Cafe\u0301 Holdings", note })]);
    const document = formatManagedWatchlistExport(input)!;
    expect(document.text).toContain("Issuer name: Cafe\u0301 Holdings\n");
    expect(document.text).toContain(
      `Saved note (${encoder.encode(note).byteLength} UTF-8 bytes):\n${note}\nEnd saved note.\n`,
    );
    expect(document.byteLength).toBeGreaterThan(document.text.length);
    expect(
      new TextDecoder("utf-8", { fatal: true }).decode(
        encoder.encode(document.text),
      ),
    ).toBe(document.text);
    expect(isSavedWatchlistExportDocument(document)).toBe(true);
  });

  it("keeps maximum Unicode note and names complete", () => {
    const note = "🧭".repeat(2_000);
    const name = "星".repeat(512);
    const document = formatManagedWatchlistExport(
      saved([
        member({
          note,
          issuerName: name,
          securityName: name,
          shareClassName: name,
        }),
      ]),
    )!;
    expect(document.text).toContain(
      `Saved note (8000 UTF-8 bytes):\n${note}\n`,
    );
    expect(document.text).toContain(`Issuer name: ${name}\n`);
    expect(document.text).toContain(`Security name: ${name}\n`);
    expect(document.text).toContain(`Share class name: ${name}\n`);
    expect(document.byteLength).toBeLessThan(
      MANAGED_WATCHLIST_EXPORT_MAX_BYTES,
    );
  });

  it("exports the entire maximum admitted payload and refuses one extra byte without partial output", () => {
    const input = fullPayload();
    expect(payloadBytes(input.payload)).toBe(
      MANAGED_WATCHLIST_LIMITS.payloadBytes,
    );
    expect(parseManagedWatchlist(input)).not.toBeNull();
    const document = formatManagedWatchlistExport(input)!;
    expect(document.membershipCount).toBe(input.payload.memberships.length);
    expect(document.text.match(/\nListing ID:/gu)).toHaveLength(
      document.membershipCount,
    );
    expect(document.text).toContain(
      `Listing ID: ${input.payload.memberships.at(-1)!.listingId}\n`,
    );
    expect(document.byteLength).toBeLessThanOrEqual(
      MANAGED_WATCHLIST_EXPORT_MAX_BYTES,
    );
    expect(isSavedWatchlistExportDocument(document)).toBe(true);
    const oversized = saved([
      {
        ...input.payload.memberships[0]!,
        note: `${input.payload.memberships[0]!.note}x`,
      },
      ...input.payload.memberships.slice(1),
    ]);
    expect(payloadBytes(oversized.payload)).toBe(
      MANAGED_WATCHLIST_LIMITS.payloadBytes + 1,
    );
    expect(formatManagedWatchlistExport(oversized)).toBeNull();
  });

  it.each([
    ["nonempty version zero", saved([member()], 0)],
    ["unsafe version", saved([], Number.MAX_SAFE_INTEGER + 1)],
    ["negative version", saved([], -1)],
    ["duplicate listing", saved([member(), member()])],
    ["unnormalized saved note", saved([member({ note: " Cafe\u0301 " })])],
    ["multiline saved note", saved([member({ note: "one\ntwo" })])],
    ["invalid Unicode", saved([member({ issuerName: "bad\ud800" })])],
  ])("refuses %s using the saved contract", (_label, input) => {
    expect(formatManagedWatchlistExport(input)).toBeNull();
  });
});

describe("export document adapter boundary", () => {
  it.each([
    ["extra key", { extra: true }],
    ["unsafe version", { version: Number.MAX_SAFE_INTEGER + 1 }],
    ["negative count", { membershipCount: -1 }],
    ["fractional count", { membershipCount: 0.5 }],
    ["unsafe count", { membershipCount: Number.MAX_SAFE_INTEGER + 1 }],
    ["private filename", { filename: "private-owner.txt" }],
    ["path filename", { filename: "../Investment-watchlist-v7.txt" }],
    ["mismatched version", { version: 8 }],
    ["wrong byte count", { byteLength: 1 }],
    ["empty text", { text: "", byteLength: 0 }],
    ["high surrogate", { text: "\ud800", byteLength: 3 }],
    ["low surrogate", { text: "\udc00", byteLength: 3 }],
  ])("rejects %s", (_label, change) => {
    expect(
      isSavedWatchlistExportDocument({
        ...formatManagedWatchlistExport(saved()),
        ...change,
      }),
    ).toBe(false);
  });

  it("rejects missing fields and non-record values", () => {
    const document = formatManagedWatchlistExport(saved())!;
    for (const key of Object.keys(document)) {
      const missing: Record<string, unknown> = { ...document };
      delete missing[key];
      expect(isSavedWatchlistExportDocument(missing)).toBe(false);
    }
    for (const invalid of [null, undefined, [], 1, "text"])
      expect(isSavedWatchlistExportDocument(invalid)).toBe(false);
  });

  it("enforces the encoded byte boundary for direct adapter inputs", () => {
    expect(MANAGED_WATCHLIST_EXPORT_MAX_BYTES).toBe(524_800);
    const text = "🧭".repeat(MANAGED_WATCHLIST_EXPORT_MAX_BYTES / 4);
    const document = {
      ...formatManagedWatchlistExport(saved())!,
      text,
      byteLength: MANAGED_WATCHLIST_EXPORT_MAX_BYTES,
    };
    expect(isSavedWatchlistExportDocument(document)).toBe(true);
    expect(
      isSavedWatchlistExportDocument({
        ...document,
        text: `${text}x`,
        byteLength: document.byteLength + 1,
      }),
    ).toBe(false);
    expect(
      isSavedWatchlistExportDocument({ ...document, byteLength: text.length }),
    ).toBe(false);
  });
});

describe("saved export readiness", () => {
  it("allows confirmed saved data alongside an invalid dirty draft and an older catalog snapshot", () => {
    const current = state({
      dirty: true,
      latestLoaded: false,
      draft: {
        ...saved().payload,
        memberships: [member({ note: "invalid\ndraft" })],
      },
      message: "Draft is invalid.",
    });
    const before = structuredClone(current);
    expect(managedWatchlistExportUnavailableReason(current)).toBeNull();
    const document = formatManagedWatchlistExport(current.saved!)!;
    expect(document.text).toContain(`Catalog snapshot: ${snapshotSha256}`);
    expect(document.text).toContain("Saved evidence: 2026-09-19");
    expect(document.text).not.toContain("invalid\ndraft");
    expect(current).toEqual(before);
  });

  it("allows a confirmed empty watchlist", () => {
    expect(
      managedWatchlistExportUnavailableReason(state({ saved: saved([], 0) })),
    ).toBeNull();
  });

  it.each([
    "loading",
    "saving",
    "reconciling",
    "signing_out",
    "retired",
  ] as const)("blocks %s even with a retained saved payload", (phase) => {
    expect(managedWatchlistExportUnavailableReason(state({ phase }))).toBe(
      phase,
    );
  });

  it.each([
    ["no_saved", { saved: null }],
    ["conflict", { conflict: true }],
    ["uncertain", { uncertain: true }],
    ["replay_pending", { replayPending: true, conflict: true }],
  ] as const)("blocks %s while idle", (reason, changes) => {
    expect(managedWatchlistExportUnavailableReason(state(changes))).toBe(
      reason,
    );
  });
});
