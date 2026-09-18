import type {
  PersonalFinancialComparisonSelectionBindingDto,
  PersonalFinancialComparisonSelectionPayloadDto,
  PersonalSecurityMasterScreenRowDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPersonalFinancialComparisonSelection,
  savePersonalFinancialComparisonSelection,
  resolvePersonalFinancialComparisonSelection,
  samePersonalFinancialComparisonMembers,
} from "./personal-financial-comparison-selection-api";

const fetchMock = vi.fn<typeof fetch>();
function requestedUrl(index = 0): string {
  const input = fetchMock.mock.calls[index]?.[0];
  if (!(input instanceof URL)) throw new Error("Expected a URL request.");
  return input.href;
}
const signal = () => new AbortController().signal;
const sha = (char: string): `sha256:${string}` => `sha256:${char.repeat(64)}`;
const context = (): PersonalFinancialComparisonSelectionBindingDto => ({
  catalogSnapshotSha256: sha("a"),
  watchlistVersion: 7,
});
const member = (n: number): PersonalSecurityMasterScreenRowDto => ({
  cik: String(n).padStart(10, "0"),
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
const payload = (): PersonalFinancialComparisonSelectionPayloadDto => ({
  schemaVersion: 1,
  selection: {
    createdAgainstCatalogSnapshotSha256: sha("a"),
    members: [member(2), member(1)],
  },
});
const record = () => ({
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  id: "financial-comparison-selection",
  kind: "settings",
  profile: "personal_single_user_local_vault",
  payload: payload(),
  payloadSha256: "b".repeat(64),
  version: 3,
});
const receipt = (version: number) => ({
  committedAt: "2026-09-02T00:00:00.000Z",
  digestSha256: "c".repeat(64),
  id: "financial-comparison-selection",
  kind: "settings",
  operation: "put",
  profile: "personal_single_user_local_vault",
  replayed: false,
  version,
});
const resolved = () => ({
  schemaVersion: "1.0.0",
  ...context(),
  savedSelectionVersion: 3,
  members: [member(2), member(1)],
});
const json = (value: unknown, status = 200, etag: string | null = '"v3"') =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(etag === null ? {} : { ETag: etag }),
    },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("saved comparison client boundaries", () => {
  it("loads only the exact record, preserving order and historical provenance without a write", async () => {
    const saved = record();
    const historical = {
      ...saved,
      payload: {
        ...saved.payload,
        selection: {
          ...saved.payload.selection!,
          createdAgainstCatalogSnapshotSha256: sha("d"),
        },
      },
    };
    fetchMock.mockResolvedValueOnce(json(historical));
    expect(await fetchPersonalFinancialComparisonSelection(signal())).toEqual({
      version: 3,
      payload: historical.payload,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl()).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/workspace/financial-screen/saved-comparison",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  });
  it("distinguishes an absent record from a versioned cleared selection", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        json({ ...record(), payload: { schemaVersion: 1, selection: null } }),
      );
    expect(
      await fetchPersonalFinancialComparisonSelection(signal()),
    ).toBeNull();
    expect(await fetchPersonalFinancialComparisonSelection(signal())).toEqual({
      version: 3,
      payload: { schemaVersion: 1, selection: null },
    });
  });
  it.each([
    { id: "financial-screener-saved-views" },
    { kind: "watchlist" },
    { profile: "other" },
    { version: 0 },
    { createdAt: "2026-02-30T00:00:00.000Z" },
    { updatedAt: "2026-08-01T00:00:00.000Z" },
    { payloadSha256: "not-a-digest" },
    { prices: [] },
    { payload: { schemaVersion: 2, selection: null } },
  ])("rejects wrong or malformed record envelope %j", async (changed) => {
    fetchMock.mockResolvedValueOnce(json({ ...record(), ...changed }));
    await expect(
      fetchPersonalFinancialComparisonSelection(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([null, '"v2"', 'W/"v3"'])(
    "rejects absent or inconsistent read ETag %s",
    async (etag) => {
      fetchMock.mockResolvedValueOnce(json(record(), 200, etag));
      await expect(
        fetchPersonalFinancialComparisonSelection(signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it.each([0, 3])(
    "saves with version %i precondition, intent and an idempotency key",
    async (version) => {
      fetchMock.mockResolvedValueOnce(
        json(
          receipt(version + 1),
          version === 0 ? 201 : 200,
          `"v${version + 1}"`,
        ),
      );
      const saved = await savePersonalFinancialComparisonSelection(
        version,
        payload(),
        context(),
        signal(),
      );
      expect(saved).toEqual({ version: version + 1, payload: payload() });
      const init = fetchMock.mock.calls[0]![1]!;
      expect(JSON.parse(init.body as string)).toEqual({
        payload: payload(),
        context: context(),
      });
      const headers = new Headers(init.headers);
      expect(headers.get("X-Research-Cockpit-Intent")).toBe(
        version === 0 ? "personal-vault-create" : "personal-vault-update",
      );
      expect(headers.get("X-Research-Cockpit-Idempotency-Key")).toBe(
        "financial-comparison-11111111-2222-4333-8444-555555555555",
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
  it("clears without catalog/watchlist resolution and preserves a version for the next save", async () => {
    const cleared = { schemaVersion: 1 as const, selection: null };
    fetchMock
      .mockResolvedValueOnce(json(receipt(4), 200, '"v4"'))
      .mockResolvedValueOnce(json(receipt(5), 200, '"v5"'));
    const result = await savePersonalFinancialComparisonSelection(
      3,
      cleared,
      null,
      signal(),
    );
    expect(result).toEqual({ version: 4, payload: cleared });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      payload: cleared,
      context: null,
    });
    await savePersonalFinancialComparisonSelection(
      result.version,
      payload(),
      context(),
      signal(),
    );
    expect(
      new Headers(fetchMock.mock.calls[1]![1]!.headers).get("If-Match"),
    ).toBe('"v4"');
  });
  it("binds a pending save to copied identities and context", async () => {
    const draft = structuredClone(payload()),
      binding = context(),
      expected = structuredClone(draft);
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = savePersonalFinancialComparisonSelection(
      3,
      draft,
      binding,
      signal(),
    );
    Object.assign(draft.selection!.members[0]!, { symbol: "CHANGED" });
    Object.assign(binding, {
      watchlistVersion: 99,
      catalogSnapshotSha256: sha("e"),
    });
    finish(json(receipt(4), 200, '"v4"'));
    expect(await pending).toEqual({ version: 4, payload: expected });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      payload: expected,
      context: context(),
    });
  });
  it.each([
    { id: "wrong-record" },
    { operation: "delete" },
    { kind: "watchlist" },
    { version: 5 },
    { digestSha256: "bad" },
    { replayed: "true" },
    { profile: "other" },
    { committedAt: "invalid" },
    { payload: payload() },
  ])("rejects a mismatched mutation receipt %j", async (changed) => {
    fetchMock.mockResolvedValueOnce(
      json({ ...receipt(4), ...changed }, 200, '"v4"'),
    );
    await expect(
      savePersonalFinancialComparisonSelection(
        3,
        payload(),
        context(),
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("rejects a wrong mutation status or ETag while accepting a valid replay receipt", async () => {
    fetchMock
      .mockResolvedValueOnce(json(receipt(4), 201, '"v4"'))
      .mockResolvedValueOnce(json(receipt(4), 200, '"v3"'))
      .mockResolvedValueOnce(
        json({ ...receipt(4), replayed: true }, 200, '"v4"'),
      );
    for (let i = 0; i < 2; i++)
      await expect(
        savePersonalFinancialComparisonSelection(
          3,
          payload(),
          context(),
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_response" });
    expect(
      await savePersonalFinancialComparisonSelection(
        3,
        payload(),
        context(),
        signal(),
      ),
    ).toEqual({ version: 4, payload: payload() });
  });
  it("resolves current bindings separately from saved provenance with no write headers", async () => {
    fetchMock.mockResolvedValueOnce(json(resolved()));
    expect(
      await resolvePersonalFinancialComparisonSelection(3, context(), signal()),
    ).toEqual(resolved());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl()).toContain("/saved-comparison/resolve");
    const init = fetchMock.mock.calls[0]![1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      ...context(),
      expectedVersion: 3,
    });
    expect(new Headers(init.headers).has("X-Research-Cockpit-Intent")).toBe(
      false,
    );
    expect(
      new Headers(init.headers).has("X-Research-Cockpit-Idempotency-Key"),
    ).toBe(false);
  });
  it.each([
    { catalogSnapshotSha256: sha("b") },
    { watchlistVersion: 8 },
    { savedSelectionVersion: 4 },
    { schemaVersion: "2.0.0" },
    { members: [member(1)] },
    { members: [member(1), member(1)] },
    { members: [member(1), { ...member(2), cik: member(1).cik }] },
    { prices: [] },
  ])(
    "rejects a changed binding or malformed resolution %j",
    async (changed) => {
      fetchMock.mockResolvedValueOnce(json({ ...resolved(), ...changed }));
      await expect(
        resolvePersonalFinancialComparisonSelection(3, context(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );
  it("does not let a caller change pending resolution bindings", async () => {
    const binding = context();
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = resolvePersonalFinancialComparisonSelection(
      3,
      binding,
      signal(),
    );
    Object.assign(binding, { watchlistVersion: 8 });
    finish(json(resolved()));
    expect(await pending).toEqual(resolved());
  });
  it("rejects invalid or result-bearing definitions before making a request", async () => {
    const withExtra = { ...payload(), prices: ["never-store"] };
    const withExtraMember = {
      ...payload(),
      selection: {
        ...payload().selection!,
        members: [{ ...member(1), metrics: {} }, member(2)],
      },
    };
    const sparse: PersonalSecurityMasterScreenRowDto[] =
      new Array<PersonalSecurityMasterScreenRowDto>(2);
    sparse[0] = member(1);
    for (const candidate of [
      withExtra,
      withExtraMember,
      {
        schemaVersion: 1,
        selection: { ...payload().selection!, members: sparse },
      },
    ]) {
      await expect(
        savePersonalFinancialComparisonSelection(
          3,
          candidate as PersonalFinancialComparisonSelectionPayloadDto,
          context(),
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    await expect(
      savePersonalFinancialComparisonSelection(3, payload(), null, signal()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      savePersonalFinancialComparisonSelection(
        3,
        { schemaVersion: 1, selection: null },
        context(),
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      savePersonalFinancialComparisonSelection(
        Number.MAX_SAFE_INTEGER,
        payload(),
        context(),
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      savePersonalFinancialComparisonSelection(
        3,
        payload(),
        { ...context(), catalogSnapshotSha256: sha("b") },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      resolvePersonalFinancialComparisonSelection(0, context(), signal()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    [401, "session_unavailable"],
    [403, "session_unavailable"],
    [404, "not_covered"],
    [409, "conflict"],
    [429, "rate_limited"],
    [500, "unavailable"],
  ] as const)(
    "sanitizes status %i without exposing server text",
    async (status, code) => {
      fetchMock.mockResolvedValueOnce(
        json({ detail: "private server detail" }, status),
      );
      const failure = await resolvePersonalFinancialComparisonSelection(
        3,
        context(),
        signal(),
      ).catch((error: unknown) => error);
      expect(failure).toMatchObject({
        code,
        message: "The personal workspace request was not accepted.",
      });
    },
  );
  it("does not forward malformed JSON, retry aborted requests or mutate caller data", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    await expect(
      fetchPersonalFinancialComparisonSelection(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
    const aborted = new DOMException("Aborted", "AbortError"),
      controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(aborted);
    await expect(
      resolvePersonalFinancialComparisonSelection(
        3,
        context(),
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1]!.signal).toBe(controller.signal);
  });
  it("fails closed when a mutation idempotency key is unavailable", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("unavailable");
      },
    });
    await expect(
      savePersonalFinancialComparisonSelection(
        3,
        payload(),
        context(),
        signal(),
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("compares all identity fields and saved order, including issuer and CIK", () => {
    const original = [member(2), member(1)];
    expect(
      samePersonalFinancialComparisonMembers(
        original,
        structuredClone(original),
      ),
    ).toBe(true);
    expect(
      samePersonalFinancialComparisonMembers(original, [member(1), member(2)]),
    ).toBe(false);
    for (const key of Object.keys(
      member(1),
    ) as (keyof PersonalSecurityMasterScreenRowDto)[]) {
      const changed = structuredClone(original);
      Object.assign(changed[0]!, { [key]: "changed" });
      expect(samePersonalFinancialComparisonMembers(original, changed)).toBe(
        false,
      );
    }
  });
});
