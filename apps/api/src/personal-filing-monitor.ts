import { randomUUID } from "node:crypto";

import {
  PERSONAL_FILING_MONITOR_LIMITS as LIMITS,
  isPersonalFilingMonitorAcknowledgeDto,
  isPersonalFilingMonitorCommandDto,
  isPersonalFilingMonitorConfigureDto,
  isPersonalFilingMonitorInboxDto,
  isPersonalFilingMonitorIssuerDto,
  isPersonalFilingMonitorPolicyDto,
  type PersonalFilingMonitorAcknowledgeDto,
  type PersonalFilingMonitorCommandDto,
  type PersonalFilingMonitorConfigureDto,
  type PersonalFilingMonitorDto,
  type PersonalFilingMonitorInboxDto,
  type PersonalFilingMonitorIssuerDto,
  type PersonalFilingMonitorPolicyDto,
  type PersonalSecIssuerFilingsDto,
  type PersonalWatchlistFilingListingDto,
  type PersonalWatchlistFilingsRequestDto,
} from "@research-cockpit/contracts";
import {
  LocalResearchVaultError,
  type JsonValue,
  type LocalResearchRecord,
  type LocalResearchVault,
} from "@research-cockpit/local-research-vault";
import type { PersonalSecurityMasterCatalog } from "@research-cockpit/personal-security-master";

import type { PersonalDesktopNotifications } from "./personal-desktop-notifications";
import {
  filingMonitorQuiet,
  nextFilingMonitorCheck,
} from "./personal-filing-monitor-schedule";
import {
  PersonalSecFilingsProviderError,
  type PersonalSecFilingsProvider,
} from "./personal-sec-filings-provider";
import {
  assembleResponse,
  readBoundWatchlist,
  resolveSelectedListings,
} from "./workspace-watchlist-filings-routes";

const CONFIG_ID = "personal-filing-monitor";
const SLOT_PREFIX = "personal-filing-monitor-slot-";
const DAY = 86_400_000;
type Binding = {
  cik: string;
  listings: readonly PersonalWatchlistFilingListingDto[];
};
type Config = {
  schemaVersion: 1;
  policy: PersonalFilingMonitorPolicyDto;
  bindings: Binding[];
  generation: string;
  epoch: string;
  transition: boolean;
  nextCheckAt: string | null;
  lastCheckAt: string | null;
  lastOutcome: PersonalFilingMonitorDto["lastOutcome"];
  coverageGap: boolean;
  busyRetries: number;
  pendingAcknowledgement: { eventIds: readonly string[]; at: string } | null;
};
type Issuer = PersonalFilingMonitorIssuerDto & {
  seen: { accessionNumber: string; filingDate: string }[];
  inbox: PersonalFilingMonitorInboxDto[];
};
type Slot = { schemaVersion: 1; epoch: string; issuer: Issuer | null };
type Saved<T> = { version: number; value: T };
export interface PersonalFilingMonitorDependencies {
  readonly catalog: PersonalSecurityMasterCatalog;
  readonly vault: LocalResearchVault;
  readonly provider: PersonalSecFilingsProvider;
  readonly notifications: PersonalDesktopNotifications;
  readonly now?: () => Date;
}
export class PersonalFilingMonitorError extends Error {
  constructor(
    readonly status: 400 | 409 | 503,
    readonly code:
      "invalid_request" | "conflict" | "history_requires_reset" | "unavailable",
  ) {
    super("The filing monitor request was not accepted.");
  }
}
export interface PersonalFilingMonitor {
  start(): void;
  close(): Promise<void>;
  tick(): Promise<void>;
  get(): PersonalFilingMonitorDto;
  configure(
    body: PersonalFilingMonitorConfigureDto,
    idempotencyKey: string,
  ): PersonalFilingMonitorDto;
  pause(
    body: PersonalFilingMonitorCommandDto,
    idempotencyKey: string,
  ): PersonalFilingMonitorDto;
  acknowledge(
    body: PersonalFilingMonitorAcknowledgeDto,
    idempotencyKey: string,
  ): PersonalFilingMonitorDto;
  reset(
    body: PersonalFilingMonitorCommandDto,
    idempotencyKey: string,
  ): PersonalFilingMonitorDto;
}
export function createPersonalFilingMonitor(
  dependencies: PersonalFilingMonitorDependencies,
): PersonalFilingMonitor {
  return new Monitor(dependencies);
}

