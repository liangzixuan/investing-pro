import { afterEach, describe, expect, it, vi } from "vitest";
import { MANAGED_SEC_INTERIM_EVIDENCE_PATH } from "@research-cockpit/contracts";
import { buildInterimFixture } from "../../android-tests/managed-workspace/interim-report-packet";
import {
  createManagedApi,
  ManagedInterimReportError,
  ManagedCatalogChangedError,
  ManagedSecCooldownError,
} from "./managed-api";
import { isOwnedSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
import type { TrialSession } from "./session";
afterEach(() => vi.restoreAllMocks());
async function fixture() {
  const wire = await buildInterimFixture(),
    request = {
      schemaVersion: "1.0.0" as const,
      catalogSnapshotSha256: wire.catalogSnapshotSha256,
      listingId: wire.security.listingId,
      symbol: wire.security.symbol,
    };
  const session: TrialSession = {
    userId: "invented",
    sessionId: "invented",
    getToken: vi.fn().mockResolvedValue("invented-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn<typeof fetch>();
  return {
    wire,
    request,
    fetcher,
    api: createManagedApi("https://managed.example.invalid", session, fetcher),
    controller: new AbortController(),
  };
}
describe("managed explicit interim transport", () => {
  it("posts exactly the current v1 identity and admits an owned graph without another source", async () => {
    const f = await fixture();
    f.fetcher.mockResolvedValue(Response.json(f.wire));
    const result = await f.api.interimReport(f.request, f.controller.signal);
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect(f.fetcher.mock.calls[0]![0]).toBe(
      `https://managed.example.invalid${MANAGED_SEC_INTERIM_EVIDENCE_PATH}`,
    );
    expect(f.fetcher.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        Authorization: "Bearer invented-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(f.request),
    });
    expect(result).toEqual(f.wire);
    expect(isOwnedSecInterimCanonicalResponse(result)).toBe(true);
  });
  it.each([
    [408, "request_timeout"],
    [503, "not_configured"],
  ] as const)("keeps exact interim failure %s/%s", async (status, error) => {
    const f = await fixture();
    f.fetcher.mockResolvedValue(Response.json({ error }, { status }));
    await expect(
      f.api.interimReport(f.request, f.controller.signal),
    ).rejects.toEqual(new ManagedInterimReportError(error));
    expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it("retains catalog and shared SEC cooldown error semantics", async () => {
    const f = await fixture();
    f.fetcher.mockResolvedValueOnce(
      Response.json({ error: "catalog_changed" }, { status: 409 }),
    );
    await expect(
      f.api.interimReport(f.request, f.controller.signal),
    ).rejects.toBeInstanceOf(ManagedCatalogChangedError);
    f.fetcher.mockResolvedValueOnce(
      Response.json(
        { error: "rate_limited", nextAllowedAt: "2026-10-27T13:00:00.000Z" },
        { status: 429 },
      ),
    );
    await expect(
      f.api.interimReport(f.request, f.controller.signal),
    ).rejects.toBeInstanceOf(ManagedSecCooldownError);
  });
  it("refuses forged values and an oversized whole JSON without fallback or retry", async () => {
    const f = await fixture();
    f.fetcher.mockResolvedValueOnce(
      Response.json({
        ...f.wire,
        evidence: { ...f.wire.evidence, targetScan: null },
      }),
    );
    await expect(
      f.api.interimReport(f.request, f.controller.signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
    f.fetcher.mockResolvedValueOnce(
      new Response(" ".repeat(2097153), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      f.api.interimReport(f.request, f.controller.signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
  it("never dispatches for a rejected request or pre-aborted caller", async () => {
    const f = await fixture();
    await expect(
      f.api.interimReport({ ...f.request, symbol: "bad" }, f.controller.signal),
    ).rejects.toMatchObject({ code: "invalid_request" });
    f.controller.abort();
    await expect(
      f.api.interimReport(f.request, f.controller.signal),
    ).rejects.toMatchObject({ code: "aborted" });
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
