import { describe, expect, it } from "vitest";
import {
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  MANAGED_RESEARCH_FOLLOWUPS_PATH,
  encodeResearchFollowupsPayload,
  normalizeResearchFollowupCheck,
  normalizeResearchFollowupResult,
  parseManagedResearchFollowups,
  parseManagedResearchFollowupsCommand,
  parseManagedResearchFollowupsReceipt,
  parseResearchFollowupsPayload,
  type ResearchFollowupsPayload,
} from "./index";

function entry(index = 0) {
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}` as const,
    listing: {
      country: "US" as const,
      exchangeMic: "XNAS",
      instrumentType: "common_stock" as const,
      issuerId: "issuer-one",
      issuerName: "Example issuer",
      listingId: `listing-${index}`,
      securityId: "security-one",
      securityName: "Example common stock",
      shareClassId: "class-one",
      shareClassName: "Class A",
      symbol: "ZERO",
    },
    check: "Read the next reported filing",
    dueOn: "2026-10-31",
    status: "open" as const,
    completedOn: null,
    result: "",
  };
}

function payload() {
  return { schemaVersion: 1 as const, entries: [entry()] };
}

function command() {
  return {
    expectedVersion: 4,
    idempotencyKey: "followup-command-0001",
    payload: payload(),
  };
}

const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

function rejectedPayload(value: unknown) {
  expect(parseResearchFollowupsPayload(value)).toBeNull();
  expect(
    parseManagedResearchFollowupsCommand({ ...command(), payload: value }),
  ).toBeNull();
  expect(
    parseManagedResearchFollowups({ version: 1, payload: value }),
  ).toBeNull();
}

describe("managed research follow-up payload", () => {
  it("owns and freezes every data layer without changing caller data", () => {
    const input = payload();
    const admitted = parseResearchFollowupsPayload(input);
    expect(admitted).toEqual(input);
    if (!admitted) throw new Error("Expected admitted fixture");
    expect(admitted).not.toBe(input);
    expect(admitted.entries).not.toBe(input.entries);
    expect(admitted.entries[0]).not.toBe(input.entries[0]);
    expect(admitted.entries[0]?.listing).not.toBe(input.entries[0]?.listing);
    for (const owned of [
      admitted,
      admitted.entries,
      admitted.entries[0],
      admitted.entries[0]?.listing,
    ])
      expect(Object.isFrozen(owned)).toBe(true);
    expect(Object.isFrozen(input.entries[0]?.listing)).toBe(false);
    input.entries[0]!.listing.symbol = "CHANGED";
    input.entries[0]!.check = "Caller edited";
    input.entries.length = 0;
    expect(admitted.entries).toEqual([entry()]);
    expect(MANAGED_RESEARCH_FOLLOWUPS_PATH).toBe(
      "/v1/managed/research-followups",
    );
    expect(Object.isFrozen(MANAGED_RESEARCH_FOLLOWUPS_LIMITS)).toBe(true);
  });

  it("encodes fixed field order and preserves entry order and separate catalog identities", () => {
    const first = entry();
    const second = {
      ...entry(1),
      catalogSnapshotSha256: `sha256:${"b".repeat(64)}` as const,
      status: "completed" as const,
      completedOn: "2026-10-15",
      result: "Reviewed the source; no automatic verdict.",
    };
    const input = { schemaVersion: 1 as const, entries: [first, second] };
    const reversedFields = {
      entries: input.entries.map((item) =>
        Object.fromEntries(
          Object.entries({
            ...item,
            listing: Object.fromEntries(Object.entries(item.listing).reverse()),
          }).reverse(),
        ),
      ),
      schemaVersion: 1,
    };
    const captured = parseResearchFollowupsPayload(reversedFields);
    expect(captured).toEqual(input);
    if (!captured) throw new Error("Expected admitted fixture");
    expect(encodeResearchFollowupsPayload(captured)).toBe(
      JSON.stringify(input),
    );
    expect(JSON.parse(encodeResearchFollowupsPayload(captured))).toEqual(input);
    expect(
      encodeResearchFollowupsPayload({ ...input, entries: [second, first] }),
    ).not.toBe(encodeResearchFollowupsPayload(input));
    const nullPrototype = Object.assign(
      Object.create(null) as Record<string, unknown>,
      input,
    );
    expect(parseResearchFollowupsPayload(nullPrototype)).toEqual(input);
  });

  it.each([
    "0001-01-01",
    "0099-12-31",
    "1900-02-28",
    "2000-02-29",
    "2024-02-29",
    "2026-12-31",
    "9999-12-31",
  ])("admits real date %s independently of the current clock", (date) => {
    const value = {
      ...payload(),
      entries: [
        { ...entry(), dueOn: date, status: "completed", completedOn: date },
      ],
    };
    expect(parseResearchFollowupsPayload(value)).toEqual(value);
  });

  it.each([
    "0000-01-01",
    "1900-02-29",
    "2100-02-29",
    "2026-02-29",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-1-01",
    "2026-01-1",
    "2026-10-15T00:00:00Z",
    "2026-10-15+00:00",
    " 2026-10-15",
    "2026-10-15\n",
    "+010000-01-01",
    null,
    20261015,
  ])("rejects invalid due and completion dates %#", (date) => {
    rejectedPayload({ ...payload(), entries: [{ ...entry(), dueOn: date }] });
    rejectedPayload({
      ...payload(),
      entries: [{ ...entry(), status: "completed", completedOn: date }],
    });
  });

  it.each([
    { status: "open", completedOn: "2026-10-15" },
    { status: "completed", completedOn: null },
    { status: "done", completedOn: "2026-10-15" },
    { status: false, completedOn: null },
  ])("requires the status/completion-date discriminant %#", (completion) => {
    rejectedPayload({ ...payload(), entries: [{ ...entry(), ...completion }] });
  });

  it("normalizes authored text explicitly, while wire parsing refuses noncanonical text", () => {
    expect(normalizeResearchFollowupCheck("  Cafe\u0301  ")).toBe("Café");
    expect(normalizeResearchFollowupResult("  Cafe\u0301  ")).toBe("Café");
    expect(normalizeResearchFollowupCheck("  ")).toBeNull();
    expect(normalizeResearchFollowupResult("  ")).toBe("");
    for (const value of [
      " padded ",
      "Cafe\u0301",
      "a\u200bb",
      "a\nb",
      "a\u0000b",
      "\ud800",
      "\udfff",
    ]) {
      rejectedPayload({
        ...payload(),
        entries: [{ ...entry(), check: value }],
      });
      rejectedPayload({
        ...payload(),
        entries: [{ ...entry(), result: value }],
      });
    }
    const maximum = {
      ...payload(),
      entries: [
        { ...entry(), check: "😀".repeat(500), result: "😀".repeat(2000) },
      ],
    };
    expect(parseResearchFollowupsPayload(maximum)).toEqual(maximum);
    expect(normalizeResearchFollowupCheck("😀".repeat(501))).toBeNull();
    expect(normalizeResearchFollowupResult("😀".repeat(2001))).toBeNull();
    for (const invalid of [
      { check: "" },
      { check: "😀".repeat(501) },
      { result: "😀".repeat(2001) },
      { check: 1 },
      { result: null },
    ])
      rejectedPayload({ ...payload(), entries: [{ ...entry(), ...invalid }] });
  });

  it.each([
    "00000000-0000-1000-8000-000000000000",
    "00000000-0000-4000-7000-000000000000",
    "00000000-0000-4000-c000-000000000000",
    "00000000-0000-4000-8000-00000000000A",
    "00000000000040008000000000000000",
    "00000000-0000-4000-8000-000000000000\n",
    "",
    null,
  ])("rejects a noncanonical v4 entry ID %#", (id) => {
    rejectedPayload({ ...payload(), entries: [{ ...entry(), id }] });
  });

  it("bounds count and rejects duplicate entry IDs or listing IDs across status/catalog", () => {
    const maximum = {
      schemaVersion: 1,
      entries: Array.from({ length: 20 }, (_, i) => entry(i)),
    };
    expect(parseResearchFollowupsPayload(maximum)).toEqual(maximum);
    rejectedPayload({ ...maximum, entries: [...maximum.entries, entry(20)] });
    rejectedPayload({
      ...payload(),
      entries: [entry(), { ...entry(1), id: entry().id }],
    });
    rejectedPayload({
      ...payload(),
      entries: [
        entry(),
        {
          ...entry(1),
          listing: entry().listing,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
          status: "completed",
          completedOn: "2026-10-14",
        },
      ],
    });
    expect(
      parseResearchFollowupsPayload({ schemaVersion: 1, entries: [] }),
    ).toEqual({ schemaVersion: 1, entries: [] });
  });

  it.each([
    ["country", "CA"],
    ["exchangeMic", "xnas"],
    ["exchangeMic", "XNASS"],
    ["instrumentType", "etf"],
    ["issuerId", ""],
    ["securityId", "bad/id"],
    ["listingId", "a".repeat(129)],
    ["shareClassId", " spaced "],
    ["issuerName", ""],
    ["securityName", " padded "],
    ["shareClassName", "😀".repeat(513)],
    ["issuerName", "a\u200bb"],
    ["symbol", "lower"],
    ["symbol", "X".repeat(16)],
    ["note", "Not identity"],
    ["cik", "0000000001"],
  ])("preserves existing saved listing admission for %s %#", (field, value) => {
    rejectedPayload({
      ...payload(),
      entries: [
        { ...entry(), listing: { ...entry().listing, [field]: value } },
      ],
    });
  });

  it("retains the existing wider saved-identity bounds without requiring a current catalog", () => {
    const value = {
      ...payload(),
      entries: [
        {
          ...entry(),
          listing: {
            ...entry().listing,
            issuerId: "A",
            securityId: "X",
            shareClassId: "historical:ID",
            issuerName: "😀".repeat(512),
            securityName: "Cafe\u0301",
            instrumentType: "adr",
            symbol: "BRK.B",
          },
        },
      ],
    };
    expect(parseResearchFollowupsPayload(value)).toEqual(value);
  });

  it("rejects closed-shape violations and never invokes accessors at any layer", () => {
    let reads = 0;
    const accessor = (value: object, key: string) =>
      Object.defineProperty(value, key, {
        enumerable: true,
        get() {
          reads++;
          throw new Error("Accessor must not execute");
        },
      });
    for (const value of [
      null,
      [],
      {},
      { ...payload(), schemaVersion: 2 },
      { ...payload(), owner: "caller" },
    ])
      rejectedPayload(value);
    for (const keys of [
      ["schemaVersion", "entries"],
      Object.keys(entry()),
      Object.keys(entry().listing),
    ]) {
      for (const key of keys) {
        const invalid: Record<string, unknown> = {
          ...(keys.length === 2
            ? payload()
            : keys.length === 8
              ? entry()
              : entry().listing),
        };
        delete invalid[key];
        rejectedPayload(
          keys.length === 2
            ? invalid
            : {
                ...payload(),
                entries: [
                  keys.length === 8
                    ? invalid
                    : { ...entry(), listing: invalid },
                ],
              },
        );
      }
    }
    const decorated = Object.assign([entry()], { extra: true });
    const hidden = Object.defineProperty(entry(), "hidden", { value: true });
    const inherited = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      entry(),
    );
    const indexGetter = [entry()];
    accessor(indexGetter, "0");
    for (const entries of [
      new Array(1),
      decorated,
      [hidden],
      [inherited],
      [{ ...entry(), [Symbol("extra")]: true }],
      [accessor(entry(), "check")],
      [{ ...entry(), listing: accessor({ ...entry().listing }, "symbol") }],
      indexGetter,
    ])
      rejectedPayload({ ...payload(), entries });
    rejectedPayload(accessor(payload(), "entries"));
    expect(
      parseManagedResearchFollowupsCommand(accessor(command(), "payload")),
    ).toBeNull();
    expect(
      parseManagedResearchFollowups(
        accessor({ version: 1, payload: payload() }, "version"),
      ),
    ).toBeNull();
    expect(
      parseManagedResearchFollowupsReceipt(
        accessor(
          { version: 5, payload: payload(), replayed: false },
          "replayed",
        ),
        command(),
      ),
    ).toBeNull();
    expect(reads).toBe(0);
  });

  it.each([
    "a".repeat(64),
    `sha256:${"A".repeat(64)}`,
    `sha256:${"a".repeat(63)}`,
    null,
  ])(
    "rejects malformed per-entry catalog digest %#",
    (catalogSnapshotSha256) => {
      rejectedPayload({
        ...payload(),
        entries: [{ ...entry(), catalogSnapshotSha256 }],
      });
    },
  );
});

describe("managed research follow-up envelopes", () => {
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, "1", null])(
    "refuses invalid version %#",
    (version) => {
      expect(
        parseManagedResearchFollowupsCommand({
          ...command(),
          expectedVersion: version,
        }),
      ).toBeNull();
      expect(
        parseManagedResearchFollowups({ version, payload: payload() }),
      ).toBeNull();
    },
  );

  it("keeps the safe-integer next-version bound and requires empty version zero", () => {
    expect(
      parseManagedResearchFollowupsCommand({
        ...command(),
        expectedVersion: Number.MAX_SAFE_INTEGER,
      }),
    ).toBeNull();
    const captured = parseManagedResearchFollowupsCommand({
      ...command(),
      expectedVersion: Number.MAX_SAFE_INTEGER - 1,
    });
    expect(captured).not.toBeNull();
    if (!captured) throw new Error("Expected maximum version command");
    expect(
      parseManagedResearchFollowupsReceipt(
        {
          version: Number.MAX_SAFE_INTEGER,
          payload: payload(),
          replayed: false,
        },
        captured,
      ),
    ).not.toBeNull();
    expect(
      parseManagedResearchFollowups({ version: 0, payload: payload() }),
    ).toBeNull();
    expect(
      parseManagedResearchFollowups({
        version: 0,
        payload: { schemaVersion: 1, entries: [] },
      }),
    ).not.toBeNull();
    expect(
      parseManagedResearchFollowupsCommand({
        ...command(),
        expectedVersion: 0,
      }),
    ).not.toBeNull();
  });

  it.each([
    "short",
    "a".repeat(129),
    "-" + "a".repeat(15),
    "a".repeat(15) + "/",
    "a".repeat(16) + "\n",
    null,
  ])("refuses invalid command key %#", (idempotencyKey) => {
    expect(
      parseManagedResearchFollowupsCommand({ ...command(), idempotencyKey }),
    ).toBeNull();
  });

  it.each([false, true])(
    "binds exact captured canonical data for replayed=%s",
    (replayed) => {
      const input = command();
      const captured = parseManagedResearchFollowupsCommand(input);
      expect(captured).toEqual(input);
      if (!captured) throw new Error("Expected captured command");
      const receipt = parseManagedResearchFollowupsReceipt(
        { version: 5, payload: payload(), replayed },
        captured,
      );
      expect(receipt).toEqual({ version: 5, payload: payload(), replayed });
      expect(Object.isFrozen(captured)).toBe(true);
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(Object.isFrozen(receipt?.payload.entries[0]?.listing)).toBe(true);
      input.payload.entries[0]!.result = "Later caller change";
      expect(captured.payload.entries[0]?.result).toBe("");
      expect(receipt?.payload.entries[0]?.result).toBe("");
      for (const changed of [
        { version: 4 },
        { version: 6 },
        { replayed: "true" },
        { extra: true },
        { payload: input.payload },
      ])
        expect(
          parseManagedResearchFollowupsReceipt(
            { version: 5, payload: payload(), replayed, ...changed },
            captured,
          ),
        ).toBeNull();
    },
  );

  it("rejects altered receipt fields, order, malformed captured commands and extra envelope keys", () => {
    const captured = {
      ...command(),
      payload: { schemaVersion: 1 as const, entries: [entry(), entry(1)] },
    };
    for (const changes of [
      { id: entry(2).id },
      { catalogSnapshotSha256: `sha256:${"b".repeat(64)}` },
      { listing: { ...entry().listing, symbol: "ONE" } },
      { check: "Other check" },
      { dueOn: "2026-11-01" },
      { status: "completed", completedOn: "2026-10-15" },
      { result: "Authored result" },
    ])
      expect(
        parseManagedResearchFollowupsReceipt(
          {
            version: 5,
            payload: {
              ...captured.payload,
              entries: [{ ...entry(), ...changes }, entry(1)],
            },
            replayed: true,
          },
          captured,
        ),
      ).toBeNull();
    expect(
      parseManagedResearchFollowupsReceipt(
        {
          version: 5,
          payload: {
            ...captured.payload,
            entries: [...captured.payload.entries].reverse(),
          },
          replayed: true,
        },
        captured,
      ),
    ).toBeNull();
    expect(
      parseManagedResearchFollowupsReceipt(
        { version: 5, payload: captured.payload, replayed: true },
        { ...captured, idempotencyKey: "bad" },
      ),
    ).toBeNull();
    for (const key of Object.keys(command())) {
      const invalid: Record<string, unknown> = { ...command() };
      delete invalid[key];
      expect(parseManagedResearchFollowupsCommand(invalid)).toBeNull();
    }
    expect(
      parseManagedResearchFollowupsCommand({ ...command(), ownerId: "caller" }),
    ).toBeNull();
    expect(
      parseManagedResearchFollowups({
        version: 1,
        payload: payload(),
        id: "main",
      }),
    ).toBeNull();
    expect(parseManagedResearchFollowups({ version: 1 })).toBeNull();
  });

  it("admits the exact 256 KiB payload boundary and proves all maximum envelopes fit", () => {
    const longId = "a".repeat(128);
    const entries = Array.from({ length: 20 }, (_, i) => ({
      ...entry(i),
      check: "😀".repeat(500),
      listing: {
        ...entry(i).listing,
        issuerId: longId,
        securityId: longId,
        shareClassId: longId,
        listingId: longId.slice(2) + i.toString().padStart(2, "0"),
        issuerName: "😀".repeat(512),
        securityName: "😀".repeat(512),
        shareClassName: "😀".repeat(512),
        symbol: "X".repeat(15),
      },
    }));
    const value = { schemaVersion: 1 as const, entries };
    let remaining =
      MANAGED_RESEARCH_FOLLOWUPS_LIMITS.payloadBytes - bytes(value);
    expect(remaining).toBeGreaterThan(0);
    for (const item of entries) {
      const astral = Math.min(2000, Math.floor(remaining / 4));
      const ascii = Math.min(2000 - astral, remaining - astral * 4);
      item.result = "😀".repeat(astral) + "x".repeat(ascii);
      remaining -= astral * 4 + ascii;
    }
    expect(remaining).toBe(0);
    expect(bytes(value)).toBe(262_144);
    expect(encodeResearchFollowupsPayload(value)).toBe(JSON.stringify(value));
    const captured = parseManagedResearchFollowupsCommand({
      expectedVersion: Number.MAX_SAFE_INTEGER - 1,
      idempotencyKey: longId,
      payload: value,
    });
    expect(captured).not.toBeNull();
    if (!captured) throw new Error("Expected maximum payload command");
    const read = parseManagedResearchFollowups({
      version: Number.MAX_SAFE_INTEGER,
      payload: value,
    });
    const receipt = parseManagedResearchFollowupsReceipt(
      { version: Number.MAX_SAFE_INTEGER, payload: value, replayed: false },
      captured,
    );
    expect(read).not.toBeNull();
    expect(receipt).not.toBeNull();
    for (const envelope of [captured, read, receipt])
      expect(bytes(envelope)).toBeLessThan(
        MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes,
      );
    entries.at(-1)!.result += "x";
    expect(bytes(value)).toBe(262_145);
    rejectedPayload(value);
    expect(() => encodeResearchFollowupsPayload(value)).toThrow(TypeError);
    expect(
      parseManagedResearchFollowupsReceipt(
        { version: Number.MAX_SAFE_INTEGER, payload: value, replayed: false },
        captured,
      ),
    ).toBeNull();
  });

  it("counts JSON escaping in the byte cap without changing authored strings", () => {
    const value: ResearchFollowupsPayload = {
      schemaVersion: 1,
      entries: [{ ...entry(), result: '\\"'.repeat(1000) }],
    };
    expect(parseResearchFollowupsPayload(value)).toEqual(value);
    expect(bytes(value) - bytes(payload())).toBe(4000);
    expect(encodeResearchFollowupsPayload(value)).toBe(JSON.stringify(value));
  });
});
