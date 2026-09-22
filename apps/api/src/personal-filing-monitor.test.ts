import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import {
  isPersonalFilingMonitorDto,
  type PersonalFilingMonitorPolicyDto,
  type PersonalSecIssuerFilingsDto,
  type PersonalSecRecentFilingDto,
} from "@research-cockpit/contracts";
import {
  LOCAL_RESEARCH_VAULT_PROFILE,
  LocalResearchVault,
  LocalResearchVaultError,
  WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
  type LocalResearchRecord,
  type PutLocalResearchRecordCommand,
  type WindowsOwnerOnlyAclPort,
} from "@research-cockpit/local-research-vault";
import {
  admitPersonalSecurityMasterSnapshot,
  searchPersonalSecurityMaster,
} from "@research-cockpit/personal-security-master";
import { describe, expect, it, vi } from "vitest";

import type { PersonalDesktopNotificationObservation } from "./personal-desktop-notifications";
import { createPersonalFilingMonitor } from "./personal-filing-monitor";
import {
  filingMonitorQuiet,
  nextFilingMonitorCheck,
} from "./personal-filing-monitor-schedule";
import { PersonalSecFilingsProviderError } from "./personal-sec-filings-provider";
import {
  bindTestSecurityMasterDocument,
  buildMutableTestSecurityMasterDocument,
  buildTestSecurityMasterAdmission,
} from "./test-personal-security-master-builder";

export function monitorFixture(
  storage?: LocalResearchVault,
  selected = ["lst-00000", "lst-00001", "lst-00002"],
  large = false,
) {
  const document = buildMutableTestSecurityMasterDocument(large ? 20 : 4);
  if (large) {
    document.issuers = [
      { ...document.issuers[0]!, issuerName: "A".repeat(128) },
    ];
    for (const record of document.records) record.issuerId = "iss-00000";
  }
  const admission = large
    ? bindTestSecurityMasterDocument(document)
    : buildTestSecurityMasterAdmission(4);
  const catalog = admitPersonalSecurityMasterSnapshot({
    expectedSha256: admission.expectedSha256,
    snapshot: admission.snapshot,
  });
  const memberships = Array.from({ length: large ? 20 : 4 }, (_, index) => {
    const row = searchPersonalSecurityMaster(catalog, {
      query: `S${String(index).padStart(5, "0")}`,
      limit: 1,
    }).results[0]!;
    return {
      country: row.country,
      exchangeMic: row.exchangeMic,
      instrumentType: row.instrumentType,
      issuerId: row.issuerId,
      issuerName: row.issuerName,
      listingId: row.listingId,
      note: "synthetic-private-note",
      securityId: row.securityId,
      securityName: row.securityName,
      shareClassId: row.shareClassId,
      shareClassName: row.shareClassName,
      symbol: row.symbol,
    };
  });
  const memory = new MemoryVault();
  const vault = storage ?? (memory as unknown as LocalResearchVault);
  vault.putRecord({
    kind: "watchlist",
    id: "main",
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
    payload: {
      schemaVersion: 1,
      name: "My Watchlist",
      snapshotSha256: admission.expectedSha256,
      memberships,
    },
  });
  let now = new Date("2026-03-06T15:00:00.000Z");
  const rows = new Map<string, PersonalSecRecentFilingDto[]>();
  const provider = {
    status: () => ({ configured: true }),
    close: vi.fn(),
    loadFilings: vi.fn(
      (
        ciks: readonly string[],
        from: string,
        through: string,
        _signal?: AbortSignal,
      ): Promise<readonly PersonalSecIssuerFilingsDto[]> => {
        void _signal;
        return Promise.resolve(
          ciks.map((cik) =>
            result(
              cik,
              (rows.get(cik) ?? [filing(cik, "2026-03-05", 1)]).filter(
                (f) => f.filingDate >= from && f.filingDate <= through,
              ),
              now.toISOString(),
            ),
          ),
        );
      },
    ),
  };
  const notifications = {
    notify: vi.fn((_signal?: AbortSignal) => {
      void _signal;
      return Promise.resolve(shown());
    }),
    close: vi.fn(async () => {}),
  };
  const make = () =>
    createPersonalFilingMonitor({
      catalog,
      vault,
      provider,
      notifications,
      now: () => now,
    });
  const policy: PersonalFilingMonitorPolicyDto = {
    enabled: true,
    catalogSnapshotSha256: admission.expectedSha256,
    watchlistVersion: 1,
    listingIds: selected,
    dailyTime: "09:00",
    timeZone: "America/Chicago",
    quietHours: true,
    desktopNotifications: true,
  };
  const monitor = make();
  return {
    catalog,
    vault,
    memory,
    rows,
    provider,
    notifications,
    policy,
    monitor,
    make,
    setNow: (value: string) => {
      now = new Date(value);
    },
    now: () => now,
    configure: (changes: Partial<PersonalFilingMonitorPolicyDto> = {}) =>
      monitor.configure(
        {
          schemaVersion: "1.0.0",
          expectedVersion: monitor.get().version,
          policy: { ...policy, ...changes },
        },
        randomUUID(),
      ),
    next: () => {
      now = new Date(monitor.get().nextCheckAt!);
    },
  };
}

