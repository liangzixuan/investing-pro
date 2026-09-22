import type {
  PersonalFilingMonitorDto,
  PersonalFilingMonitorConfigureDto,
} from "@research-cockpit/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgePersonalFilingMonitor,
  configurePersonalFilingMonitor,
  fetchPersonalFilingMonitor,
  pausePersonalFilingMonitor,
  resetPersonalFilingMonitor,
  validatePersonalFilingMonitorBinding,
} from "./personal-filing-monitor-api";

const fetcher = vi.fn<typeof fetch>();
const signal = () => new AbortController().signal;
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
const snapshot = `sha256:${"a".repeat(64)}` as const;
function request(): PersonalFilingMonitorConfigureDto {
  return {
    schemaVersion: "1.0.0",
    expectedVersion: 0,
    policy: {
      enabled: true,
      catalogSnapshotSha256: snapshot,
      watchlistVersion: 3,
      listingIds: ["listing-one"],
      dailyTime: "09:00",
      timeZone: "America/Chicago",
      quietHours: true,
      desktopNotifications: false,
    },
  };
}
type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Mutable<U>[]
    : T[K] extends object
      ? Mutable<T[K]>
      : T[K];
};
function value(): Mutable<PersonalFilingMonitorDto> {
  return {
    schemaVersion: "1.0.0",
    version: 1,
    policy: request().policy,
    bindingStatus: "current",
    running: false,
    nextCheckAt: "2026-09-23T14:00:00.000Z",
    lastCheckAt: "2026-09-22T14:00:00.000Z",
    lastOutcome: "checked",
    coverageGap: false,
    issuers: [
      {
        cik: "0000000001",
        listings: [
          {
            listingId: "listing-one",
            symbol: "ONE",
            issuerName: "Example One",
          },
        ],
        seeded: true,
        lastCompleteAt: "2026-09-22T14:00:00.000Z",
        status: "complete",
        coverageGap: false,
      },
    ],
    inbox: [
      {
        id: "0000000001:0000000001-26-000001",
        filing: {
          cik: "0000000001",
          accessionNumber: "0000000001-26-000001",
          form: "10-Q/A",
          filingDate: "2026-09-22",
          reportDate: "2026-06-30",
          sourceUrl:
            "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
        },
        listings: [
          {
            listingId: "listing-one",
            symbol: "ONE",
            issuerName: "Example One",
          },
        ],
        firstSeenAt: "2026-09-22T14:00:00.000Z",
        readAt: null,
        delivery: {
          status: "observed_shown",
          shownObserved: true,
          attemptedAt: "2026-09-22T14:00:01.000Z",
          completedAt: "2026-09-22T14:00:02.000Z",
        },
      },
    ],
    unreadCount: 1,
  };
}
function reply(body: unknown, status = 200) {
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
function context() {
  return {
    catalogSnapshotSha256: snapshot,
    watchlistVersion: 3,
    memberships: [
      {
        country: "US" as const,
        exchangeMic: "XNAS",
        instrumentType: "common_stock" as const,
        issuerId: "issuer-one",
        issuerName: "Example One",
        listingId: "listing-one",
        note: "private note never sent",
        securityId: "security-one",
        securityName: "Example common",
        shareClassId: "class-one",
        shareClassName: "Common",
        symbol: "ONE",
      },
    ],
  };
}

describe("filing monitor client", () => {
  it("accepts a multi-write mutation version advance", async () => {
    const data = value();
    data.version = 3;
    reply(data);
    await expect(
      configurePersonalFilingMonitor(
        { ...request(), expectedVersion: 1 },
        signal(),
      ),
    ).resolves.toMatchObject({ version: 3 });
  });
  it("accepts policy objects independent of JSON property order", async () => {
    const data = value();
    data.policy = Object.fromEntries(
      Object.entries(data.policy!).reverse(),
    ) as PersonalFilingMonitorConfigureDto["policy"];
    reply(data);
    await expect(
      configurePersonalFilingMonitor(request(), signal()),
    ).resolves.toMatchObject({ version: 1 });
  });
  it("rejects a configured snapshot missing part of its selected listing set", async () => {
    const data = value();
    data.policy = {
      ...data.policy!,
      listingIds: ["listing-one", "listing-two"],
    };
    reply(data);
    await expect(fetchPersonalFilingMonitor(signal())).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("rejects a listing claimed by two issuers", async () => {
    const data = value();
    data.issuers = [
      ...data.issuers,
      { ...data.issuers[0]!, cik: "0000000002" },
    ];
    reply(data);
    await expect(fetchPersonalFilingMonitor(signal())).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("preserves a shown callback with an uncertain final outcome and unread entry", async () => {
    const data = value();
    Object.assign(data.inbox[0]!.delivery, {
      status: "delivery_uncertain",
      shownObserved: true,
    });
    reply(data);
    await expect(fetchPersonalFilingMonitor(signal())).resolves.toMatchObject({
      inbox: [
        {
          readAt: null,
          delivery: { status: "delivery_uncertain", shownObserved: true },
        },
      ],
    });
  });
  it("loads explicitly through the private loopback request with no provider request", async () => {
    reply(value());
    const abort = signal();
    const actual = await fetchPersonalFilingMonitor(abort);
    expect(actual).toEqual(value());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toBe(
      "http://127.0.0.1:3100/v1/personal-filing/workspace/filing-monitor",
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: abort,
    });
    expect(actual.inbox[0]?.readAt).toBeNull();
  });
  it("creates only with explicit policy, creation guard and independent idempotency key", async () => {
    reply(value());
    await configurePersonalFilingMonitor(request(), signal());
    const options = fetcher.mock.calls[0]?.[1];
    const body = options?.body;
    if (typeof body !== "string") throw new Error("Expected JSON body");
    expect(JSON.parse(body) as unknown).toEqual(request());
    expect(options?.headers).toMatchObject({
      "If-None-Match": "*",
      "X-Research-Cockpit-Intent": "personal-vault-create",
      "Content-Type": "application/json",
    });
    expect(
      new Headers(options?.headers).get("X-Research-Cockpit-Idempotency-Key"),
    ).toMatch(/^filing-monitor-[0-9a-f-]{36}$/u);
    expect(body).not.toContain("private note");
  });
  it("uses an exact update precondition and binds the committed version", async () => {
    const data = value();
    data.version = 4;
    reply(data);
    await configurePersonalFilingMonitor(
      { ...request(), expectedVersion: 3 },
      signal(),
    );
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      "If-Match": '"v3"',
      "X-Research-Cockpit-Intent": "personal-vault-update",
    });
  });
  it("snapshots mutable input before waiting for the response", async () => {
    let done!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise((resolve) => {
        done = resolve;
      }),
    );
    const submitted = request();
    const pending = configurePersonalFilingMonitor(submitted, signal());
    Object.assign(submitted.policy, { dailyTime: "23:59" });
    done(new Response(JSON.stringify(value())));
    await expect(pending).resolves.toMatchObject({
      policy: { dailyTime: "09:00" },
    });
  });
  it("accepts an unconfigured off snapshot", async () => {
    const off = {
      ...value(),
      version: 0,
      policy: null,
      bindingStatus: "unconfigured",
      nextCheckAt: null,
      lastCheckAt: null,
      lastOutcome: null,
      issuers: [],
      inbox: [],
      unreadCount: 0,
    };
    reply(off);
    await expect(fetchPersonalFilingMonitor(signal())).resolves.toEqual(off);
  });
  it("accepts explicit needs-rebind history while rejecting a forged current context", () => {
    const data = value();
    const other = { ...context(), watchlistVersion: 4 };
    expect(() =>
      validatePersonalFilingMonitorBinding(data, other),
    ).toThrowError();
    data.bindingStatus = "needs_rebind";
    expect(() =>
      validatePersonalFilingMonitorBinding(data, other),
    ).not.toThrow();
  });
  it.each(["symbol", "issuerName", "listingId"] as const)(
    "rejects mismatched current %s",
    (field) => {
      const data = value();
      Object.assign(data.issuers[0]!.listings[0]!, { [field]: "forged" });
      expect(() =>
        validatePersonalFilingMonitorBinding(data, context()),
      ).toThrowError();
    },
  );
  it("pauses with update headers and preserves inbox", async () => {
    const data = value();
    data.version = 2;
    data.policy = { ...data.policy!, enabled: false };
    data.nextCheckAt = null;
    reply(data);
    await expect(
      pausePersonalFilingMonitor(
        { schemaVersion: "1.0.0", expectedVersion: 1 },
        signal(),
      ),
    ).resolves.toEqual(data);
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toMatch(/\/pause$/u);
  });
  it("acknowledges exact events without treating shown callbacks as read", async () => {
    const data = value();
    data.version = 2;
    Object.assign(data.inbox[0]!, { readAt: "2026-09-22T14:01:00.000Z" });
    data.unreadCount = 0;
    reply(data);
    await acknowledgePersonalFilingMonitor(
      {
        schemaVersion: "1.0.0",
        expectedVersion: 1,
        eventIds: [data.inbox[0]!.id],
      },
      signal(),
    );
    expect((fetcher.mock.calls[0]?.[0] as URL).href).toMatch(/\/acknowledge$/u);
  });
  it("rejects an acknowledgement that did not acknowledge its retained event", async () => {
    const data = value();
    data.version = 2;
    reply(data);
    await expect(
      acknowledgePersonalFilingMonitor(
        {
          schemaVersion: "1.0.0",
          expectedVersion: 1,
          eventIds: [data.inbox[0]!.id],
        },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("requires paused empty state after reset", async () => {
    const data = value();
    data.version = 2;
    data.policy = { ...data.policy!, enabled: false };
    data.nextCheckAt = null;
    data.issuers = [
      {
        ...data.issuers[0]!,
        seeded: false,
        lastCompleteAt: null,
        status: "unseeded",
      },
    ];
    data.inbox = [];
    data.unreadCount = 0;
    reply(data);
    await expect(
      resetPersonalFilingMonitor(
        { schemaVersion: "1.0.0", expectedVersion: 1 },
        signal(),
      ),
    ).resolves.toEqual(data);
  });
  it("rejects a reset retaining inbox history", async () => {
    const data = value();
    data.version = 2;
    data.policy = { ...data.policy!, enabled: false };
    data.nextCheckAt = null;
    reply(data);
    await expect(
      resetPersonalFilingMonitor(
        { schemaVersion: "1.0.0", expectedVersion: 1 },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [
      "unknown field",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v, { extra: true }),
    ],
    [
      "too many selections",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v.policy, {
          listingIds: Array.from({ length: 21 }, (_, i) => `listing-${i}`),
        }),
    ],
    [
      "duplicate selection",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v.policy, { listingIds: ["one", "one"] }),
    ],
    [
      "empty selection",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v.policy, { listingIds: [] }),
    ],
    [
      "bad local time",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v.policy, { dailyTime: "24:00" }),
    ],
    [
      "bad time zone",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v.policy, { timeZone: "Not/AZone" }),
    ],
    [
      "negative version",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v, { expectedVersion: -1 }),
    ],
    [
      "overflow version",
      (v: PersonalFilingMonitorConfigureDto) =>
        Object.assign(v, { expectedVersion: Number.MAX_SAFE_INTEGER }),
    ],
  ])("rejects %s before any request", async (_name, mutate) => {
    const data = request();
    mutate(data);
    await expect(
      configurePersonalFilingMonitor(data, signal()),
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [
      "unknown snapshot field",
      (v: PersonalFilingMonitorDto) => Object.assign(v, { extra: true }),
    ],
    [
      "unknown delivery",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.delivery, { status: "read" }),
    ],
    [
      "forged source URL",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.filing, {
          sourceUrl: "https://evil.invalid/",
        }),
    ],
    [
      "bad observed date",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!, { firstSeenAt: "2026-02-30T14:00:00.000Z" }),
    ],
    [
      "bad calendar date",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.filing, { filingDate: "2026-02-30" }),
    ],
    [
      "wrong unread count",
      (v: PersonalFilingMonitorDto) => Object.assign(v, { unreadCount: 0 }),
    ],
    [
      "duplicated event",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v, { inbox: [v.inbox[0], v.inbox[0]], unreadCount: 2 }),
    ],
    [
      "wrong event identity",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!, { id: "wrong" }),
    ],
    [
      "foreign issuer",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.issuers[0]!, { cik: "0000000002" }),
    ],
    [
      "foreign listing",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.policy!, { listingIds: ["different"] }),
    ],
    [
      "unseeded complete issuer",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.issuers[0]!, { seeded: false, lastCompleteAt: null }),
    ],
    [
      "hidden gap",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.issuers[0]!, { coverageGap: true }),
    ],
    [
      "read before observation",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!, { readAt: "2026-09-21T00:00:00.000Z" }),
    ],
    [
      "future filing date",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.filing, { filingDate: "2026-09-23" }),
    ],
    [
      "completion before attempt",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.delivery, {
          completedAt: "2026-09-22T14:00:00.000Z",
        }),
    ],
    [
      "shown without attempt",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.delivery, { attemptedAt: null }),
    ],
    [
      "pending with completed receipt",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v.inbox[0]!.delivery, { status: "pending" }),
    ],
    [
      "disabled still running",
      (v: PersonalFilingMonitorDto) => {
        Object.assign(v.policy!, { enabled: false });
        Object.assign(v, { running: true });
      },
    ],
    [
      "unconfigured still running",
      (v: PersonalFilingMonitorDto) =>
        Object.assign(v, {
          version: 0,
          policy: null,
          bindingStatus: "unconfigured",
          issuers: [],
          inbox: [],
          unreadCount: 0,
          running: true,
        }),
    ],
  ])("rejects response: %s", async (_name, mutate) => {
    const data = value();
    mutate(data);
    reply(data);
    await expect(fetchPersonalFilingMonitor(signal())).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("rejects returned policy drift", async () => {
    const data = value();
    data.policy = { ...data.policy!, desktopNotifications: true };
    reply(data);
    await expect(
      configurePersonalFilingMonitor(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("rejects returned version regression", async () => {
    const data = value();
    data.version = 0;
    reply(data);
    await expect(
      configurePersonalFilingMonitor(request(), signal()),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    [401, "session_unavailable"],
    [403, "session_unavailable"],
    [409, "conflict"],
    [503, "unavailable"],
  ])("maps HTTP %s without reading error contents", async (status, code) => {
    reply({ private: "must not be exposed" }, Number(status));
    await expect(fetchPersonalFilingMonitor(signal())).rejects.toMatchObject({
      code,
    });
  });
  it("rejects malformed JSON", async () => {
    fetcher.mockResolvedValueOnce(new Response("{"));
    await expect(fetchPersonalFilingMonitor(signal())).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("preserves cancellation", async () => {
    const controller = new AbortController();
    fetcher.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new Error("network"));
    });
    await expect(
      fetchPersonalFilingMonitor(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
