import type {
  PersonalSavedManualPeerBindingDto,
  PersonalSavedManualPeerGroupDto,
  PersonalSavedManualPeerIdentityDto,
  PersonalSavedManualPeerPayloadDto,
  PersonalSavedManualPeerPutRequestDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PERSONAL_SAVED_MANUAL_PEER_PATH,
  fetchPersonalSavedManualPeerGroup,
  putPersonalSavedManualPeerGroup,
  resolvePersonalSavedManualPeerGroup,
  samePersonalSavedManualPeerGroup,
  samePersonalSavedManualPeerIdentity,
} from "./personal-saved-manual-peer-group-api";

const fetchMock = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
const sha = (char: string): `sha256:${string}` => `sha256:${char.repeat(64)}`;
const context = (): PersonalSavedManualPeerBindingDto => ({
  catalogSnapshotSha256: sha("a"),
  watchlistVersion: 7,
});
const identity = (n = 1): PersonalSavedManualPeerIdentityDto => ({
  country: "US",
  exchangeMic: "XNAS",
  instrumentType: "common_stock",
  issuerId: `issuer-${n}`,
  issuerName: `Synthetic issuer ${n}`,
  listingId: `listing-${n}`,
  securityId: `security-${n}`,
  securityName: `Synthetic security ${n}`,
  shareClassId: `class-${n}`,
  shareClassName: `Synthetic class ${n}`,
  symbol: `SYN${n}`,
});
const group = (): PersonalSavedManualPeerGroupDto => ({
  createdAgainstCatalogSnapshotSha256: sha("a"),
  primary: identity(),
  peers: [identity(3), identity(2)],
});
const payload = (): PersonalSavedManualPeerPayloadDto => ({
  schemaVersion: 1,
  group: group(),
});
const saveRequest = (): PersonalSavedManualPeerPutRequestDto => ({
  operation: "save",
  payload: payload(),
  context: context(),
});
const clearRequest = (): PersonalSavedManualPeerPutRequestDto => ({
  operation: "clear",
  payload: { schemaVersion: 1, group: null },
  context: null,
});
const record = () => ({
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  id: "personal-manual-peer-group",
  kind: "settings",
  profile: "personal_single_user_local_vault",
  payload: payload(),
  payloadSha256: "b".repeat(64),
  version: 3,
});
const receipt = (version: number) => ({
  committedAt: "2026-09-02T00:00:00.000Z",
  digestSha256: "c".repeat(64),
  id: "personal-manual-peer-group",
  kind: "settings",
  operation: "put",
  profile: "personal_single_user_local_vault",
  replayed: false,
  version,
});
const resolved = () => ({
  schemaVersion: "1.0.0",
  ...context(),
  savedPeerGroupVersion: 3,
  group: { ...group(), createdAgainstCatalogSnapshotSha256: sha("d") },
});
const json = (value: unknown, status = 200, etag: string | null = '"v3"') =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(etag === null ? {} : { ETag: etag }),
    },
  });