export function filing(
  cik: string,
  date: string,
  sequence: number,
  form = "8-K",
): PersonalSecRecentFilingDto {
  const accessionNumber = `${cik}-26-${String(sequence).padStart(6, "0")}`;
  return {
    cik,
    accessionNumber,
    filingDate: date,
    reportDate: null,
    form,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber}-index.htm`,
  };
}
function result(
  cik: string,
  filings: readonly PersonalSecRecentFilingDto[],
  at: string,
): PersonalSecIssuerFilingsDto {
  return {
    cik,
    status: "available",
    fetchedAt: at,
    sourceUrl: `https://data.sec.gov/submissions/CIK${cik}.json`,
    olderHistoryAvailable: false,
    matchingFilings: filings.length,
    truncated: false,
    filings,
  };
}
function shown(
  overrides: Partial<PersonalDesktopNotificationObservation> = {},
): PersonalDesktopNotificationObservation {
  return {
    status: "observed_shown",
    reason: "callback_shown",
    submissionAttempted: true,
    submissionReturned: true,
    shown: true,
    clicked: false,
    closed: true,
    cleanup: true,
    timedOut: false,
    aborted: false,
    protocolError: false,
    helperFailed: false,
    processClosed: true,
    exitCode: 0,
    userRead: "unknown",
    ...overrides,
  };
}
function command(version: number) {
  return { schemaVersion: "1.0.0" as const, expectedVersion: version };
}
function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function addCurrent(f: ReturnType<typeof monitorFixture>, sequence = 2) {
  for (const issuer of f.monitor.get().issuers)
    f.rows.set(issuer.cik, [
      filing(issuer.cik, "2026-03-05", 1),
      filing(issuer.cik, f.now().toISOString().slice(0, 10), sequence),
    ]);
}