class Monitor implements PersonalFilingMonitor {
  readonly #d: PersonalFilingMonitorDependencies;
  readonly #now: () => Date;
  #timer: ReturnType<typeof setInterval> | undefined;
  #active: Promise<void> | undefined;
  #controller: AbortController | undefined;
  #closed = false;
  constructor(dependencies: PersonalFilingMonitorDependencies) {
    this.#d = dependencies;
    this.#now = dependencies.now ?? (() => new Date());
  }
  start(): void {
    if (this.#closed || this.#timer !== undefined) return;
    this.#timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, 60_000);
    this.#timer.unref();
    void this.tick().catch(() => undefined);
  }
  async close(): Promise<void> {
    this.#closed = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    this.#controller?.abort();
    await this.#active;
  }
  tick(): Promise<void> {
    if (this.#closed) return Promise.resolve();
    if (this.#active) {
      const cfg = this.#config();
      if (
        cfg &&
        (!cfg.value.policy.enabled || !this.#bindingValid(cfg.value))
      ) {
        this.#controller?.abort();
        this.#recoverReserved(cfg.value);
        if (cfg.value.policy.enabled) this.#needsRebind(cfg);
      }
      return this.#active;
    }
    const controller = new AbortController();
    this.#controller = controller;
    const task = this.#run(controller).finally(() => {
      if (this.#controller === controller) this.#controller = undefined;
      this.#active = undefined;
    });
    this.#active = task;
    return task;
  }
  get(): PersonalFilingMonitorDto {
    const cfg = this.#config();
    if (!cfg)
      return {
        schemaVersion: "1.0.0",
        version: 0,
        policy: null,
        bindingStatus: "unconfigured",
        running: false,
        nextCheckAt: null,
        lastCheckAt: null,
        lastOutcome: null,
        coverageGap: false,
        issuers: [],
        inbox: [],
        unreadCount: 0,
      };
    if (cfg.value.transition || cfg.value.pendingAcknowledgement !== null)
      fail(503, "unavailable");
    const states = this.#states(cfg.value);
    const inbox = states
      .flatMap((s) => s.value.issuer?.inbox ?? [])
      .sort(
        (a, b) =>
          b.firstSeenAt.localeCompare(a.firstSeenAt) ||
          a.id.localeCompare(b.id),
      );
    return {
      schemaVersion: "1.0.0",
      version: cfg.version,
      policy: cfg.value.policy,
      bindingStatus: this.#bindingValid(cfg.value) ? "current" : "needs_rebind",
      running:
        cfg.value.policy.enabled &&
        this.#active !== undefined &&
        this.#controller?.signal.aborted === false,
      nextCheckAt: cfg.value.policy.enabled ? cfg.value.nextCheckAt : null,
      lastCheckAt: cfg.value.lastCheckAt,
      lastOutcome: cfg.value.lastOutcome,
      coverageGap:
        cfg.value.coverageGap ||
        states.some((s) => s.value.issuer?.coverageGap),
      issuers: states.flatMap((s) =>
        s.value.issuer ? [summary(s.value.issuer)] : [],
      ),
      inbox,
      unreadCount: inbox.filter((e) => e.readAt === null).length,
    };
  }
  configure(
    body: PersonalFilingMonitorConfigureDto,
    key: string,
  ): PersonalFilingMonitorDto {
    if (!isPersonalFilingMonitorConfigureDto(body))
      fail(400, "invalid_request");
    const old = this.#expected(body.expectedVersion);
    const bindings = this.#resolve(body.policy);
    const changed =
      old === null ||
      old.value.policy.catalogSnapshotSha256 !==
        body.policy.catalogSnapshotSha256 ||
      bindingsKey(old.value.bindings) !== bindingsKey(bindings);
    if (
      old &&
      (old.value.transition || old.value.pendingAcknowledgement !== null)
    )
      fail(409, "conflict");
    if (
      changed &&
      old &&
      this.#states(old.value).some(
        (s) => (s.value.issuer?.inbox.length ?? 0) > 0,
      )
    )
      fail(409, "history_requires_reset");
    const cfg: Config = {
      schemaVersion: 1,
      policy: structuredClone(body.policy),
      bindings,
      generation: randomUUID(),
      epoch: changed ? randomUUID() : old.value.epoch,
      transition: changed,
      nextCheckAt: body.policy.enabled ? this.#time() : null,
      lastCheckAt: old?.value.lastCheckAt ?? null,
      lastOutcome: old?.value.lastOutcome ?? null,
      coverageGap: old?.value.coverageGap ?? false,
      busyRetries: 0,
      pendingAcknowledgement: null,
    };
    this.#put(CONFIG_ID, old?.version ?? 0, cfg, key);
    this.#controller?.abort();
    if (old) this.#recoverReserved(old.value);
    if (changed) this.#finishTransition();
    else if (!body.policy.desktopNotifications) this.#cancelPending(cfg);
    return this.get();
  }
  pause(
    body: PersonalFilingMonitorCommandDto,
    key: string,
  ): PersonalFilingMonitorDto {
    if (!isPersonalFilingMonitorCommandDto(body)) fail(400, "invalid_request");
    const cfg = this.#expected(body.expectedVersion);
    if (!cfg) fail(409, "conflict");
    this.#put(
      CONFIG_ID,
      cfg.version,
      {
        ...cfg.value,
        generation: randomUUID(),
        policy: { ...cfg.value.policy, enabled: false },
        nextCheckAt: null,
      },
      key,
    );
    this.#controller?.abort();
    this.#recoverReserved(cfg.value);
    return this.get();
  }
  acknowledge(
    body: PersonalFilingMonitorAcknowledgeDto,
    key: string,
  ): PersonalFilingMonitorDto {
    if (!isPersonalFilingMonitorAcknowledgeDto(body))
      fail(400, "invalid_request");
    const cfg = this.#expected(body.expectedVersion);
    if (
      !cfg ||
      cfg.value.transition ||
      cfg.value.pendingAcknowledgement !== null
    )
      fail(409, "conflict");
    const states = this.#states(cfg.value),
      ids = new Set(body.eventIds);
    const known = new Set(
      states.flatMap((s) => s.value.issuer?.inbox.map((e) => e.id) ?? []),
    );
    if ([...ids].some((id) => !known.has(id))) fail(409, "conflict");
    this.#put(
      CONFIG_ID,
      cfg.version,
      {
        ...cfg.value,
        pendingAcknowledgement: {
          eventIds: [...body.eventIds],
          at: this.#time(),
        },
      },
      key,
    );
    this.#controller?.abort();
    this.#recoverReserved(cfg.value);
    this.#finishAcknowledgement();
    return this.get();
  }
  #finishAcknowledgement(): void {
    const cfg = this.#config();
    if (!cfg || cfg.value.pendingAcknowledgement === null) return;
    const states = this.#states(cfg.value),
      ids = new Set(cfg.value.pendingAcknowledgement.eventIds),
      now = cfg.value.pendingAcknowledgement.at;
    const known = new Set(
      states.flatMap((s) => s.value.issuer!.inbox.map((e) => e.id)),
    );
    if ([...ids].some((id) => !known.has(id))) fail(503, "unavailable");
    for (let i = 0; i < states.length; i++) {
      const s = states[i]!,
        issuer = s.value.issuer!;
      if (!issuer.inbox.some((e) => ids.has(e.id) && e.readAt === null))
        continue;
      this.#putSlot(i, s, {
        ...issuer,
        inbox: issuer.inbox.map((e) =>
          ids.has(e.id)
            ? {
                ...e,
                readAt: e.readAt ?? (now > e.firstSeenAt ? now : e.firstSeenAt),
                delivery:
                  e.delivery.status === "pending"
                    ? {
                        status: "disabled",
                        attemptedAt: null,
                        completedAt: null,
                        shownObserved: false,
                      }
                    : e.delivery,
              }
            : e,
        ),
      });
    }
    this.#put(CONFIG_ID, cfg.version, {
      ...cfg.value,
      pendingAcknowledgement: null,
    });
  }
  reset(
    body: PersonalFilingMonitorCommandDto,
    key: string,
  ): PersonalFilingMonitorDto {
    if (!isPersonalFilingMonitorCommandDto(body)) fail(400, "invalid_request");
    const cfg = this.#expected(body.expectedVersion);
    if (!cfg || cfg.value.policy.enabled) fail(409, "conflict");
    this.#put(
      CONFIG_ID,
      cfg.version,
      {
        ...cfg.value,
        generation: randomUUID(),
        epoch: randomUUID(),
        transition: true,
        lastCheckAt: null,
        lastOutcome: null,
        coverageGap: false,
        busyRetries: 0,
        nextCheckAt: null,
        pendingAcknowledgement: null,
      },
      key,
    );
    this.#controller?.abort();
    this.#finishTransition();
    return this.get();
  }
  async #run(controller: AbortController): Promise<void> {
    this.#finishTransition();
    this.#finishAcknowledgement();
    let cfg = this.#config();
    if (!cfg) return;
    this.#recoverReserved(cfg.value);
    if (!cfg.value.policy.desktopNotifications) this.#cancelPending(cfg.value);
    if (!cfg.value.policy.enabled || controller.signal.aborted) return;
    const generation = cfg.value.generation;
    if (!this.#bindingValid(cfg.value)) {
      this.#needsRebind(cfg);
      return;
    }
    const now = this.#now();
    if (
      cfg.value.nextCheckAt !== null &&
      Date.parse(cfg.value.nextCheckAt) <= now.getTime()
    ) {
      const wasSeeded = this.#states(cfg.value).every(
        (s) => s.value.issuer?.seeded,
      );
      const throughDate = now.toISOString().slice(0, 10),
        fromDate = new Date(Date.parse(throughDate) - 29 * DAY)
          .toISOString()
          .slice(0, 10);
      this.#put(CONFIG_ID, cfg.version, {
        ...cfg.value,
        lastCheckAt: now.toISOString(),
      });
      try {
        const results = await this.#d.provider.loadFilings(
          cfg.value.bindings.map((b) => b.cik),
          fromDate,
          throughDate,
          controller.signal,
        );
        if (!this.#current(generation, controller)) return;
        cfg = this.#config()!;
        const request = requestFor(cfg.value.policy),
          watchlist = readBoundWatchlist(
            this.#d.vault,
            this.#d.catalog,
            request,
          );
        assembleResponse(
          request,
          watchlist.memberships.length,
          new Map(cfg.value.bindings.map((b) => [b.cik, b.listings])),
          results,
          fromDate,
          throughDate,
          now.toISOString(),
        );
        this.#validateResults(results, cfg.value, now.toISOString());
        let partial = false;
        for (let i = 0; i < cfg.value.bindings.length; i++) {
          if (!this.#current(generation, controller)) return;
          const result = results.find(
            (r) => r.cik === cfg!.value.bindings[i]!.cik,
          )!;
          partial =
            this.#commitIssuer(
              i,
              cfg.value,
              result,
              fromDate,
              now.toISOString(),
            ) || partial;
        }
        cfg = this.#config()!;
        this.#put(CONFIG_ID, cfg.version, {
          ...cfg.value,
          lastOutcome: partial ? "partial" : wasSeeded ? "checked" : "seeded",
          busyRetries: 0,
          nextCheckAt: nextFilingMonitorCheck(now, cfg.value.policy),
          coverageGap: cfg.value.coverageGap || partial,
        });
      } catch (error) {
        if (!this.#current(generation, controller)) return;
        cfg = this.#config()!;
        const busy =
          error instanceof PersonalSecFilingsProviderError &&
          error.code === "busy";
        const retry = busy && cfg.value.busyRetries < 2;
        this.#put(CONFIG_ID, cfg.version, {
          ...cfg.value,
          lastOutcome: busy ? "provider_busy" : "provider_unavailable",
          busyRetries: retry ? cfg.value.busyRetries + 1 : 0,
          nextCheckAt: retry
            ? new Date(this.#now().getTime() + 300_000).toISOString()
            : nextFilingMonitorCheck(now, cfg.value.policy),
          coverageGap: true,
        });
      }
    }
    if (this.#current(generation, controller))
      await this.#deliver(generation, controller);
  }
  #commitIssuer(
    index: number,
    cfg: Config,
    result: PersonalSecIssuerFilingsDto,
    fromDate: string,
    now: string,
  ): boolean {
    const saved = this.#slot(index, cfg),
      old = saved.value.issuer!;
    if (result.status !== "available" || result.truncated) {
      this.#putSlot(index, saved, {
        ...old,
        status: result.truncated ? "truncated" : "unavailable",
        coverageGap: true,
      });
      return true;
    }
    const retained = old.inbox.filter(
      (e) =>
        !(
          e.readAt !== null &&
          settled(e.delivery.status) &&
          Date.parse(e.firstSeenAt) < Date.parse(now) - 30 * DAY
        ),
    );
    const needed = new Set(retained.map((e) => e.filing.accessionNumber));
    const seen = old.seen.filter(
      (e) => e.filingDate >= fromDate || needed.has(e.accessionNumber),
    );
    const keys = new Set(seen.map((e) => e.accessionNumber));
    for (const filing of result.filings) {
      if (keys.has(filing.accessionNumber)) continue;
      keys.add(filing.accessionNumber);
      seen.push({
        accessionNumber: filing.accessionNumber,
        filingDate: filing.filingDate,
      });
      if (old.seeded)
        retained.push({
          id: `${filing.cik}:${filing.accessionNumber}`,
          filing: { ...filing },
          listings: old.listings,
          firstSeenAt: now,
          readAt: null,
          delivery: {
            status: cfg.policy.desktopNotifications ? "pending" : "disabled",
            attemptedAt: null,
            completedAt: null,
            shownObserved: false,
          },
        });
    }
    const next: Issuer = {
      ...old,
      seeded: true,
      lastCompleteAt: now,
      status: "complete",
      coverageGap:
        old.coverageGap ||
        (old.lastCompleteAt !== null &&
          Date.parse(now) - Date.parse(old.lastCompleteAt) > 30 * DAY),
      seen,
      inbox: retained,
    };
    if (
      seen.length > LIMITS.seenPerIssuer ||
      retained.length > LIMITS.inboxPerIssuer ||
      maximumTransitionBytes({ ...saved.value, issuer: next }) >
        LIMITS.issuerBytes
    ) {
      this.#putSlot(index, saved, {
        ...old,
        status: "overflow",
        coverageGap: true,
      });
      return true;
    }
    this.#putSlot(index, saved, next);
    return false;
  }
  async #deliver(
    generation: string,
    controller: AbortController,
  ): Promise<void> {
    let cfg = this.#config()!;
    if (
      !cfg.value.policy.desktopNotifications ||
      filingMonitorQuiet(this.#now(), cfg.value.policy)
    )
      return;
    const reserved: { index: number; ids: Set<string> }[] = [];
    const now = this.#time();
    for (let i = 0; i < cfg.value.bindings.length; i++) {
      if (!this.#current(generation, controller)) return;
      const saved = this.#slot(i, cfg.value),
        issuer = saved.value.issuer!;
      const ids = new Set(
        issuer.inbox
          .filter((e) => e.delivery.status === "pending" && e.readAt === null)
          .map((e) => e.id),
      );
      if (!ids.size) continue;
      this.#putSlot(i, saved, {
        ...issuer,
        inbox: issuer.inbox.map((e) =>
          ids.has(e.id)
            ? {
                ...e,
                delivery: {
                  status: "reserved",
                  attemptedAt: now > e.firstSeenAt ? now : e.firstSeenAt,
                  completedAt: null,
                  shownObserved: false,
                },
              }
            : e,
        ),
      });
      reserved.push({ index: i, ids });
    }
    if (!reserved.length || !this.#current(generation, controller)) return;
    let status: PersonalFilingMonitorInboxDto["delivery"]["status"] =
      "delivery_uncertain";
    let shownObserved = false;
    try {
      const result = await this.#d.notifications.notify(controller.signal);
      shownObserved = result.shown === true && !result.protocolError;
      if (
        [
          "not_submitted",
          "submission_unconfirmed",
          "observed_shown",
          "delivery_uncertain",
        ].includes(result.status)
      )
        status = result.status;
      if (
        result.status !== "not_submitted" &&
        (result.helperFailed ||
          result.timedOut ||
          result.aborted ||
          result.protocolError ||
          !result.processClosed ||
          result.exitCode !== 0 ||
          !result.cleanup)
      )
        status = "delivery_uncertain";
      if (
        (status === "observed_shown" && !shownObserved) ||
        (status !== "observed_shown" &&
          status !== "delivery_uncertain" &&
          shownObserved) ||
        (status === "not_submitted" && result.submissionAttempted)
      )
        status = "delivery_uncertain";
    } catch {
      /* Reserved attempts stay consumed when the adapter fails. */
    }
    if (!this.#current(generation, controller)) return;
    cfg = this.#config()!;
    for (const { index, ids } of reserved) {
      const saved = this.#slot(index, cfg.value),
        issuer = saved.value.issuer!;
      this.#putSlot(index, saved, {
        ...issuer,
        inbox: issuer.inbox.map((e) =>
          ids.has(e.id) && e.delivery.status === "reserved"
            ? {
                ...e,
                delivery: {
                  ...e.delivery,
                  status,
                  shownObserved,
                  completedAt: later(this.#time(), e.delivery.attemptedAt!),
                },
              }
            : e,
        ),
      });
    }
  }
  #current(generation: string, controller: AbortController): boolean {
    if (this.#closed || controller.signal.aborted) return false;
    const cfg = this.#config();
    if (
      !cfg ||
      !cfg.value.policy.enabled ||
      cfg.value.generation !== generation ||
      cfg.value.transition ||
      cfg.value.pendingAcknowledgement !== null
    )
      return false;
    if (!this.#bindingValid(cfg.value)) {
      controller.abort();
      this.#recoverReserved(cfg.value);
      this.#needsRebind(cfg);
      return false;
    }
    return true;
  }
  #needsRebind(cfg: Saved<Config>): void {
    if (cfg.value.lastOutcome === "needs_rebind") return;
    this.#put(CONFIG_ID, cfg.version, {
      ...cfg.value,
      lastOutcome: "needs_rebind",
      coverageGap: true,
    });
  }
  #recoverReserved(cfg: Config): void {
    if (cfg.transition) return;
    for (let i = 0; i < cfg.bindings.length; i++) {
      const saved = this.#slot(i, cfg),
        issuer = saved.value.issuer!;
      if (issuer.inbox.some((e) => e.delivery.status === "reserved"))
        this.#putSlot(i, saved, {
          ...issuer,
          inbox: issuer.inbox.map((e) =>
            e.delivery.status === "reserved"
              ? {
                  ...e,
                  delivery: {
                    ...e.delivery,
                    status: "delivery_uncertain",
                    completedAt: later(this.#time(), e.delivery.attemptedAt!),
                  },
                }
              : e,
          ),
        });
    }
  }
  #cancelPending(cfg: Config): void {
    for (let i = 0; i < cfg.bindings.length; i++) {
      const saved = this.#slot(i, cfg),
        issuer = saved.value.issuer!;
      if (issuer.inbox.some((e) => e.delivery.status === "pending"))
        this.#putSlot(i, saved, {
          ...issuer,
          inbox: issuer.inbox.map((e) =>
            e.delivery.status === "pending"
              ? {
                  ...e,
                  delivery: {
                    status: "disabled",
                    attemptedAt: null,
                    completedAt: null,
                    shownObserved: false,
                  },
                }
              : e,
          ),
        });
    }
  }
  #finishTransition(): void {
    const cfg = this.#config();
    if (!cfg?.value.transition) return;
    for (let i = 0; i < 20; i++) {
      const old = this.#record(slotId(i)),
        bindingStatus = cfg.value.bindings[i];
      const payload: Slot = {
        schemaVersion: 1,
        epoch: cfg.value.epoch,
        issuer: bindingStatus
          ? {
              ...bindingStatus,
              seeded: false,
              lastCompleteAt: null,
              status: "unseeded",
              coverageGap: false,
              seen: [],
              inbox: [],
            }
          : null,
      };
      // Replaying an interrupted reset never restores prior-generation history.
      this.#put(slotId(i), old?.version ?? 0, payload);
    }
    this.#put(CONFIG_ID, cfg.version, { ...cfg.value, transition: false });
  }
  #validateResults(
    results: readonly PersonalSecIssuerFilingsDto[],
    cfg: Config,
    now: string,
  ): void {
    for (const r of results) {
      if (
        ![
          "available",
          "not_covered",
          "rate_limited",
          "upstream_unavailable",
          "invalid_response",
        ].includes(r.status)
      )
        fail(503, "unavailable");
      const bindingStatus = cfg.bindings.find((b) => b.cik === r.cik)!;
      for (const f of r.filings)
        if (
          !isPersonalFilingMonitorInboxDto({
            id: `${f.cik}:${f.accessionNumber}`,
            filing: f,
            listings: bindingStatus.listings,
            firstSeenAt: now,
            readAt: null,
            delivery: {
              status: "disabled",
              attemptedAt: null,
              completedAt: null,
              shownObserved: false,
            },
          })
        )
          fail(503, "unavailable");
    }
  }
  #bindingValid(cfg: Config): boolean {
    try {
      return (
        bindingsKey(this.#resolve(cfg.policy)) === bindingsKey(cfg.bindings)
      );
    } catch {
      return false;
    }
  }
  #resolve(policy: PersonalFilingMonitorPolicyDto): Binding[] {
    try {
      if (policy.catalogSnapshotSha256 !== this.#d.catalog.snapshotSha256)
        fail(409, "conflict");
      const request = requestFor(policy),
        watchlist = readBoundWatchlist(this.#d.vault, this.#d.catalog, request);
      return [...resolveSelectedListings(this.#d.catalog, watchlist, request)]
        .map(([cik, listings]) => ({
          cik,
          listings: [...listings].sort((a, b) =>
            a.listingId.localeCompare(b.listingId),
          ),
        }))
        .sort((a, b) => a.cik.localeCompare(b.cik));
    } catch {
      fail(409, "conflict");
    }
  }
  #expected(version: number): Saved<Config> | null {
    if (this.#closed) fail(503, "unavailable");
    const cfg = this.#config();
    if ((cfg?.version ?? 0) !== version) fail(409, "conflict");
    return cfg;
  }
  #config(): Saved<Config> | null {
    const r = this.#record(CONFIG_ID);
    if (!r) return null;
    const p = r.payload as unknown as Config;
    if (
      !p ||
      !exactKeys(
        p,
        "schemaVersion,policy,bindings,generation,epoch,transition,nextCheckAt,lastCheckAt,lastOutcome,coverageGap,busyRetries,pendingAcknowledgement",
      ) ||
      p.schemaVersion !== 1 ||
      !isPersonalFilingMonitorPolicyDto(p.policy) ||
      !Array.isArray(p.bindings) ||
      p.bindings.length < 1 ||
      p.bindings.length > 20 ||
      typeof p.generation !== "string" ||
      !uuid(p.generation) ||
      typeof p.epoch !== "string" ||
      !uuid(p.epoch) ||
      typeof p.transition !== "boolean" ||
      !validInstant(p.nextCheckAt) ||
      !validInstant(p.lastCheckAt) ||
      (p.policy.enabled ? p.nextCheckAt === null : p.nextCheckAt !== null) ||
      (p.lastOutcome !== null &&
        ![
          "seeded",
          "checked",
          "partial",
          "provider_busy",
          "provider_unavailable",
          "needs_rebind",
        ].includes(p.lastOutcome)) ||
      (p.pendingAcknowledgement !== null &&
        (!exactKeys(p.pendingAcknowledgement, "eventIds,at") ||
          !isPersonalFilingMonitorAcknowledgeDto({
            schemaVersion: "1.0.0",
            expectedVersion: 1,
            eventIds: p.pendingAcknowledgement.eventIds,
          }) ||
          p.pendingAcknowledgement.at === null ||
          !validInstant(p.pendingAcknowledgement.at))) ||
      typeof p.coverageGap !== "boolean" ||
      !Number.isInteger(p.busyRetries) ||
      p.busyRetries < 0 ||
      p.busyRetries > 2 ||
      p.bindings.some(
        (b) =>
          !isPersonalFilingMonitorIssuerDto({
            ...b,
            seeded: false,
            lastCompleteAt: null,
            status: "unseeded",
            coverageGap: false,
          }),
      )
    )
      fail(503, "unavailable");
    const listingIds = p.bindings.flatMap((b) =>
      b.listings.map((l) => l.listingId),
    );
    if (
      new Set(p.bindings.map((b) => b.cik)).size !== p.bindings.length ||
      new Set(listingIds).size !== listingIds.length ||
      listingIds.length !== p.policy.listingIds.length ||
      listingIds.some((id) => !p.policy.listingIds.includes(id))
    )
      fail(503, "unavailable");
    return { version: r.version, value: p };
  }
  #states(cfg: Config): Saved<Slot>[] {
    return cfg.bindings.map((_b, i) => this.#slot(i, cfg));
  }
  #slot(index: number, cfg: Config): Saved<Slot> {
    const r = this.#record(slotId(index)),
      p = r?.payload as unknown as Slot;
    if (
      !r ||
      !p ||
      !exactKeys(p, "schemaVersion,epoch,issuer") ||
      p.schemaVersion !== 1 ||
      p.epoch !== cfg.epoch ||
      !p.issuer ||
      !exactKeys(
        p.issuer,
        "cik,listings,seeded,lastCompleteAt,status,coverageGap,seen,inbox",
      ) ||
      !isPersonalFilingMonitorIssuerDto(summary(p.issuer)) ||
      bindingsKey([{ cik: p.issuer.cik, listings: p.issuer.listings }]) !==
        bindingsKey([cfg.bindings[index]!]) ||
      !Array.isArray(p.issuer.seen) ||
      p.issuer.seen.length > 1_000 ||
      p.issuer.seen.some(
        (s) =>
          !exactKeys(s, "accessionNumber,filingDate") ||
          !/^\d{10}-\d{2}-\d{6}$/u.test(s.accessionNumber) ||
          !validDay(s.filingDate),
      ) ||
      new Set(p.issuer.seen.map((s) => s.accessionNumber)).size !==
        p.issuer.seen.length ||
      !Array.isArray(p.issuer.inbox) ||
      p.issuer.inbox.length > 50 ||
      p.issuer.inbox.some(
        (e) =>
          !isPersonalFilingMonitorInboxDto(e) ||
          e.filing.cik !== p.issuer!.cik ||
          listingsKey(e.listings) !== listingsKey(p.issuer!.listings),
      ) ||
      new Set(p.issuer.inbox.map((e) => e.id)).size !== p.issuer.inbox.length ||
      (!p.issuer.seeded &&
        (p.issuer.seen.length !== 0 || p.issuer.inbox.length !== 0)) ||
      p.issuer.inbox.some(
        (e) =>
          !p.issuer!.seen.some(
            (s) =>
              s.accessionNumber === e.filing.accessionNumber &&
              s.filingDate === e.filing.filingDate,
          ),
      ) ||
      Buffer.byteLength(JSON.stringify(p)) > LIMITS.issuerBytes
    )
      fail(503, "unavailable");
    return { version: r.version, value: p };
  }
  #record(id: string): LocalResearchRecord | null {
    try {
      return this.#d.vault.getRecord("job_state", id);
    } catch (e) {
      if (e instanceof LocalResearchVaultError && e.code === "VAULT_NOT_FOUND")
        return null;
      throw e;
    }
  }
  #putSlot(index: number, saved: Saved<Slot>, issuer: Issuer): void {
    this.#put(slotId(index), saved.version, { ...saved.value, issuer });
  }
  #put(
    id: string,
    version: number,
    value: Config | Slot,
    key: string = randomUUID(),
  ): void {
    this.#d.vault.putRecord({
      kind: "job_state",
      id,
      expectedVersion: version,
      idempotencyKey: key,
      payload: value as unknown as JsonValue,
    });
  }
  #time(): string {
    return this.#now().toISOString();
  }
}
function requestFor(
  policy: PersonalFilingMonitorPolicyDto,
): PersonalWatchlistFilingsRequestDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: policy.catalogSnapshotSha256,
    watchlistVersion: policy.watchlistVersion,
    listingIds: policy.listingIds,
    lookbackDays: 30,
  };
}
function summary(issuer: Issuer): PersonalFilingMonitorIssuerDto {
  return {
    cik: issuer.cik,
    listings: issuer.listings,
    seeded: issuer.seeded,
    lastCompleteAt: issuer.lastCompleteAt,
    status: issuer.status,
    coverageGap: issuer.coverageGap,
  };
}
function slotId(index: number): string {
  return `${SLOT_PREFIX}${String(index).padStart(2, "0")}`;
}
function later(left: string, right: string): string {
  return left > right ? left : right;
}
function exactKeys(value: unknown, keys: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === keys.split(",").sort().join(",")
  );
}
function uuid(value: string): boolean {
  return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
}
function listingsKey(
  listings: readonly PersonalWatchlistFilingListingDto[],
): string {
  return JSON.stringify(
    listings.map((l) => [l.listingId, l.symbol, l.issuerName]),
  );
}
function bindingsKey(bindings: readonly Binding[]): string {
  return JSON.stringify(bindings.map((b) => [b.cik, listingsKey(b.listings)]));
}
function maximumTransitionBytes(slot: Slot): number {
  if (!slot.issuer) return Buffer.byteLength(JSON.stringify(slot));
  const stamp = "9999-12-31T23:59:59.999Z";
  const inbox = slot.issuer.inbox.map((e) => ({
    ...e,
    readAt: stamp,
    delivery: {
      status: "submission_unconfirmed",
      attemptedAt: stamp,
      completedAt: stamp,
      shownObserved: false,
    },
  }));
  return (
    Buffer.byteLength(
      JSON.stringify({ ...slot, issuer: { ...slot.issuer, inbox } }),
    ) + 128
  );
}
function settled(
  status: PersonalFilingMonitorInboxDto["delivery"]["status"],
): boolean {
  return [
    "disabled",
    "not_submitted",
    "submission_unconfirmed",
    "observed_shown",
  ].includes(status);
}
function validInstant(value: unknown): boolean {
  return (
    value === null ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value)
  );
}
function validDay(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    validInstant(`${value}T00:00:00.000Z`)
  );
}
function fail(
  status: 400 | 409 | 503,
  code: PersonalFilingMonitorError["code"],
): never {
  throw new PersonalFilingMonitorError(status, code);
}
