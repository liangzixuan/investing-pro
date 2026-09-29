import { afterEach, describe, expect, it, vi } from "vitest";
import { createTrialApi, validateApiOrigin } from "./api";
import type { TrialCommand } from "./api";
import type { TrialSession } from "./session";

const origin = "https://trial-api.example.invalid";
const command: TrialCommand = {
  expectedVersion: 2,
  idempotencyKey: "synthetic-command-123",
  selected: ["DEMO_A"],
  note: "invented",
};
function fixture() {
  const session: TrialSession = {
    userId: "user_demo",
    sessionId: "session_demo",
    getToken: vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("synthetic-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn<typeof fetch>();
  return {
    session,
    fetcher,
    api: createTrialApi(origin, session, fetcher),
    signal: new AbortController(),
  };
}
afterEach(() => vi.useRealTimers());

describe("trial API request boundary", () => {
  it("gets a fresh SDK token for each fixed-path request and sends no principal or cookies", async () => {
    const { api, fetcher, session, signal } = fixture();
    fetcher
      .mockResolvedValueOnce(
        Response.json({ version: 2, selected: ["DEMO_A"], note: "old" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          version: 3,
          selected: ["DEMO_A"],
          note: "invented",
          replayed: true,
        }),
      );
    vi.mocked(session.getToken)
      .mockResolvedValueOnce("first-synthetic-token")
      .mockResolvedValueOnce("second-synthetic-token");
    await api.load(signal.signal);
    expect(await api.save(command, signal.signal)).toMatchObject({
      version: 3,
      replayed: true,
    });
    expect(session.getToken).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]).toEqual([
      `${origin}/v1/trial/watchlist`,
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { Authorization: "Bearer first-synthetic-token" },
      }),
    ]);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer second-synthetic-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
  });

  it.each([
    { version: 4, selected: ["DEMO_A"], note: "invented", replayed: false },
    { version: 3, selected: ["DEMO_B"], note: "", replayed: false },
    {
      version: 3,
      selected: ["DEMO_A", "DEMO_A"],
      note: "invented",
      replayed: false,
    },
    {
      version: 3,
      selected: ["DEMO_A"],
      note: "invented",
      replayed: false,
      userId: "other",
    },
  ])("rejects a receipt that does not match the command: %j", async (body) => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValueOnce(Response.json(body));
    await expect(api.save(command, signal.signal)).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retains finite unknown-write errors without automatically retrying", async () => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValueOnce(
      Response.json({ error: "commit_unknown" }, { status: 503 }),
    );
    await expect(api.save(command, signal.signal)).rejects.toMatchObject({
      code: "commit_unknown",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("prevents dispatch if the session retires while the SDK token is pending", async () => {
    const { api, fetcher, session, signal } = fixture();
    let resolve!: (token: string) => void;
    vi.mocked(session.getToken).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const loading = api.load(signal.signal);
    signal.abort();
    await expect(loading).rejects.toMatchObject({ code: "aborted" });
    resolve("late-synthetic-token");
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds even an SDK token request that never resolves", async () => {
    vi.useFakeTimers();
    const { api, fetcher, session, signal } = fixture();
    vi.mocked(session.getToken).mockReturnValueOnce(new Promise(() => {}));
    const outcome = expect(
      api.save(command, signal.signal),
    ).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(20_000);
    await outcome;
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds response bytes and treats truncated JSON as an uncertain response", async () => {
    const { api, fetcher, signal } = fixture();
    fetcher.mockResolvedValueOnce(
      new Response('{"version":3', {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(api.save(command, signal.signal)).rejects.toMatchObject({
      code: "unavailable",
    });
    fetcher.mockResolvedValueOnce(Response.json({ note: "x".repeat(8192) }));
    await expect(api.load(signal.signal)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it.each([
    "http://trial-api.example.invalid",
    `${origin}/`,
    `${origin}/path`,
    `${origin}?target=other`,
    "https://name:password@trial-api.example.invalid",
  ])("rejects non-origin API configuration %s", (value) => {
    expect(() => validateApiOrigin(value)).toThrow();
  });
});