describe("daily filing monitor", () => {
  it("does no provider/native work before opt-in; seeds share classes by CIK without old notices", async () => {
    const f = monitorFixture();
    await f.monitor.tick();
    expect(isPersonalFilingMonitorDto(f.monitor.get())).toBe(true);
    expect(f.provider.loadFilings).not.toHaveBeenCalled();
    expect(f.notifications.notify).not.toHaveBeenCalled();
    f.configure();
    await f.monitor.tick();
    expect(f.provider.loadFilings.mock.calls[0]?.[0]).toHaveLength(2);
    expect(f.monitor.get()).toMatchObject({
      lastOutcome: "seeded",
      unreadCount: 0,
    });
    expect(f.monitor.get().issuers[0]?.listings).toHaveLength(2);
    expect(f.notifications.notify).not.toHaveBeenCalled();
    expect(isPersonalFilingMonitorDto(f.monitor.get())).toBe(true);
    expect(JSON.stringify(f.monitor.get())).not.toContain(
      "synthetic-private-note",
    );
  });
  it("persists events before one coalesced notice; amendments and explicit acknowledgement stay distinct", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    f.notifications.notify.mockImplementationOnce(() => {
      const s = f.monitor.get();
      expect(s.inbox).toHaveLength(2);
      expect(s.inbox.every((e) => e.delivery.status === "reserved")).toBe(true);
      return Promise.resolve(shown());
    });
    await f.monitor.tick();
    expect(f.notifications.notify).toHaveBeenCalledOnce();
    const first = f.monitor.get();
    expect(
      first.inbox.every((e) => e.readAt === null && e.delivery.shownObserved),
    ).toBe(true);
    const acknowledged = f.monitor.acknowledge(
      { ...command(first.version), eventIds: first.inbox.map((e) => e.id) },
      randomUUID(),
    );
    expect(acknowledged.version).toBeGreaterThan(first.version);
    expect(acknowledged.unreadCount).toBe(0);
    f.next();
    const cik = first.issuers[0]!.cik;
    f.rows
      .get(cik)!
      .push(filing(cik, f.now().toISOString().slice(0, 10), 3, "8-K/A"));
    await f.monitor.tick();
    expect(f.monitor.get().inbox).toHaveLength(3);
    expect(f.monitor.get().unreadCount).toBe(1);
    expect(f.notifications.notify).toHaveBeenCalledTimes(2);
    expect(isPersonalFilingMonitorDto(f.monitor.get())).toBe(true);
  });
  it("holds failed/truncated baselines, seeds the next complete result, and exposes coverage gaps", async () => {
    const f = monitorFixture();
    f.configure();
    f.provider.loadFilings.mockImplementationOnce((ciks) =>
      Promise.resolve(
        ciks.map((cik, i) =>
          i === 0
            ? {
                ...result(cik, [], f.now().toISOString()),
                status: "upstream_unavailable",
              }
            : {
                ...result(
                  cik,
                  [filing(cik, "2026-03-05", 1)],
                  f.now().toISOString(),
                ),
                matchingFilings: 2,
                truncated: true,
              },
        ),
      ),
    );
    await f.monitor.tick();
    expect(f.monitor.get().issuers.every((i) => !i.seeded)).toBe(true);
    expect(f.monitor.get().coverageGap).toBe(true);
    f.next();
    await f.monitor.tick();
    expect(f.monitor.get().issuers.every((i) => i.seeded)).toBe(true);
    expect(f.monitor.get().inbox).toHaveLength(0);
    expect(f.notifications.notify).not.toHaveBeenCalled();
  });
  it("keeps the due instant pending when acquisition is interrupted and catches up once on restart", async () => {
    const f = monitorFixture();
    f.configure();
    const pending = defer<readonly PersonalSecIssuerFilingsDto[]>();
    f.provider.loadFilings.mockImplementationOnce(async () => pending.promise);
    const run = f.monitor.tick();
    expect(f.monitor.get().nextCheckAt).toBe(f.now().toISOString());
    const stopped = f.monitor.close();
    const resumed = f.make();
    await resumed.tick();
    expect(f.provider.loadFilings).toHaveBeenCalledTimes(2);
    expect(resumed.get().lastOutcome).toBe("seeded");
    await resumed.tick();
    expect(f.provider.loadFilings).toHaveBeenCalledTimes(2);
    pending.resolve([]);
    await run;
    await stopped;
    await resumed.close();
  });
  it("catches up after a long outage once, flags the unprovable window, and retires expired seen keys", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    await f.monitor.close();
    f.setNow("2026-05-01T15:00:00.000Z");
    const resumed = f.make();
    await resumed.tick();
    await resumed.tick();
    expect(f.provider.loadFilings).toHaveBeenCalledTimes(2);
    expect(resumed.get().coverageGap).toBe(true);
    expect(resumed.get().inbox).toHaveLength(0);
    await resumed.close();
  });
  it("has a finite three-attempt busy budget and persists it across restart", async () => {
    const f = monitorFixture();
    f.configure();
    f.provider.loadFilings.mockRejectedValue(
      new PersonalSecFilingsProviderError("busy"),
    );
    await f.monitor.tick();
    expect(f.monitor.get().nextCheckAt).toBe("2026-03-06T15:05:00.000Z");
    await f.monitor.close();
    const resumed = f.make();
    f.setNow("2026-03-06T15:05:00.000Z");
    await resumed.tick();
    f.setNow("2026-03-06T15:10:00.000Z");
    await resumed.tick();
    expect(f.provider.loadFilings).toHaveBeenCalledTimes(3);
    expect(resumed.get().nextCheckAt).toBe("2026-03-07T15:00:00.000Z");
    await resumed.tick();
    expect(f.provider.loadFilings).toHaveBeenCalledTimes(3);
    await resumed.close();
  });
  it("queues notices through quiet hours without blocking acquisition or rechecking early", async () => {
    const f = monitorFixture();
    f.configure({ dailyTime: "23:00" });
    await f.monitor.tick();
    f.setNow("2026-03-08T05:00:00.000Z");
    addCurrent(f);
    await f.monitor.tick();
    expect(
      f.monitor.get().inbox.every((e) => e.delivery.status === "pending"),
    ).toBe(true);
    expect(f.notifications.notify).not.toHaveBeenCalled();
    f.setNow("2026-03-08T13:00:00.000Z");
    await f.monitor.tick();
    expect(f.notifications.notify).toHaveBeenCalledOnce();
    expect(f.provider.loadFilings).toHaveBeenCalledTimes(2);
  });
  it("pause cancels a pending acquisition and late completion cannot seed or notify", async () => {
    const f = monitorFixture();
    f.configure();
    const pending = defer<readonly PersonalSecIssuerFilingsDto[]>();
    f.provider.loadFilings.mockImplementationOnce(async () => pending.promise);
    const run = f.monitor.tick();
    const signal = f.provider.loadFilings.mock.calls[0]![3]!;
    const paused = f.monitor.pause(
      command(f.monitor.get().version),
      randomUUID(),
    );
    expect(signal.aborted).toBe(true);
    expect(paused.running).toBe(false);
    pending.resolve(
      paused.issuers.map((i) => result(i.cik, [], f.now().toISOString())),
    );
    await run;
    expect(f.monitor.get().issuers.every((i) => !i.seeded)).toBe(true);
    expect(f.notifications.notify).not.toHaveBeenCalled();
  });
  it("changed watchlist version aborts on an active wake and rejects the old response", async () => {
    const f = monitorFixture();
    f.configure();
    const pending = defer<readonly PersonalSecIssuerFilingsDto[]>();
    f.provider.loadFilings.mockImplementationOnce(async () => pending.promise);
    const run = f.monitor.tick();
    const watch = f.vault.getRecord("watchlist", "main");
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: watch.version,
      idempotencyKey: randomUUID(),
      payload: watch.payload,
    });
    const second = f.monitor.tick();
    expect(f.provider.loadFilings.mock.calls[0]![3]!.aborted).toBe(true);
    pending.resolve([]);
    await run;
    await second;
    expect(f.monitor.get().bindingStatus).toBe("needs_rebind");
    expect(f.monitor.get().lastOutcome).toBe("needs_rebind");
    expect(f.notifications.notify).not.toHaveBeenCalled();
    f.configure({ watchlistVersion: 2 });
    await f.monitor.tick();
    expect(f.monitor.get().bindingStatus).toBe("current");
  });
  it("rejects unsaved selection, invalid/full identity and stale policy before provider work", () => {
    const f = monitorFixture();
    expect(() => f.configure({ listingIds: ["lst-missing"] })).toThrow();
    const watch = f.vault.getRecord("watchlist", "main");
    const payload = structuredClone(watch.payload) as {
      memberships: { securityId: string }[];
    };
    payload.memberships[0]!.securityId = "different-security";
    f.vault.putRecord({
      kind: "watchlist",
      id: "main",
      expectedVersion: 1,
      idempotencyKey: randomUUID(),
      payload,
    });
    expect(() => f.configure({ watchlistVersion: 2 })).toThrow();
    expect(f.provider.loadFilings).not.toHaveBeenCalled();
  });
  it("reserves before native work and converts an interrupted attempt to uncertainty without redispatch", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    const pending = defer<PersonalDesktopNotificationObservation>();
    f.notifications.notify.mockImplementationOnce(async () => pending.promise);
    const run = f.monitor.tick();
    await vi.waitFor(() =>
      expect(f.notifications.notify).toHaveBeenCalledOnce(),
    );
    expect(
      f.monitor.get().inbox.every((e) => e.delivery.status === "reserved"),
    ).toBe(true);
    const stopped = f.monitor.close();
    const resumed = f.make();
    await resumed.tick();
    expect(
      resumed
        .get()
        .inbox.every((e) => e.delivery.status === "delivery_uncertain"),
    ).toBe(true);
    expect(f.notifications.notify).toHaveBeenCalledOnce();
    pending.resolve(shown());
    await run;
    await stopped;
    expect(resumed.get().inbox.every((e) => !e.delivery.shownObserved)).toBe(
      true,
    );
    await resumed.close();
  });
  it.each([
    [shown({ helperFailed: true, exitCode: 1 }), "delivery_uncertain", true],
    [
      shown({ timedOut: true, processClosed: false }),
      "delivery_uncertain",
      true,
    ],
    [
      shown({
        status: "not_submitted",
        shown: false,
        submissionAttempted: false,
        submissionReturned: false,
        cleanup: false,
        exitCode: null,
      }),
      "not_submitted",
      false,
    ],
    [
      shown({ status: "submission_unconfirmed", shown: false }),
      "submission_unconfirmed",
      false,
    ],
  ] as const)(
    "retains observation strength and never retries a terminal native result %#",
    async (observation, status, shownObserved) => {
      const f = monitorFixture();
      f.configure();
      await f.monitor.tick();
      f.next();
      addCurrent(f);
      f.notifications.notify.mockResolvedValueOnce(observation);
      await f.monitor.tick();
      await f.monitor.tick();
      expect(
        f.monitor
          .get()
          .inbox.every(
            (e) =>
              e.delivery.status === status &&
              e.delivery.shownObserved === shownObserved,
          ),
      ).toBe(true);
      expect(f.notifications.notify).toHaveBeenCalledOnce();
      expect(isPersonalFilingMonitorDto(f.monitor.get())).toBe(true);
    },
  );
  it("holds overflow without consuming unseen keys or dropping unread history", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    for (const i of f.monitor.get().issuers)
      f.rows.set(
        i.cik,
        Array.from({ length: 52 }, (_, n) =>
          filing(i.cik, f.now().toISOString().slice(0, 10), n + 1),
        ),
      );
    await f.monitor.tick();
    expect(f.monitor.get().issuers.every((i) => i.status === "overflow")).toBe(
      true,
    );
    expect(f.monitor.get().inbox).toHaveLength(0);
    expect(f.notifications.notify).not.toHaveBeenCalled();
    f.next();
    addCurrent(f);
    await f.monitor.tick();
    expect(f.monitor.get().inbox).toHaveLength(2);
  });
  it("explicit paused reset clears fixed slots and permits reseeding the same CIK without tombstone recreation", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    await f.monitor.tick();
    expect(() => f.configure({ listingIds: ["lst-00003"] })).toThrow();
    expect(() =>
      f.monitor.reset(command(f.monitor.get().version), randomUUID()),
    ).toThrow();
    f.monitor.pause(command(f.monitor.get().version), randomUUID());
    const reset = f.monitor.reset(
      command(f.monitor.get().version),
      randomUUID(),
    );
    expect(reset.policy?.enabled).toBe(false);
    expect(reset.inbox).toHaveLength(0);
    expect(f.memory.records.size).toBe(22);
    f.configure();
    await f.monitor.tick();
    expect(f.monitor.get().inbox).toHaveLength(0);
    expect(f.notifications.notify).toHaveBeenCalledOnce();
    expect(f.memory.records.size).toBe(22);
  });
  it("resumes an interrupted slot transition before acquiring or delivering", async () => {
    const f = monitorFixture();
    const original = f.memory.putRecord.getMockImplementation()!;
    f.memory.putRecord.mockImplementation((command) => {
      if (command.id.endsWith("slot-03"))
        throw new Error("simulated power loss");
      return original(command);
    });
    expect(() => f.configure()).toThrow();
    expect(f.provider.loadFilings).not.toHaveBeenCalled();
    f.memory.putRecord.mockImplementation(original);
    const resumed = f.make();
    await resumed.tick();
    expect(resumed.get().issuers.every((i) => i.seeded)).toBe(true);
    expect(f.notifications.notify).not.toHaveBeenCalled();
    await resumed.close();
  });
  it("recovers a caller-keyed acknowledgement across partial slot writes", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    await f.monitor.tick();
    const before = f.monitor.get(),
      key = randomUUID(),
      original = f.memory.putRecord.getMockImplementation()!;
    f.memory.putRecord.mockImplementation((command) => {
      if (command.id.endsWith("slot-01"))
        throw new Error("simulated ack interruption");
      return original(command);
    });
    expect(() =>
      f.monitor.acknowledge(
        { ...command(before.version), eventIds: before.inbox.map((e) => e.id) },
        key,
      ),
    ).toThrow();
    expect(f.memory.keys.has(key)).toBe(true);
    f.memory.putRecord.mockImplementation(original);
    const resumed = f.make();
    await resumed.tick();
    expect(resumed.get().unreadCount).toBe(0);
    expect(resumed.get().version).toBeGreaterThan(before.version);
    expect(f.notifications.notify).toHaveBeenCalledOnce();
    await resumed.close();
  });
  it("preserves uncertain and unread entries beyond retention while pruning acknowledged settled history", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    await f.monitor.tick();
    const state = f.monitor.get();
    f.monitor.acknowledge(
      { ...command(state.version), eventIds: [state.inbox[0]!.id] },
      randomUUID(),
    );
    f.setNow("2026-05-01T15:00:00.000Z");
    await f.monitor.tick();
    expect(f.monitor.get().inbox).toHaveLength(1);
    expect(f.monitor.get().inbox[0]?.readAt).toBe(null);
  });
  it("replays a due batch after a process loss between issuer commits without duplicating the first issuer event", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    const originalPut = f.memory.putRecord.getMockImplementation()!,
      originalGet = f.memory.getRecord.getMockImplementation()!;
    f.memory.putRecord.mockImplementation((c) => {
      if (c.id.endsWith("slot-01")) {
        f.memory.getRecord.mockImplementation(() => {
          throw new Error("process lost");
        });
        throw new Error("process lost");
      }
      return originalPut(c);
    });
    await expect(f.monitor.tick()).rejects.toThrow("process lost");
    f.memory.putRecord.mockImplementation(originalPut);
    f.memory.getRecord.mockImplementation(originalGet);
    await f.monitor.close();
    expect(f.monitor.get().nextCheckAt).toBe(f.now().toISOString());
    const resumed = f.make();
    await resumed.tick();
    expect(resumed.get().inbox).toHaveLength(2);
    expect(f.notifications.notify).toHaveBeenCalledOnce();
    await resumed.close();
  });
  it("an interrupted acknowledgement retires already-running acquisition before it can deliver pending events", async () => {
    const f = monitorFixture();
    f.configure({ dailyTime: "23:00" });
    await f.monitor.tick();
    f.setNow("2026-03-08T05:00:00.000Z");
    addCurrent(f);
    await f.monitor.tick();
    f.setNow(f.monitor.get().nextCheckAt!);
    const pending = defer<readonly PersonalSecIssuerFilingsDto[]>();
    f.provider.loadFilings.mockImplementationOnce(async () => pending.promise);
    const run = f.monitor.tick(),
      state = f.monitor.get(),
      original = f.memory.putRecord.getMockImplementation()!;
    f.memory.putRecord.mockImplementation((c) => {
      if (c.id.endsWith("slot-01")) throw new Error("ack interruption");
      return original(c);
    });
    expect(() =>
      f.monitor.acknowledge(
        { ...command(state.version), eventIds: state.inbox.map((e) => e.id) },
        randomUUID(),
      ),
    ).toThrow();
    expect(f.provider.loadFilings.mock.calls.at(-1)![3]!.aborted).toBe(true);
    f.memory.putRecord.mockImplementation(original);
    pending.resolve([]);
    await run;
    const resumed = f.make();
    await resumed.tick();
    expect(resumed.get().unreadCount).toBe(0);
    expect(f.notifications.notify).not.toHaveBeenCalled();
    await resumed.close();
  });
  it("leaves policy and active work unchanged when an idempotency key is reused for a different command", async () => {
    const f = monitorFixture(),
      key = randomUUID();
    f.monitor.configure({ ...command(0), policy: f.policy }, key);
    const pending = defer<readonly PersonalSecIssuerFilingsDto[]>();
    f.provider.loadFilings.mockImplementationOnce(async () => pending.promise);
    const run = f.monitor.tick();
    const before = f.monitor.get();
    expect(() => f.monitor.pause(command(before.version), key)).toThrow();
    expect(f.provider.loadFilings.mock.calls[0]![3]!.aborted).toBe(false);
    expect(f.monitor.get().policy?.enabled).toBe(true);
    pending.resolve(
      before.issuers.map((i) => result(i.cik, [], f.now().toISOString())),
    );
    await run;
  });
  it("reserves enough bytes for delivery and acknowledgement before admitting a near-cap issuer history", async () => {
    const selected = Array.from(
        { length: 20 },
        (_, n) => `lst-${String(n).padStart(5, "0")}`,
      ),
      f = monitorFixture(undefined, selected, true);
    f.configure();
    await f.monitor.tick();
    const cik = f.monitor.get().issuers[0]!.cik;
    f.rows.set(cik, [filing(cik, "2026-03-05", 1)]);
    let accepted = 0;
    for (let n = 2; n <= 55; n++) {
      f.next();
      f.rows.get(cik)!.push(filing(cik, f.now().toISOString().slice(0, 10), n));
      await f.monitor.tick();
      const state = f.monitor.get();
      expect(isPersonalFilingMonitorDto(state)).toBe(true);
      if (state.issuers[0]!.status === "overflow") break;
      accepted = state.inbox.length;
    }
    const full = f.monitor.get();
    expect(full.issuers[0]!.status).toBe("overflow");
    expect(full.inbox).toHaveLength(accepted);
    expect(accepted).toBeGreaterThan(30);
    expect(accepted).toBeLessThan(50);
    f.monitor.acknowledge(
      { ...command(full.version), eventIds: full.inbox.map((e) => e.id) },
      randomUUID(),
    );
    expect(isPersonalFilingMonitorDto(f.monitor.get())).toBe(true);
    const slot = f.vault.getRecord(
      "job_state",
      "personal-filing-monitor-slot-00",
    );
    expect(Buffer.byteLength(JSON.stringify(slot.payload))).toBeLessThanOrEqual(
      192 * 1_024,
    );
  });
  it("admission ignores JSON object-key order and rejects scalar-coercion and false delivery receipts", async () => {
    const f = monitorFixture();
    f.configure();
    await f.monitor.tick();
    f.next();
    addCurrent(f);
    await f.monitor.tick();
    const snapshot = f.monitor.get();
    const reordered = {
      ...snapshot,
      inbox: snapshot.inbox.map((e) => ({
        ...e,
        listings: e.listings.map((l) => ({
          issuerName: l.issuerName,
          symbol: l.symbol,
          listingId: l.listingId,
        })),
      })),
    };
    expect(isPersonalFilingMonitorDto(reordered)).toBe(true);
    expect(
      isPersonalFilingMonitorDto({ ...snapshot, bindingStatus: ["current"] }),
    ).toBe(false);
    expect(
      isPersonalFilingMonitorDto({ ...snapshot, lastOutcome: ["checked"] }),
    ).toBe(false);
    expect(
      isPersonalFilingMonitorDto({
        ...snapshot,
        inbox: snapshot.inbox.map((e) => ({
          ...e,
          delivery: { ...e.delivery, shownObserved: false },
        })),
      }),
    ).toBe(false);
  });
});

