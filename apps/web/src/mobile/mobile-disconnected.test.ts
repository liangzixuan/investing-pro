import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("bundled mobile without a configured computer", () => {
  it("refuses session, readiness, catalog and watchlist IO before fetch", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const account = await import("../lib/personal-api");
    const workspace = await import("../lib/personal-workspace-api");
    const signal = new AbortController().signal;
    expect(await account.fetchOwnerSession(signal)).toBe(false);
    expect(await account.fetchLocalWorkspaceAccess(signal)).toBe(false);
    expect(await account.fetchPersonalFilingReadiness(signal)).toBe(false);
    expect(
      await account.loginOwnerSession(
        "invented-user",
        "invented-password",
        signal,
      ),
    ).toEqual({ status: "unavailable" });
    await expect(
      workspace.fetchPersonalSecurityMasterStatus(signal),
    ).rejects.toThrow();
    await expect(
      workspace.fetchMainPersonalWatchlist(signal),
    ).rejects.toThrow();
    await expect(
      workspace.saveMainPersonalWatchlist(
        0,
        workspace.createEmptyPersonalWatchlist(`sha256:${"1".repeat(64)}`),
        signal,
      ),
    ).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  });
});
