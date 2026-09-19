import type {
  PersonalSavedDcfAssumptionsDto,
  PersonalSavedDcfBindingDto,
  PersonalSavedDcfEntryDto,
  PersonalSavedDcfIdentityDto,
  PersonalSavedDcfPayloadDto,
  PersonalSavedDcfPutRequestDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPersonalSavedDcfAssumptions,
  putPersonalSavedDcfAssumptions,
  resolvePersonalSavedDcfAssumptions,
  samePersonalSavedDcfAssumptions,
  samePersonalSavedDcfEntry,
  samePersonalSavedDcfIdentity,
} from "./personal-saved-dcf-assumptions-api";

const fetchMock = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
const sha = (char: string): `sha256:${string}` => `sha256:${char.repeat(64)}`;
const context = (): PersonalSavedDcfBindingDto => ({
  catalogSnapshotSha256: sha("a"),
  watchlistVersion: 7,
});
const identity = (n = 1): PersonalSavedDcfIdentityDto => ({
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
const assumptions = (): PersonalSavedDcfAssumptionsDto => ({
  forecastYears: 7,
  taxShieldRatePercent: "21.0000",
  waccPercent: "10.0000",
  terminalGrowthPercent: "2.0000",
  scenarios: {
    conservative: { annualFcfProxyGrowthPercent: "-2.0000" },
    base: { annualFcfProxyGrowthPercent: "4.0000" },
    expansion: { annualFcfProxyGrowthPercent: "9.0000" },
  },
});
const entry = (n = 1): PersonalSavedDcfEntryDto => ({
  identity: identity(n),
  createdAgainstCatalogSnapshotSha256: sha("a"),
  modelVersion: "1.0.0",
  assumptions: assumptions(),
});
const historical = (): PersonalSavedDcfEntryDto => ({
  ...entry(2),
  createdAgainstCatalogSnapshotSha256: sha("d"),
  modelVersion: "2.1.0",
  assumptions: { ...assumptions(), forecastYears: 12, waccPercent: "40.0000" },
});
const payload = (): PersonalSavedDcfPayloadDto => ({
  schemaVersion: 1,
  entries: [historical(), entry()],
});
const saveRequest = (): PersonalSavedDcfPutRequestDto => ({
  operation: "save",
  listingId: identity().listingId,
  payload: payload(),
  context: context(),
});
const record = () => ({
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
  id: "personal-dcf-assumptions",
  kind: "settings",
  profile: "personal_single_user_local_vault",
  payload: payload(),
  payloadSha256: "b".repeat(64),
  version: 3,
});
const receipt = (version: number) => ({
  committedAt: "2026-09-02T00:00:00.000Z",
  digestSha256: "c".repeat(64),
  id: "personal-dcf-assumptions",
  kind: "settings",
  operation: "put",
  profile: "personal_single_user_local_vault",
  replayed: false,
  version,
});
const resolved = () => ({
  schemaVersion: "1.0.0",
  ...context(),
  savedAssumptionsVersion: 3,
  entry: { ...entry(), createdAgainstCatalogSnapshotSha256: sha("d") },
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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("saved DCF client boundaries", () => {
  it("reads supported and unsupported entries without migration, preserving full identities and saved order", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(json(record()));
    expect(await fetchPersonalSavedDcfAssumptions(controller.signal)).toEqual({
      version: 3,
      payload: payload(),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl()).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/workspace/dcf-assumptions",
    );
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init).toMatchObject({
      method: "GET",
      cache: "no-store",
      credentials: "include",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    expect(init.body).toBeUndefined();
  });

  it("distinguishes missing settings from an empty versioned collection", async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        json({ ...record(), payload: { schemaVersion: 1, entries: [] } }),
      );
    expect(await fetchPersonalSavedDcfAssumptions(signal())).toBeNull();
    expect(await fetchPersonalSavedDcfAssumptions(signal())).toEqual({
      version: 3,
      payload: { schemaVersion: 1, entries: [] },
    });
  });

  it.each([
    { id: "financial-comparison-selection" },
    { kind: "watchlist" },
    { profile: "other" },
    { version: 0 },
    { version: Number.MAX_SAFE_INTEGER + 1 },
    { createdAt: "2026-02-30T00:00:00.000Z" },
    { updatedAt: "2026-08-01T00:00:00.000Z" },
    { payloadSha256: "bad" },
    { quote: {} },
    { payload: { schemaVersion: 2, entries: [] } },
    {
      payload: {
        schemaVersion: 1,
        entries: [
          {
            ...entry(),
            assumptions: { ...assumptions(), waccPercent: "2.0000" },
          },
        ],
      },
    },
  ])("rejects a malformed or different settings record %j", async (change) => {
    fetchMock.mockResolvedValueOnce(json({ ...record(), ...change }));
    await expect(
      fetchPersonalSavedDcfAssumptions(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([null, '"v2"', 'W/"v3"'])("rejects read ETag %s", async (etag) => {
    fetchMock.mockResolvedValueOnce(json(record(), 200, etag));
    await expect(
      fetchPersonalSavedDcfAssumptions(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects an otherwise valid read envelope with an unexpected success status", async () => {
    fetchMock.mockResolvedValueOnce(json(record(), 201));
    await expect(
      fetchPersonalSavedDcfAssumptions(signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([0, 3])(
    "submits the full collection with correct create/update preconditions at version%i",
    async (version) => {
      const request =
        version === 0
          ? {
              ...saveRequest(),
              payload: { schemaVersion: 1 as const, entries: [entry()] },
            }
          : saveRequest();
      fetchMock.mockResolvedValueOnce(
        json(
          receipt(version + 1),
          version === 0 ? 201 : 200,
          `"v${version + 1}"`,
        ),
      );
      const controller = new AbortController();
      expect(
        await putPersonalSavedDcfAssumptions(
          version,
          request,
          controller.signal,
        ),
      ).toEqual({ version: version + 1, payload: request.payload });
      const init = fetchMock.mock.calls[0]![1]!;
      expect(JSON.parse(init.body as string)).toEqual(request);
      expect(init.method).toBe("POST");
      expect(init.signal).toBe(controller.signal);
      const headers = new Headers(init.headers);
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("X-Research-Cockpit-Intent")).toBe(
        version === 0 ? "personal-vault-create" : "personal-vault-update",
      );
      expect(headers.get("X-Research-Cockpit-Idempotency-Key")).toBe(
        "saved-dcf-11111111-2222-4333-8444-555555555555",
      );
      expect(headers.get(version === 0 ? "If-None-Match" : "If-Match")).toBe(
        version === 0 ? "*" : '"v3"',
      );
      expect(headers.has(version === 0 ? "If-Match" : "If-None-Match")).toBe(
        false,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("clears an unsupported orphan without current admission and preserves unrelated entries and next version", async () => {
    const request: PersonalSavedDcfPutRequestDto = {
      operation: "clear",
      listingId: identity(2).listingId,
      context: null,
      payload: { schemaVersion: 1, entries: [entry()] },
    };
    fetchMock
      .mockResolvedValueOnce(json(receipt(4), 200, '"v4"'))
      .mockResolvedValueOnce(json(receipt(5), 200, '"v5"'));
    const cleared = await putPersonalSavedDcfAssumptions(3, request, signal());
    expect(cleared).toEqual({ version: 4, payload: request.payload });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual(
      request,
    );
    await putPersonalSavedDcfAssumptions(
      cleared.version,
      {
        operation: "clear",
        listingId: identity().listingId,
        context: null,
        payload: { schemaVersion: 1, entries: [] },
      },
      signal(),
    );
    expect(
      new Headers(fetchMock.mock.calls[1]![1]!.headers).get("If-Match"),
    ).toBe('"v4"');
    expect(
      fetchMock.mock.calls.every(
        ([url]) => url instanceof URL && !url.pathname.endsWith("/resolve"),
      ),
    ).toBe(true);
  });

  it("captures the whole submitted payload and context before a deferred save settles", async () => {
    const request = structuredClone(saveRequest());
    const captured = structuredClone(request);
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = putPersonalSavedDcfAssumptions(3, request, signal());
    Object.assign(request.payload.entries[0]!.identity, {
      issuerName: "Changed after submission",
    });
    Object.assign(request.payload.entries[1]!.assumptions, {
      waccPercent: "15.0000",
    });
    Object.assign(request.payload, { entries: [] });
    Object.assign(request.context!, {
      watchlistVersion: 99,
      catalogSnapshotSha256: sha("e"),
    });
    finish(json(receipt(4), 200, '"v4"'));
    const result = await pending;
    expect(result).toEqual({ version: 4, payload: captured.payload });
    expect(result.payload).not.toBe(request.payload);
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual(
      captured,
    );
  });

  it.each([
    { id: "other" },
    { kind: "watchlist" },
    { operation: "delete" },
    { profile: "other" },
    { version: 3 },
    { version: 5 },
    { digestSha256: "bad" },
    { replayed: "true" },
    { committedAt: "2026-02-30T00:00:00.000Z" },
    { payload: payload() },
  ])("rejects a mismatched mutation receipt %j", async (change) => {
    fetchMock.mockResolvedValueOnce(
      json({ ...receipt(4), ...change }, 200, '"v4"'),
    );
    await expect(
      putPersonalSavedDcfAssumptions(3, saveRequest(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("requires exact success status and ETag, and admits a valid replay receipt", async () => {
    fetchMock
      .mockResolvedValueOnce(json(receipt(1), 200, '"v1"'))
      .mockResolvedValueOnce(json(receipt(4), 201, '"v4"'))
      .mockResolvedValueOnce(json(receipt(4), 200, '"v3"'))
      .mockResolvedValueOnce(json(receipt(4), 200, null))
      .mockResolvedValueOnce(
        json({ ...receipt(4), replayed: true }, 200, '"v4"'),
      );
    for (const version of [0, 3, 3, 3])
      await expect(
        putPersonalSavedDcfAssumptions(version, saveRequest(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    expect(
      await putPersonalSavedDcfAssumptions(3, saveRequest(), signal()),
    ).toEqual({ version: 4, payload: payload() });
  });

  it("resolves a current binding with historical save provenance and no mutation intent", async () => {
    fetchMock.mockResolvedValueOnce(json(resolved(), 200, null));
    expect(
      await resolvePersonalSavedDcfAssumptions(
        3,
        identity(),
        context(),
        signal(),
      ),
    ).toEqual(resolved());
    expect(requestedUrl()).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/workspace/dcf-assumptions/resolve",
    );
    const init = fetchMock.mock.calls[0]![1]!;
    expect(JSON.parse(init.body as string)).toEqual({
      ...context(),
      identity: identity(),
      expectedVersion: 3,
    });
    const headers = new Headers(init.headers);
    expect(headers.has("X-Research-Cockpit-Intent")).toBe(false);
    expect(headers.has("X-Research-Cockpit-Idempotency-Key")).toBe(false);
    expect(headers.has("If-Match")).toBe(false);
  });

  it.each([
    ["country", "CA"],
    ["exchangeMic", "XNYS"],
    ["instrumentType", "adr"],
    ["issuerId", "issuer-other"],
    ["issuerName", "Other issuer"],
    ["listingId", "listing-other"],
    ["securityId", "security-other"],
    ["securityName", "Other security"],
    ["shareClassId", "class-other"],
    ["shareClassName", "Other class"],
    ["symbol", "OTHER"],
  ] as const)(
    "rejects changed resolved identity field%s",
    async (field, value) => {
      const response = resolved();
      Object.assign(response.entry.identity, { [field]: value });
      fetchMock.mockResolvedValueOnce(json(response));
      await expect(
        resolvePersonalSavedDcfAssumptions(3, identity(), context(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    { catalogSnapshotSha256: sha("b") },
    { watchlistVersion: 8 },
    { savedAssumptionsVersion: 4 },
    { schemaVersion: "2.0.0" },
    { entry: historical() },
    { results: [] },
  ])(
    "rejects changed resolution context or unsupported output %j",
    async (change) => {
      fetchMock.mockResolvedValueOnce(json({ ...resolved(), ...change }));
      await expect(
        resolvePersonalSavedDcfAssumptions(3, identity(), context(), signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("captures identity and binding for deferred resolution and rejects wrong successful status", async () => {
    const requestedIdentity = identity(),
      requestedContext = context();
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = resolvePersonalSavedDcfAssumptions(
      3,
      requestedIdentity,
      requestedContext,
      signal(),
    );
    Object.assign(requestedIdentity, { securityId: "changed" });
    Object.assign(requestedContext, { watchlistVersion: 999 });
    finish(json(resolved()));
    expect(await pending).toEqual(resolved());
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      ...context(),
      identity: identity(),
      expectedVersion: 3,
    });
    fetchMock.mockResolvedValueOnce(json(resolved(), 201));
    await expect(
      resolvePersonalSavedDcfAssumptions(3, identity(), context(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects invalid preconditions and result-bearing or mismatched write targets before I/O", async () => {
    for (const version of [-1, 0.5, Number.MAX_SAFE_INTEGER, Number.NaN])
      await expect(
        putPersonalSavedDcfAssumptions(version, saveRequest(), signal()),
      ).rejects.toMatchObject({ code: "invalid_request" });
    const invalid = [
      { ...saveRequest(), payload: { ...payload(), prices: [] } },
      { ...saveRequest(), listingId: "not-in-payload" },
      {
        ...saveRequest(),
        context: { ...context(), catalogSnapshotSha256: sha("e") },
      },
      {
        ...saveRequest(),
        payload: {
          schemaVersion: 1,
          entries: [{ ...entry(), modelVersion: "2.0.0" }],
        },
      },
      {
        operation: "clear",
        listingId: identity().listingId,
        context: null,
        payload: payload(),
      },
      {
        operation: "clear",
        listingId: identity().listingId,
        context: context(),
        payload: { schemaVersion: 1, entries: [] },
      },
    ];
    for (const request of invalid)
      await expect(
        putPersonalSavedDcfAssumptions(
          3,
          request as PersonalSavedDcfPutRequestDto,
          signal(),
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      putPersonalSavedDcfAssumptions(
        0,
        {
          operation: "clear",
          listingId: identity().listingId,
          context: null,
          payload: { schemaVersion: 1, entries: [] },
        },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      resolvePersonalSavedDcfAssumptions(0, identity(), context(), signal()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      resolvePersonalSavedDcfAssumptions(
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
    "sanitizes error status%i for save/resolve without retry",
    async (status, code) => {
      for (const operation of [
        () => putPersonalSavedDcfAssumptions(3, saveRequest(), signal()),
        () =>
          resolvePersonalSavedDcfAssumptions(
            3,
            identity(),
            context(),
            signal(),
          ),
      ]) {
        fetchMock.mockResolvedValueOnce(
          json(
            { detail: "Private server detail must not reach the UI" },
            status,
          ),
        );
        await expect(operation()).rejects.toMatchObject({
          code,
          message: "The personal workspace request was not accepted.",
        });
      }
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects malformed JSON in each success path and forwards cancellation without retry", async () => {
    const operations = [
      (abort: AbortSignal) => fetchPersonalSavedDcfAssumptions(abort),
      (abort: AbortSignal) =>
        putPersonalSavedDcfAssumptions(3, saveRequest(), abort),
      (abort: AbortSignal) =>
        resolvePersonalSavedDcfAssumptions(3, identity(), context(), abort),
    ];
    for (const operation of operations) {
      fetchMock.mockResolvedValueOnce(
        new Response("not JSON", { status: 200 }),
      );
      await expect(operation(signal())).rejects.toMatchObject({
        code: "invalid_response",
      });
      const controller = new AbortController();
      fetchMock.mockImplementationOnce(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init!.signal!.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      );
      const pending = operation(controller.signal);
      controller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(fetchMock.mock.calls.at(-1)![1]!.signal).toBe(controller.signal);
    }
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("fails closed without idempotency randomness and sanitizes transport failure", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("private detail");
      },
    });
    await expect(
      putPersonalSavedDcfAssumptions(3, saveRequest(), signal()),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRejectedValueOnce(new Error("transport detail"));
    await expect(
      fetchPersonalSavedDcfAssumptions(signal()),
    ).rejects.toMatchObject({
      code: "unavailable",
      message: "The personal workspace request was not accepted.",
    });
  });

  it("compares every identity/input/provenance field without treating source values as assumptions", () => {
    expect(
      samePersonalSavedDcfIdentity(identity(), structuredClone(identity())),
    ).toBe(true);
    for (const key of Object.keys(
      identity(),
    ) as (keyof PersonalSavedDcfIdentityDto)[]) {
      expect(
        samePersonalSavedDcfIdentity(identity(), {
          ...identity(),
          [key]: "changed",
        }),
      ).toBe(false);
    }
    expect(samePersonalSavedDcfEntry(entry(), structuredClone(entry()))).toBe(
      true,
    );
    for (const key of [
      "createdAgainstCatalogSnapshotSha256",
      "modelVersion",
    ] as const) {
      expect(
        samePersonalSavedDcfEntry(entry(), {
          ...entry(),
          [key]: key === "modelVersion" ? "2.0.0" : sha("d"),
        }),
      ).toBe(false);
    }
    for (const key of [
      "forecastYears",
      "taxShieldRatePercent",
      "waccPercent",
      "terminalGrowthPercent",
    ] as const) {
      const changed = {
        ...assumptions(),
        [key]: key === "forecastYears" ? 8 : "3.0000",
      };
      expect(samePersonalSavedDcfAssumptions(assumptions(), changed)).toBe(
        false,
      );
      expect(
        samePersonalSavedDcfEntry(entry(), {
          ...entry(),
          assumptions: changed,
        }),
      ).toBe(false);
    }
    for (const scenario of ["conservative", "base", "expansion"] as const) {
      const changed = assumptions();
      Object.assign(changed.scenarios[scenario], {
        annualFcfProxyGrowthPercent: "12.0000",
      });
      expect(samePersonalSavedDcfAssumptions(assumptions(), changed)).toBe(
        false,
      );
    }
  });
});