function requestedUrl(index = 0): string {
  const input = fetchMock.mock.calls[index]?.[0];
  if (!(input instanceof URL)) throw new Error("Expected URL request");
  return input.href;
}
function requestBody(index = 0): unknown {
  return JSON.parse(fetchMock.mock.calls[index]![1]!.body as string);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("saved manual peer group client", () => {
  it("loads the exact record without resolving, preserving full identity, peer order and historical provenance", async () => {
    const historical = {
      ...record(),
      payload: {
        ...payload(),
        group: { ...group(), createdAgainstCatalogSnapshotSha256: sha("d") },
      },
    };
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(json(historical));
    expect(await fetchPersonalSavedManualPeerGroup(controller.signal)).toEqual({
      version: 3,
      payload: historical.payload,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(PERSONAL_SAVED_MANUAL_PEER_PATH).toBe(
      "/v1/personal-filing/workspace/manual-peer-group",
    );
    expect(requestedUrl()).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/workspace/manual-peer-group",
    );
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    expect(fetchMock.mock.calls[0]![1]!.body).toBeUndefined();
  });

  it("distinguishes an absent record from a versioned null group", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        json({ ...record(), payload: { schemaVersion: 1, group: null } }),
      );
    expect(await fetchPersonalSavedManualPeerGroup(signal())).toBeNull();
    expect(await fetchPersonalSavedManualPeerGroup(signal())).toEqual({
      version: 3,
      payload: { schemaVersion: 1, group: null },
    });
  });

  it.each([
    { id: "personal-dcf-assumptions" },
    { kind: "watchlist" },
    { profile: "other" },
    { version: 0 },
    { version: 3.5 },
    { createdAt: "2026-02-30T00:00:00.000Z" },
    { updatedAt: "2026-08-01T00:00:00.000Z" },
    { payloadSha256: "bad" },
    { metrics: {} },
    { payload: { schemaVersion: 2, group: null } },
    { payload: { ...payload(), notes: "not permitted" } },
    { payload: { ...payload(), group: { ...group(), peers: [] } } },
    { payload: { ...payload(), group: { ...group(), peers: [identity()] } } },
    {
      payload: {
        ...payload(),
        group: {
          ...group(),
          primary: { ...identity(), notes: "not permitted" },
        },
      },
    },
  ])("rejects an invalid or unexpected read envelope %j", async (changed) => {
    fetchMock.mockResolvedValueOnce(json({ ...record(), ...changed }));
    await expect(
      fetchPersonalSavedManualPeerGroup(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([null, '"v2"', 'W/"v3"'])(
    "requires the exact strong read ETag %s",
    async (etag) => {
      fetchMock.mockResolvedValueOnce(json(record(), 200, etag));
      await expect(
        fetchPersonalSavedManualPeerGroup(signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("rejects a valid-shaped read body with the wrong success status", async () => {
    fetchMock.mockResolvedValueOnce(json(record(), 201));
    await expect(
      fetchPersonalSavedManualPeerGroup(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([0, 3])(
    "saves the complete ordered group with exact version %i precondition and mutation intent",
    async (version) => {
      fetchMock.mockResolvedValueOnce(
        json(
          receipt(version + 1),
          version === 0 ? 201 : 200,
          `"v${version + 1}"`,
        ),
      );
      expect(
        await putPersonalSavedManualPeerGroup(version, saveRequest(), signal()),
      ).toEqual({ version: version + 1, payload: payload() });
      expect(requestBody()).toEqual(saveRequest());
      const headers = new Headers(fetchMock.mock.calls[0]![1]!.headers);
      expect(headers.get("X-Research-Cockpit-Intent")).toBe(
        version === 0 ? "personal-vault-create" : "personal-vault-update",
      );
      expect(headers.get("X-Research-Cockpit-Idempotency-Key")).toBe(
        "saved-manual-peer-11111111-2222-4333-8444-555555555555",
      );
      expect(headers.get(version === 0 ? "If-None-Match" : "If-Match")).toBe(
        version === 0 ? "*" : '"v3"',
      );
      expect(
        headers.get(version === 0 ? "If-Match" : "If-None-Match"),
      ).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("clears an orphan or already-null slot without resolution and preserves the version for a later save", async () => {
    fetchMock
      .mockResolvedValueOnce(json(receipt(4), 200, '"v4"'))
      .mockResolvedValueOnce(json(receipt(5), 200, '"v5"'))
      .mockResolvedValueOnce(json(receipt(6), 200, '"v6"'));
    expect(
      await putPersonalSavedManualPeerGroup(3, clearRequest(), signal()),
    ).toEqual({ version: 4, payload: { schemaVersion: 1, group: null } });
    expect(requestBody()).toEqual(clearRequest());
    await putPersonalSavedManualPeerGroup(4, clearRequest(), signal());
    await putPersonalSavedManualPeerGroup(5, saveRequest(), signal());
    expect(
      new Headers(fetchMock.mock.calls[2]![1]!.headers).get("If-Match"),
    ).toBe('"v5"');
    expect(
      fetchMock.mock.calls.every((_, index) =>
        requestedUrl(index).endsWith("/manual-peer-group"),
      ),
    ).toBe(true);
  });

  it("returns the exact submitted snapshot when callers mutate primary, ordered peers and context during save", async () => {
    const draft = saveRequest();
    const expected = structuredClone(draft);
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = putPersonalSavedManualPeerGroup(3, draft, signal());
    Object.assign(draft.payload.group!.primary, {
      shareClassName: "Changed primary",
    });
    Object.assign(draft.payload.group!.peers[0]!, {
      issuerName: "Changed peer",
    });
    Object.assign(draft.payload.group!, { peers: [identity(4)] });
    Object.assign(draft.context!, {
      watchlistVersion: 9,
      catalogSnapshotSha256: sha("e"),
    });
    finish(json(receipt(4), 200, '"v4"'));
    expect(await pending).toEqual({ version: 4, payload: expected.payload });
    expect(requestBody()).toEqual(expected);
  });

  it.each([
    { id: "wrong-record" },
    { kind: "watchlist" },
    { operation: "delete" },
    { profile: "other" },
    { replayed: "true" },
    { version: 5 },
    { digestSha256: "bad" },
    { committedAt: "2026-02-30T00:00:00.000Z" },
    { payload: payload() },
  ])("rejects mismatched write acknowledgements %j", async (changed) => {
    fetchMock.mockResolvedValueOnce(
      json({ ...receipt(4), ...changed }, 200, '"v4"'),
    );
    await expect(
      putPersonalSavedManualPeerGroup(3, saveRequest(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    [0, 200, '"v1"'],
    [3, 201, '"v4"'],
    [3, 200, null],
    [3, 200, '"v3"'],
    [3, 200, 'W/"v4"'],
  ] as const)(
    "rejects wrong status or ETag for version %i",
    async (version, status, etag) => {
      fetchMock.mockResolvedValueOnce(json(receipt(version + 1), status, etag));
      await expect(
        putPersonalSavedManualPeerGroup(version, saveRequest(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("accepts the existing replay acknowledgement without an extra retry", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ ...receipt(4), replayed: true }, 200, '"v4"'),
    );
    expect(
      await putPersonalSavedManualPeerGroup(3, saveRequest(), signal()),
    ).toEqual({ version: 4, payload: payload() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves the same complete primary and current binding while retaining saved provenance and order", async () => {
    fetchMock.mockResolvedValueOnce(json(resolved(), 200, null));
    expect(
      await resolvePersonalSavedManualPeerGroup(
        3,
        identity(),
        context(),
        signal(),
      ),
    ).toEqual(resolved());
    expect(requestedUrl()).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/workspace/manual-peer-group/resolve",
    );
    expect(requestBody()).toEqual({
      ...context(),
      primary: identity(),
      expectedVersion: 3,
    });
    const headers = new Headers(fetchMock.mock.calls[0]![1]!.headers);
    for (const name of [
      "X-Research-Cockpit-Intent",
      "X-Research-Cockpit-Idempotency-Key",
      "If-Match",
      "If-None-Match",
    ])
      expect(headers.has(name)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(
    Object.keys(identity()) as (keyof PersonalSavedManualPeerIdentityDto)[],
  )("rejects a resolve response with changed primary %s", async (key) => {
    const changed = resolved();
    Object.assign(changed.group.primary, {
      [key]:
        key === "instrumentType"
          ? "adr"
          : key === "exchangeMic"
            ? "XNYS"
            : "changed",
    });
    fetchMock.mockResolvedValueOnce(json(changed));
    await expect(
      resolvePersonalSavedManualPeerGroup(3, identity(), context(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    { catalogSnapshotSha256: sha("e") },
    { watchlistVersion: 8 },
    { savedPeerGroupVersion: 4 },
    { schemaVersion: "2.0.0" },
    { group: null },
    { group: { ...group(), peers: [identity(2), identity(2)] } },
    {
      group: {
        ...group(),
        peers: [{ ...identity(2), issuerId: identity().issuerId }],
      },
    },
    { group: { ...group(), peers: [{ ...identity(2), prices: [] }] } },
    { extra: true },
  ])(
    "rejects wrong resolve binding or malformed all-member group %j",
    async (changed) => {
      fetchMock.mockResolvedValueOnce(json({ ...resolved(), ...changed }));
      await expect(
        resolvePersonalSavedManualPeerGroup(3, identity(), context(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("clones primary and context before a delayed resolve and requires status 200", async () => {
    const primary = identity();
    const currentContext = context();
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = resolvePersonalSavedManualPeerGroup(
      3,
      primary,
      currentContext,
      signal(),
    );
    Object.assign(primary, { shareClassId: "class-mutated" });
    Object.assign(currentContext, { watchlistVersion: 8 });
    finish(json(resolved()));
    expect(await pending).toEqual(resolved());
    expect(requestBody()).toEqual({
      ...context(),
      primary: identity(),
      expectedVersion: 3,
    });
    fetchMock.mockResolvedValueOnce(json(resolved(), 201));
    await expect(
      resolvePersonalSavedManualPeerGroup(3, identity(), context(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects malformed, result-bearing and conflicting requests before transport", async () => {
    const sparse = new Array<PersonalSavedManualPeerIdentityDto>(2);
    sparse[0] = identity(2);
    const badRequests: unknown[] = [
      { ...saveRequest(), payload: { schemaVersion: 2, group: group() } },
      { ...saveRequest(), payload: { ...payload(), prices: [] } },
      {
        ...saveRequest(),
        payload: { ...payload(), group: { ...group(), peers: sparse } },
      },
      {
        ...saveRequest(),
        payload: { ...payload(), group: { ...group(), peers: [identity()] } },
      },
      {
        ...saveRequest(),
        payload: {
          ...payload(),
          group: {
            ...group(),
            peers: [identity(2), identity(3), identity(4), identity(5)],
          },
        },
      },
      {
        ...saveRequest(),
        context: { ...context(), catalogSnapshotSha256: sha("b") },
      },
      { ...saveRequest(), context: null },
      { ...saveRequest(), operation: "clear" },
      { ...clearRequest(), context: context() },
      { ...clearRequest(), operation: "save" },
    ];
    for (const request of badRequests)
      await expect(
        putPersonalSavedManualPeerGroup(
          3,
          request as PersonalSavedManualPeerPutRequestDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
    for (const version of [-1, 0.5, Number.MAX_SAFE_INTEGER, NaN])
      await expect(
        putPersonalSavedManualPeerGroup(version, saveRequest(), signal()),
      ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      putPersonalSavedManualPeerGroup(0, clearRequest(), signal()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      resolvePersonalSavedManualPeerGroup(0, identity(), context(), signal()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      resolvePersonalSavedManualPeerGroup(
        3,
        { ...identity(), shareClassName: "" },
        context(),
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      resolvePersonalSavedManualPeerGroup(
        3,
        identity(),
        { ...context(), watchlistVersion: 0 },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, "invalid_request"],
    [401, "session_unavailable"],
    [403, "session_unavailable"],
    [404, "not_covered"],
    [409, "conflict"],
    [429, "rate_limited"],
    [500, "unavailable"],
  ] as const)(
    "sanitizes status %i and does not retry",
    async (status, code) => {
      fetchMock.mockResolvedValueOnce(
        json({ detail: "private server detail" }, status),
      );
      const failure = await resolvePersonalSavedManualPeerGroup(
        3,
        identity(),
        context(),
        signal(),
      ).catch((error: unknown) => error);
      expect(failure).toMatchObject({
        code,
        message: "The personal workspace request was not accepted.",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("handles malformed JSON and aborted transport without retrying or disclosing payload text", async () => {
    fetchMock.mockResolvedValueOnce(new Response("malformed", { status: 200 }));
    await expect(
      fetchPersonalSavedManualPeerGroup(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    await expect(
      putPersonalSavedManualPeerGroup(3, saveRequest(), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[1]![1]!.signal).toBe(controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails before any write if the idempotency key cannot be created", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("No random source");
      },
    });
    await expect(
      putPersonalSavedManualPeerGroup(3, saveRequest(), signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("compares every identity field, primary, peer order, roster length and provenance", () => {
    expect(
      samePersonalSavedManualPeerGroup(group(), structuredClone(group())),
    ).toBe(true);
    expect(
      samePersonalSavedManualPeerGroup(group(), {
        ...group(),
        createdAgainstCatalogSnapshotSha256: sha("d"),
      }),
    ).toBe(false);
    expect(
      samePersonalSavedManualPeerGroup(group(), {
        ...group(),
        peers: [identity(2), identity(3)],
      }),
    ).toBe(false);
    expect(
      samePersonalSavedManualPeerGroup(group(), {
        ...group(),
        peers: [identity(3)],
      }),
    ).toBe(false);
    for (const key of Object.keys(
      identity(),
    ) as (keyof PersonalSavedManualPeerIdentityDto)[]) {
      const changed = identity();
      Object.assign(changed, { [key]: "changed" });
      expect(samePersonalSavedManualPeerIdentity(identity(), changed)).toBe(
        false,
      );
      expect(
        samePersonalSavedManualPeerGroup(group(), {
          ...group(),
          primary: changed,
        }),
      ).toBe(false);
      const changedPeer = identity(3);
      Object.assign(changedPeer, { [key]: "changed" });
      expect(
        samePersonalSavedManualPeerGroup(group(), {
          ...group(),
          peers: [changedPeer, identity(2)],
        }),
      ).toBe(false);
    }
  });
});