describe("local-time schedule", () => {
  it.each([
    ["2026-03-07T15:00:00.000Z", "02:30", "2026-03-08T08:00:00.000Z"],
    ["2026-10-31T14:00:00.000Z", "01:30", "2026-11-01T06:30:00.000Z"],
    ["2026-11-01T06:30:00.000Z", "01:30", "2026-11-02T07:30:00.000Z"],
    ["2026-03-07T15:00:00.000Z", "09:00", "2026-03-08T14:00:00.000Z"],
  ])(
    "selects a single local date across DST (%s)",
    (now, dailyTime, expected) =>
      expect(
        nextFilingMonitorCheck(new Date(now), {
          dailyTime,
          timeZone: "America/Chicago",
        }),
      ).toBe(expected),
  );
  it.each([
    ["2026-03-07T03:59:00.000Z", false],
    ["2026-03-07T04:00:00.000Z", true],
    ["2026-03-07T13:59:00.000Z", true],
    ["2026-03-07T14:00:00.000Z", false],
  ] as const)("quiet hours use exact local boundaries (%s)", (now, expected) =>
    expect(
      filingMonitorQuiet(new Date(now), {
        quietHours: true,
        timeZone: "America/Chicago",
      }),
    ).toBe(expected),
  );
});

describe("accelerated seven-day encrypted-vault soak", () => {
  it("seeds, detects, acknowledges and restarts through the spring DST boundary with no duplicate events", async () => {
    const parent = await realpath(tmpdir()),
      directory = await mkdtemp(join(parent, "filing-monitor-soak-"));
    const absolute = resolve(directory);
    if (
      !absolute.startsWith(resolve(parent) + sep) ||
      !absolute.split(sep).at(-1)!.startsWith("filing-monitor-soak-")
    )
      throw new Error("Unexpected test cleanup path");
    const acl: WindowsOwnerOnlyAclPort = {
      provisionAndVerifyOwnerOnly: (target) =>
        Promise.resolve({
          profile: WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
          canonicalRootPath: target.canonicalRootPath,
          verifiedPaths: [...target.targetPaths],
          ownerIdentity: "synthetic-owner",
          inheritanceProtected: true,
          ownerOnly: true,
        }),
      verifyOwnerOnly: (target) =>
        Promise.resolve({
          profile: WINDOWS_OWNER_ONLY_ACL_RECEIPT_PROFILE,
          canonicalRootPath: target.canonicalRootPath,
          verifiedPaths: [...target.targetPaths],
          ownerIdentity: "synthetic-owner",
          inheritanceProtected: true,
          ownerOnly: true,
        }),
    };
    const options = {
      startupRootPath: join(directory, "vault"),
      permissionPlatform: "win32" as const,
      windowsAcl: acl,
    };
    let vault = await LocalResearchVault.initialize(options);
    const f = monitorFixture(vault);
    let monitor = f.monitor;
    try {
      f.configure();
      await monitor.tick();
      for (let day = 1; day <= 7; day++) {
        f.setNow(monitor.get().nextCheckAt!);
        for (const issuer of monitor.get().issuers) {
          const existing = f.rows.get(issuer.cik) ?? [
            filing(issuer.cik, "2026-03-05", 1),
          ];
          f.rows.set(issuer.cik, [
            ...existing,
            filing(
              issuer.cik,
              f.now().toISOString().slice(0, 10),
              day + 1,
              day === 4 ? "8-K/A" : "8-K",
            ),
          ]);
        }
        await monitor.tick();
        const snapshot = monitor.get();
        expect(isPersonalFilingMonitorDto(snapshot)).toBe(true);
        expect(snapshot.inbox).toHaveLength(day * 2);
        expect(snapshot.unreadCount).toBe(2);
        monitor.acknowledge(
          {
            ...command(snapshot.version),
            eventIds: snapshot.inbox
              .filter((e) => e.readAt === null)
              .map((e) => e.id),
          },
          randomUUID(),
        );
        expect(f.notifications.notify).toHaveBeenCalledTimes(day);
        await monitor.close();
        vault.close();
        vault = await LocalResearchVault.open(options);
        monitor = createPersonalFilingMonitor({
          catalog: f.catalog,
          vault,
          provider: f.provider,
          notifications: f.notifications,
          now: f.now,
        });
        await monitor.tick();
        expect(f.notifications.notify).toHaveBeenCalledTimes(day);
      }
      expect(f.provider.loadFilings).toHaveBeenCalledTimes(8);
      expect(monitor.get().inbox).toHaveLength(14);
      expect(monitor.get().unreadCount).toBe(0);
      expect(
        vault.inventory().records.filter((r) => r.kind === "job_state"),
      ).toHaveLength(21);
    } finally {
      await monitor.close();
      vault.close();
      await rm(absolute, { recursive: true, force: true });
    }
  }, 30_000);
});

