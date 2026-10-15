import { afterEach, expect, it, vi } from "vitest";
import {
  MANAGED_RESEARCH_FOLLOWUPS_LIMITS,
  type ManagedResearchFollowupsCommand,
} from "@research-cockpit/contracts";
import { TrialApiError } from "./api";
import { createManagedApi } from "./managed-api";
import type { TrialSession } from "./session";

function command(): ManagedResearchFollowupsCommand {
  return {
    expectedVersion: 2,
    idempotencyKey: "followups-command-001",
    payload: {
      schemaVersion: 1,
      entries: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
          listing: {
            country: "US",
            exchangeMic: "XNAS",
            instrumentType: "common_stock",
            issuerId: "issuer-one",
            issuerName: "Invented issuer",
            listingId: "listing-one",
            securityId: "security-one",
            securityName: "Invented common stock",
            shareClassId: "class-one",
            shareClassName: "Class A",
            symbol: "ZERO",
          },
          check: "Read the next filing 财报",
          dueOn: "2026-10-31",
          result: "",
          status: "open",
          completedOn: null,
        },
      ],
    },
  };
}
function fixture() {
  const session: TrialSession = {
    userId: "user_synthetic",
    sessionId: "session_synthetic",
    getToken: vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("synthetic-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn<typeof fetch>();
  return {
    session,
    fetcher,
    api: createManagedApi("https://managed.example.invalid", session, fetcher),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("loads and saves only the fixed private follow-up resource with fresh bearer tokens", async () => {
  const { session, fetcher, api } = fixture();
  const input = command(),
    signal = new AbortController().signal;
  fetcher
    .mockResolvedValueOnce(
      Response.json({ version: 2, payload: input.payload }),
    )
    .mockResolvedValueOnce(
      Response.json({ version: 3, payload: input.payload, replayed: false }),
    );
  const loaded = await api.loadFollowups(signal);
  const saved = await api.saveFollowups(input, signal);
  expect(loaded).toEqual({ version: 2, payload: input.payload });
  expect(saved).toEqual({
    version: 3,
    payload: input.payload,
    replayed: false,
  });
  expect(Object.isFrozen(loaded.payload.entries[0]?.listing)).toBe(true);
  expect(session.getToken).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
    Array(2).fill(
      "https://managed.example.invalid/v1/managed/research-followups",
    ),
  );
  for (const [, init] of fetcher.mock.calls)
    expect(init).toMatchObject({
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: { Authorization: "Bearer synthetic-token" },
    });
  expect(fetcher.mock.calls[0]?.[1]?.method).toBe("GET");
  expect(fetcher.mock.calls[1]?.[1]?.method).toBe("POST");
  expect(JSON.parse(fetcher.mock.calls[1]?.[1]?.body as string)).toEqual(input);
});

it("captures authored data before awaiting a token and checks the exact receipt", async () => {
  const { session, fetcher, api } = fixture();
  let release!: (token: string) => void;
  vi.mocked(session.getToken).mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const input = structuredClone(command());
  const expected = structuredClone(input);
  const saving = api.saveFollowups(input, new AbortController().signal);
  Object.assign(input.payload.entries[0]!, { check: "Later caller edit" });
  fetcher.mockResolvedValue(
    Response.json({ version: 3, payload: expected.payload, replayed: true }),
  );
  release("synthetic-token");
  expect(await saving).toEqual({
    version: 3,
    payload: expected.payload,
    replayed: true,
  });
  expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual(
    expected,
  );
});

it("rejects malformed authored input before token or fetch", async () => {
  const { session, fetcher, api } = fixture();
  const input = structuredClone(command());
  Object.assign(input.payload.entries[0]!, { dueOn: "2026-02-30" });
  await expect(
    api.saveFollowups(input, new AbortController().signal),
  ).rejects.toEqual(new TrialApiError("invalid_request"));
  expect(session.getToken).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([
  [400, "invalid_request"],
  [409, "conflict"],
  [409, "idempotency_conflict"],
  [413, "payload_too_large"],
  [415, "unsupported_media_type"],
  [503, "unavailable"],
  [503, "commit_unknown"],
] as const)(
  "preserves mutation recovery status %i/%s",
  async (status, code) => {
    const { fetcher, api } = fixture();
    fetcher.mockResolvedValue(Response.json({ error: code }, { status }));
    await expect(
      api.saveFollowups(command(), new AbortController().signal),
    ).rejects.toEqual(new TrialApiError(code));
    expect(fetcher).toHaveBeenCalledOnce();
  },
);

it.each([
  [409, "catalog_changed"],
  [503, "not_configured"],
  [200, "unavailable"],
] as const)("rejects mismatched response kinds %i/%s", async (status, code) => {
  const { fetcher, api } = fixture();
  fetcher.mockResolvedValue(Response.json({ error: code }, { status }));
  await expect(
    api.saveFollowups(command(), new AbortController().signal),
  ).rejects.toEqual(new TrialApiError("invalid_response"));
});

it.each([401, 403])(
  "rejects authentication status %i without exposing a body",
  async (status) => {
    const { fetcher, api } = fixture();
    fetcher.mockResolvedValue(
      new Response("untrusted upstream body", { status }),
    );
    await expect(
      api.loadFollowups(new AbortController().signal),
    ).rejects.toEqual(
      new TrialApiError(status === 401 ? "unauthenticated" : "access_denied"),
    );
  },
);

it.each(["version", "payload", "extra"])(
  "rejects a receipt with wrong %s",
  async (change) => {
    const { fetcher, api } = fixture();
    const input = command();
    const receipt = { version: 3, payload: input.payload, replayed: false };
    if (change === "version") receipt.version++;
    if (change === "payload")
      receipt.payload = { schemaVersion: 1, entries: [] };
    if (change === "extra") Object.assign(receipt, { owner: "unexpected" });
    fetcher.mockResolvedValue(Response.json(receipt));
    await expect(
      api.saveFollowups(input, new AbortController().signal),
    ).rejects.toEqual(new TrialApiError("invalid_response"));
  },
);

it("rejects oversized and malformed UTF-8 bodies without accepting a partial load", async () => {
  const { fetcher, api } = fixture();
  fetcher
    .mockResolvedValueOnce(
      new Response(
        " ".repeat(MANAGED_RESEARCH_FOLLOWUPS_LIMITS.envelopeBytes + 1),
        { headers: { "content-type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(new Uint8Array([0xff]), {
        headers: { "content-type": "application/json" },
      }),
    );
  for (let i = 0; i < 2; i++)
    await expect(
      api.loadFollowups(new AbortController().signal),
    ).rejects.toEqual(new TrialApiError("invalid_response"));
});

it("cancels a held body and bounds a fetch that ignores the client deadline", async () => {
  const { fetcher, api } = fixture();
  const abort = new AbortController(),
    cancel = vi.fn();
  fetcher.mockResolvedValueOnce(
    new Response(new ReadableStream({ cancel }), {
      headers: { "content-type": "application/json" },
    }),
  );
  const loading = api.loadFollowups(abort.signal);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  abort.abort();
  await expect(loading).rejects.toEqual(new TrialApiError("aborted"));
  expect(cancel).toHaveBeenCalledOnce();
  vi.useFakeTimers();
  let release!: (response: Response) => void;
  fetcher.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const saving = api.saveFollowups(command(), new AbortController().signal);
  const rejected = expect(saving).rejects.toEqual(
    new TrialApiError("unavailable"),
  );
  await vi.advanceTimersByTimeAsync(20_000);
  await rejected;
  release(
    Response.json({ version: 3, payload: command().payload, replayed: false }),
  );
  await Promise.resolve();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
