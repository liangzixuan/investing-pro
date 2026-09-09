import type { PersonalPortfolioPayload } from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPersonalPortfolio,
  savePersonalPortfolio,
  type PersonalPortfolioMutationReceipt,
  type PersonalPortfolioRecord,
} from "./personal-portfolio-api";

const fetchMock = vi.fn<typeof fetch>();
const key = "portfolio-mutation-key";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("personal portfolio transport", () => {
  it("reads the private loopback route and returns an immutable versioned snapshot", async () => {
    fetchMock.mockResolvedValue(json(record(), 200, '"v1"'));
    const signal = new AbortController().signal;
    const loaded = await fetchPersonalPortfolio(signal);
    expect(loaded).toEqual(record());
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded?.payload.holdings[0]?.identity)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "http://127.0.0.1:3100/v1/personal-filing/workspace/portfolio/main",
      ),
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
        cache: "no-store",
        credentials: "include",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it("returns null only for a missing portfolio and preserves readable old catalog snapshots", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await fetchPersonalPortfolio()).toBeNull();
    const old = {
      ...record(),
      payload: { ...payload(), snapshotSha256: `sha256:${"b".repeat(64)}` },
    };
    fetchMock.mockResolvedValueOnce(json(old, 200, '"v1"'));
    expect(await fetchPersonalPortfolio()).toEqual(old);
  });

  it("creates and updates with the caller's retry key, intent and exact CAS header", async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValueOnce(json(receipt(), 201, '"v1"'));
    expect(await savePersonalPortfolio(payload(), null, key, signal)).toEqual(
      receipt(),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ payload: payload() }),
        signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "If-None-Match": "*",
          "X-Research-Cockpit-Idempotency-Key": key,
          "X-Research-Cockpit-Intent": "personal-vault-create",
        },
        cache: "no-store",
        credentials: "include",
        redirect: "error",
        referrerPolicy: "no-referrer",
      }),
    );
    const replay = { ...receipt(), replayed: true };
    fetchMock.mockResolvedValueOnce(json(replay, 201, '"v1"'));
    expect(await savePersonalPortfolio(payload(), null, key)).toEqual(replay);
    const updated = { ...receipt(), version: 2 };
    fetchMock.mockResolvedValueOnce(json(updated, 200, '"v2"'));
    expect(
      await savePersonalPortfolio(payload(), 1, "portfolio-update-key"),
    ).toEqual(updated);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "If-Match": '"v1"',
          "X-Research-Cockpit-Idempotency-Key": "portfolio-update-key",
          "X-Research-Cockpit-Intent": "personal-vault-update",
        },
      }),
    );
  });

  it("rejects invalid mutation inputs before network", async () => {
    for (const version of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, Number.NaN]) {
      await expect(
        savePersonalPortfolio(payload(), version, key),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    for (const invalidKey of [
      "",
      "short",
      "x".repeat(129),
      "private key with spaces",
    ]) {
      await expect(
        savePersonalPortfolio(payload(), null, invalidKey),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    for (const invalid of [
      { ...payload(), cashUsd: "-1" },
      {
        ...payload(),
        holdings: [{ ...payload().holdings[0]!, confirmedOn: "9999-12-31" }],
      },
      { ...payload(), rawQuote: "private-canary" },
    ]) {
      await expect(
        savePersonalPortfolio(invalid, null, key),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown field", { ...record(), rawQuote: "private-canary" }],
    ["wrong profile", { ...record(), profile: "demo" }],
    ["wrong record kind", { ...record(), kind: "watchlist" }],
    ["wrong id", { ...record(), id: "another" }],
    ["bad version", { ...record(), version: 0 }],
    ["bad digest", { ...record(), payloadSha256: "not-a-digest" }],
    ["bad date", { ...record(), createdAt: "2020-02-30T00:00:00.000Z" }],
    ["reversed dates", { ...record(), createdAt: "2020-01-02T00:00:00.000Z" }],
    ["bad payload", { ...record(), payload: { ...payload(), cashUsd: "-1" } }],
  ])("rejects malformed loaded records: %s", async (_label, value) => {
    fetchMock.mockResolvedValue(json(value, 200, '"v1"'));
    await expect(fetchPersonalPortfolio()).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([null, 'W/"v1"', '"v2"', '"v1", "v1"'])(
    "rejects missing or mismatched ETag %s",
    async (etag) => {
      fetchMock.mockResolvedValueOnce(json(record(), 200, etag));
      await expect(fetchPersonalPortfolio()).rejects.toMatchObject({
        code: "invalid_response",
      });
      fetchMock.mockResolvedValueOnce(json(receipt(), 201, etag));
      await expect(
        savePersonalPortfolio(payload(), null, key),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it.each([
    ["wrong kind", { ...receipt(), kind: "watchlist" }],
    ["wrong id", { ...receipt(), id: "other" }],
    ["wrong operation", { ...receipt(), operation: "delete" }],
    ["wrong version", { ...receipt(), version: 2 }],
    ["extra field", { ...receipt(), payload: payload() }],
    ["bad replay", { ...receipt(), replayed: "yes" }],
    ["bad digest", { ...receipt(), digestSha256: "not-a-digest" }],
    ["bad instant", { ...receipt(), committedAt: "not-a-date" }],
  ])("rejects malformed mutation receipts: %s", async (_label, value) => {
    fetchMock.mockResolvedValue(json(value, 201, '"v1"'));
    await expect(
      savePersonalPortfolio(payload(), null, key),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects wrong success statuses, non-JSON media and malformed JSON", async () => {
    fetchMock.mockResolvedValueOnce(json(record(), 201, '"v1"'));
    await expect(fetchPersonalPortfolio()).rejects.toMatchObject({
      code: "invalid_response",
    });
    fetchMock.mockResolvedValueOnce(json(receipt(), 200, '"v1"'));
    await expect(
      savePersonalPortfolio(payload(), null, key),
    ).rejects.toMatchObject({ code: "invalid_response" });
    for (const response of [
      new Response("{}", { headers: { "content-type": "text/html" } }),
      new Response("{ private-canary", {
        headers: { "content-type": "application/json" },
      }),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(fetchPersonalPortfolio()).rejects.toMatchObject({
        code: "invalid_response",
      });
    }
  });

  it.each([
    [400, "invalid_request"],
    [403, "session_unavailable"],
    [409, "conflict"],
    [500, "unavailable"],
  ])(
    "maps status %s without parsing private error bodies",
    async (status, code) => {
      fetchMock.mockResolvedValueOnce(
        new Response("private-canary", { status: Number(status) }),
      );
      await expect(fetchPersonalPortfolio()).rejects.toMatchObject({ code });
      fetchMock.mockResolvedValueOnce(
        new Response("private-canary", { status: Number(status) }),
      );
      await expect(
        savePersonalPortfolio(payload(), null, key),
      ).rejects.toMatchObject({ code });
    },
  );

  it("preserves cancellation and refuses a controlling service worker", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(new Error("private-canary"));
    await expect(
      fetchPersonalPortfolio(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    fetchMock.mockReset();
    vi.stubGlobal("navigator", { serviceWorker: { controller: {} } });
    await expect(fetchPersonalPortfolio()).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function payload(): PersonalPortfolioPayload {
  return {
    schemaVersion: 1,
    name: "My Portfolio",
    currency: "USD",
    snapshotSha256: `sha256:${"a".repeat(64)}`,
    cashUsd: null,
    holdings: [
      {
        identity: {
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "issuer-one",
          issuerName: "Example Corp",
          listingId: "listing-one",
          securityId: "security-one",
          securityName: "Example common",
          shareClassId: "class-one",
          shareClassName: "Common",
          symbol: "EXAM",
        },
        shares: "0.000001",
        totalCostBasisUsd: "0.01",
        confirmedOn: "2020-01-01",
      },
    ],
  };
}

function record(): PersonalPortfolioRecord {
  return {
    profile: "personal_single_user_local_vault",
    kind: "portfolio",
    id: "main",
    version: 1,
    payload: payload(),
    payloadSha256: "a".repeat(64),
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

function receipt(): PersonalPortfolioMutationReceipt {
  return {
    profile: "personal_single_user_local_vault",
    operation: "put",
    kind: "portfolio",
    id: "main",
    version: 1,
    digestSha256: "a".repeat(64),
    committedAt: "2020-01-01T00:00:00.000Z",
    replayed: false,
  };
}

function json(value: unknown, status: number, etag: string | null): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(etag === null ? {} : { ETag: etag }),
    },
  });
}