export class MemoryVault {
  readonly records = new Map<string, LocalResearchRecord>();
  readonly keys = new Map<string, string>();
  readonly getRecord = vi.fn((kind: string, id: string) => {
    const record = this.records.get(`${kind}:${id}`);
    if (!record) throw new LocalResearchVaultError("VAULT_NOT_FOUND");
    return structuredClone(record);
  });
  readonly putRecord = vi.fn((command: PutLocalResearchRecordCommand) => {
    const identity = `${command.kind}:${command.id}`,
      old = this.records.get(identity),
      signature = JSON.stringify(command);
    if (
      this.keys.has(command.idempotencyKey) &&
      this.keys.get(command.idempotencyKey) !== signature
    )
      throw new LocalResearchVaultError("VAULT_IDEMPOTENCY_CONFLICT");
    if ((old?.version ?? 0) !== command.expectedVersion)
      throw new LocalResearchVaultError("VAULT_CONFLICT");
    const version = command.expectedVersion + 1,
      stamp = "2026-03-06T15:00:00.000Z";
    this.keys.set(command.idempotencyKey, signature);
    this.records.set(identity, {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      kind: command.kind,
      id: command.id,
      version,
      payload: structuredClone(command.payload),
      payloadSha256: "a".repeat(64),
      createdAt: old?.createdAt ?? stamp,
      updatedAt: stamp,
    });
    return {
      profile: LOCAL_RESEARCH_VAULT_PROFILE,
      operation: "put" as const,
      kind: command.kind,
      id: command.id,
      version,
      digestSha256: "a".repeat(64),
      committedAt: stamp,
      replayed: false,
    };
  });
}
