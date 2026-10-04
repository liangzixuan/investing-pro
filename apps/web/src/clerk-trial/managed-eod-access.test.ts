import { afterEach, describe, expect, it, vi } from "vitest";
import { TrialApiError } from "./api";
import {
  ManagedCatalogChangedError,
  ManagedEodCooldownError,
  ManagedEodHistoryError,
  type ManagedApi,
} from "./managed-api";
import {
  ManagedEodAccess,
  isManagedEodAuthenticationError,
  isManagedEodTransientError,
} from "./managed-eod-access";
import { eodRequest, eodResponse, eodSelection } from "./eod-history-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const signal = () => new AbortController().signal;
afterEach(() => vi.useRealTimers());

describe("shared managed EOD access", () => {
  it("waits for an explicit request and joins its captured identity", async () => {
    const held = deferred<ReturnType<typeof eodResponse>>();
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockReturnValue(held.promise);
    const access = new ManagedEodAccess(read);
    const selection = { ...eodSelection, listing: { ...eodSelection.listing } };
    expect(read).not.toHaveBeenCalled();
    const requestSignal = signal();
    const request = access.request(selection, requestSignal);
    selection.listing.shareClassId = "changed-after-request";
    const response = eodResponse();
    held.resolve(response);
    expect(await request).toBe(response);
    expect(read).toHaveBeenCalledExactlyOnceWith(eodRequest(), requestSignal);
  });

  it.each(["catalog", "share class"])(
    "rejects a response from a different %s",
    async (field) => {
      const response = eodResponse();
      const read = vi.fn<ManagedApi["eodHistory"]>().mockResolvedValue(
        field === "catalog"
          ? { ...response, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` }
          : {
              ...response,
              security: { ...response.security, shareClassId: "other-class" },
            },
      );
      await expect(
        new ManagedEodAccess(read).request(eodSelection, signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("shares checked cooldown across callers until a new explicit request after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00.000Z"));
    const nextAllowedAt = "2026-10-04T00:01:00.000Z";
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockRejectedValueOnce(new ManagedEodCooldownError(nextAllowedAt))
      .mockResolvedValueOnce(eodResponse());
    const access = new ManagedEodAccess(read);
    await expect(access.request(eodSelection, signal())).rejects.toMatchObject({
      nextAllowedAt,
    });
    expect(access.getNextAllowedAt()).toBe(nextAllowedAt);
    await expect(access.request(eodSelection, signal())).rejects.toMatchObject({
      nextAllowedAt,
    });
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60000);
    expect(access.getNextAllowedAt()).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    await access.request(eodSelection, signal());
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    { field: "rows", value: [{ date: "2026-09-18", close: "NaN" }] },
    { field: "currency", value: "EUR" },
    {
      field: "window",
      value: { startDate: "2026-01-01", endDate: "2026-09-20" },
    },
  ])(
    "rejects malformed $field despite a matching listing",
    async ({ field, value }) => {
      const read = vi.fn<ManagedApi["eodHistory"]>().mockResolvedValue({
        ...eodResponse(),
        [field]: value,
      });
      await expect(
        new ManagedEodAccess(read).request(eodSelection, signal()),
      ).rejects.toMatchObject({ code: "invalid_response" });
    },
  );

  it("does not dispatch an already aborted request", async () => {
    const read = vi.fn<ManagedApi["eodHistory"]>();
    const operation = new AbortController();
    operation.abort();
    await expect(
      new ManagedEodAccess(read).request(eodSelection, operation.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["success", "cooldown", "authentication"])(
    "discards late %s after abort without publishing shared state",
    async (settlement) => {
      const held = deferred<ReturnType<typeof eodResponse>>();
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockReturnValueOnce(held.promise)
        .mockResolvedValueOnce(eodResponse());
      const access = new ManagedEodAccess(read);
      const operation = new AbortController();
      const request = access.request(eodSelection, operation.signal);
      operation.abort();
      if (settlement === "success") held.resolve(eodResponse());
      else
        held.reject(
          settlement === "cooldown"
            ? new ManagedEodCooldownError("2099-10-04T00:01:00.000Z")
            : new TrialApiError("unauthenticated"),
        );
      await expect(request).rejects.toMatchObject({ name: "AbortError" });
      expect(access.getNextAllowedAt()).toBeNull();
      await access.request(eodSelection, signal());
      expect(read).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["not-a-time", "2026-02-30T00:00:00.000Z"])(
    "rejects malformed cooldown %s without blocking another caller",
    async (nextAllowedAt) => {
      const read = vi
        .fn<ManagedApi["eodHistory"]>()
        .mockRejectedValueOnce(new ManagedEodCooldownError(nextAllowedAt))
        .mockResolvedValueOnce(eodResponse());
      const access = new ManagedEodAccess(read);
      await expect(
        access.request(eodSelection, signal()),
      ).rejects.toMatchObject({
        code: "invalid_response",
      });
      expect(access.getNextAllowedAt()).toBeNull();
      await access.request(eodSelection, signal());
      expect(read).toHaveBeenCalledTimes(2);
    },
  );

  it("does not shorten a checked cooldown when another admitted read finishes later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00.000Z"));
    const first = deferred<ReturnType<typeof eodResponse>>();
    const second = deferred<ReturnType<typeof eodResponse>>();
    const read = vi
      .fn<ManagedApi["eodHistory"]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const access = new ManagedEodAccess(read);
    const a = access.request(eodSelection, signal());
    const b = access.request(eodSelection, signal());
    second.reject(new ManagedEodCooldownError("2026-10-04T00:02:00.000Z"));
    await expect(b).rejects.toMatchObject({
      nextAllowedAt: "2026-10-04T00:02:00.000Z",
    });
    first.reject(new ManagedEodCooldownError("2026-10-04T00:01:00.000Z"));
    await expect(a).rejects.toMatchObject({
      nextAllowedAt: "2026-10-04T00:02:00.000Z",
    });
    expect(access.getNextAllowedAt()).toBe("2026-10-04T00:02:00.000Z");
  });

  it.each([
    {
      error: new TrialApiError("unauthenticated"),
      auth: true,
      transient: false,
    },
    { error: new TrialApiError("access_denied"), auth: true, transient: false },
    { error: new TrialApiError("origin_denied"), auth: true, transient: false },
    { error: new TrialApiError("unavailable"), auth: false, transient: true },
    {
      error: new TrialApiError("invalid_response"),
      auth: false,
      transient: false,
    },
    { error: new ManagedCatalogChangedError(), auth: false, transient: false },
    {
      error: new ManagedEodHistoryError("request_timeout"),
      auth: false,
      transient: true,
    },
    {
      error: new ManagedEodHistoryError("unavailable"),
      auth: false,
      transient: true,
    },
    {
      error: new ManagedEodHistoryError("source_rate_limited"),
      auth: false,
      transient: true,
    },
    {
      error: new ManagedEodHistoryError("unsupported_listing"),
      auth: false,
      transient: false,
    },
    {
      error: new ManagedEodHistoryError("not_configured"),
      auth: false,
      transient: false,
    },
    { error: new Error("unknown"), auth: false, transient: false },
  ])("preserves and classifies $error", async ({ error, auth, transient }) => {
    const read = vi.fn<ManagedApi["eodHistory"]>().mockRejectedValue(error);
    const access = new ManagedEodAccess(read);
    await expect(access.request(eodSelection, signal())).rejects.toBe(error);
    expect(access.getNextAllowedAt()).toBeNull();
    expect(isManagedEodAuthenticationError(error)).toBe(auth);
    expect(isManagedEodTransientError(error)).toBe(transient);
  });
});
