import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
  MANAGED_VALUATION_ASSUMPTIONS_LIMITS,
  MANAGED_VALUATION_ASSUMPTIONS_PATH,
  type ManagedValuationAssumptionsCommand,
} from "@research-cockpit/contracts";
import { createManagedApi } from "./managed-api";
import type { TrialSession } from "./session";

function fixture() {
  const session: TrialSession = {
    userId: "invented-user",
    sessionId: "invented-session",
    getToken: vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("invented-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn<typeof fetch>();
  const signal = new AbortController().signal;
  return {
    session,
    fetcher,
    signal,
    api: createManagedApi("https://managed.example.invalid", session, fetcher),
  };
}
const command: ManagedValuationAssumptionsCommand = {
  expectedVersion: 0,
  idempotencyKey: "invented-command-valuation-001",
  payload: EMPTY_VALUATION_ASSUMPTIONS_PAYLOAD,
};
afterEach(() => vi.useRealTimers());

describe("bounded valuation assumptions transport", () => {
  it("loads version zero explicitly and sends only the fixed authenticated GET", async () => {
    const { api, fetcher, signal } = fixture();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(
      Response.json({ version: 0, payload: command.payload }),
    );
    expect(await api.loadValuationAssumptions(signal)).toEqual({
      version: 0,
      payload: command.payload,
    });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `https://managed.example.invalid${MANAGED_VALUATION_ASSUMPTIONS_PATH}`,
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer invented-token" },
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
      }),
    );
  });
  it("captures a full command and admits only the original next-version receipt", async () => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValue(
      Response.json({ version: 1, payload: command.payload, replayed: true }),
    );
    const receipt = await api.saveValuationAssumptions(command, signal);
    expect(receipt).toEqual({
      version: 1,
      payload: command.payload,
      replayed: true,
    });
    expect(Object.isFrozen(receipt.payload.entries)).toBe(true);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(command),
      headers: {
        Authorization: "Bearer invented-token",
        "Content-Type": "application/json",
      },
    });
    fetcher.mockResolvedValue(
      Response.json({ version: 2, payload: command.payload, replayed: false }),
    );
    await expect(
      api.saveValuationAssumptions(command, signal),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [409, "conflict"],
    [409, "idempotency_conflict"],
    [503, "commit_unknown"],
  ] as const)(
    "keeps mutation error %s/%s for coordinator recovery",
    async (status, error) => {
      const { api, fetcher, signal } = fixture();
      fetcher.mockResolvedValue(Response.json({ error }, { status }));
      await expect(
        api.saveValuationAssumptions(command, signal),
      ).rejects.toMatchObject({ code: error });
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it("refuses malformed commands before token acquisition or dispatch", async () => {
    const { api, fetcher, session, signal } = fixture();
    await expect(
      api.saveValuationAssumptions(
        { ...command, extra: true } as ManagedValuationAssumptionsCommand,
        signal,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(session.getToken).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("enforces the existing exact UTF8 response bound", async () => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValue(
      new Response(
        " ".repeat(MANAGED_VALUATION_ASSUMPTIONS_LIMITS.envelopeBytes + 1),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(api.loadValuationAssumptions(signal)).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("ignores a late response after cancellation and never retries a timed-out dispatch", async () => {
    vi.useFakeTimers();
    const { api, fetcher, signal } = fixture();
    let finish!: (value: Response) => void;
    fetcher.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const work = api.loadValuationAssumptions(signal);
    const refused = expect(work).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(20_001);
    await refused;
    finish(Response.json({ version: 0, payload: command.payload }));
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
