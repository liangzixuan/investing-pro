import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketDataRangeDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type * as Api from "../../lib/personal-workspace-api";
import {
  COMPANY_REQUEST_SPACING_MILLISECONDS,
  useCompanyOverviewData,
  type CompanyOverviewDataContext,
} from "./useCompanyOverviewData";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{
    dependencies: readonly unknown[] | undefined;
    setup: () => void | (() => void);
    cleanup: (() => void) | undefined;
  }> = [];
  const pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  let scheduledRender = false;
  return {
    beginRender() {
      scheduledRender = false;
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      effects.splice(0);
      pending.splice(0);
      stateIndex = refIndex = effectIndex = 0;
      scheduledRender = false;
    },
    commit() {
      pending.splice(0).forEach((run) => run());
    },
    replayCommittedEffects() {
      if (pending.length !== 0)
        throw new Error("Commit effects before replaying their lifetime.");
      effects.forEach((effect) => effect.cleanup?.());
      effects.forEach((effect) => {
        effect.cleanup = effect.setup() ?? undefined;
      });
    },
    hasScheduledRender() {
      return scheduledRender;
    },
    unmount() {
      pending.splice(0);
      effects.forEach((effect) => effect.cleanup?.());
    },
    useState(this: void, initial: unknown) {
      const index = stateIndex++;
      if (!(index in states))
        states[index] =
          typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      return [
        states[index],
        (next: unknown) => {
          const value =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(states[index])
              : next;
          if (!Object.is(value, states[index])) scheduledRender = true;
          states[index] = value;
        },
      ];
    },
    useRef<T>(this: void, initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useEffect(
      this: void,
      callback: () => void | (() => void),
      dependencies?: readonly unknown[],
    ) {
      const index = effectIndex++;
      const old = effects[index];
      if (
        old !== undefined &&
        dependencies !== undefined &&
        old.dependencies !== undefined &&
        dependencies.length === old.dependencies.length &&
        dependencies.every((value, i) => Object.is(value, old.dependencies![i]))
      )
        return;
      const effect = {
        dependencies: dependencies?.slice(),
        setup: callback,
        cleanup: old?.cleanup,
      };
      effects[index] = effect;
      pending.push(() => {
        effect.cleanup?.();
        effect.cleanup = callback() ?? undefined;
      });
    },
  };
});
const client = vi.hoisted(() => ({
  market: vi.fn<typeof Api.fetchPersonalMarketOverview>(),
  annual: vi.fn<typeof Api.fetchPersonalAnnualFinancials>(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: hooks.useState,
  useRef: hooks.useRef,
  useEffect: hooks.useEffect,
}));
vi.mock("../../lib/personal-workspace-api", async () => ({
  ...(await vi.importActual<typeof Api>("../../lib/personal-workspace-api")),
  fetchPersonalMarketOverview: client.market,
  fetchPersonalAnnualFinancials: client.annual,
}));
const digest = `sha256:${"a".repeat(64)}`;
const startTime = Date.parse("2026-09-25T05:00:00Z");
const activity = vi.fn<CompanyOverviewDataContext["onActivityStart"]>();
const complete = vi.fn<() => boolean>();
const unavailable = vi.fn();
const rangeChanged = vi.fn();
const unexpectedFetch = vi.fn();
let context: CompanyOverviewDataContext;
let current = true;
let active = true;
beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(startTime);
  current = active = true;
  complete.mockReset().mockReturnValue(true);
  activity.mockReset().mockImplementation(() => complete);
  client.market
    .mockReset()
    .mockImplementation((request) =>
      Promise.resolve(overview(request.symbol, request.range)),
    );
  client.annual
    .mockReset()
    .mockImplementation((request) => Promise.resolve(annual(request.symbol)));
  unexpectedFetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", unexpectedFetch);
  context = {
    selection: selection(),
    identityKey: "full-ALFA",
    active: true,
    enabled: true,
    catalogSnapshotSha256: digest,
    sessionKey: 1,
    isCurrent: () => current,
    isActive: () => active,
    providerStatus: {
      profile: "personal_single_user_local_market_data",
      provider: overview().provider,
      schemaVersion: "1.0.0",
      status: "configured",
    },
    onActivityStart: activity,
    onSessionUnavailable: unavailable,
    onMarketRangeChange: rangeChanged,
  };
});
afterEach(() => {
  hooks.unmount();
  expect(unexpectedFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("shared company overview coordination", () => {
  it("explains a deferred panel action without blocking a different eligible summary domain", async () => {
    await render().loadMarketData("1m");
    await render().loadMarketData("1m");
    const view = render();
    expect(view).toMatchObject({
      canLoad: true,
      action: "load",
      overviewErrorCode: "refresh_deferred",
      deferredRequestAt: startTime + COMPANY_REQUEST_SPACING_MILLISECONDS,
      nextLoadAt: null,
    });
    expect(view.deferralMessage).toContain("last requested action");
    expect(view.deferralMessage).toContain(
      new Date(
        startTime + COMPANY_REQUEST_SPACING_MILLISECONDS,
      ).toLocaleTimeString(),
    );
    await view.loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).toHaveBeenCalledTimes(1);
    expect(render().deferredRequestAt).toBeNull();
  });
  it("expires rejected-action feedback without background IO and clears it on reset", async () => {
    await render().loadMarketData("1m");
    await render().loadMarketData("1m");
    expect(render().deferralMessage).not.toBeNull();
    await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
    expect(render().deferralMessage).toBeNull();
    expect(client.market).toHaveBeenCalledTimes(1);
    await render().loadMarketData("1m");
    await render().loadMarketData("1m");
    const prior = render();
    expect(prior.deferredRequestAt).not.toBeNull();
    prior.reset(selection(), "full-ALFA");
    expect(render().deferredRequestAt).toBeNull();
  });
  it("retires data and pending work when only the full share-class identity changes", async () => {
    await render().loadCompanyOverview();
    const prior = render();
    context = { ...context, identityKey: "full-ALFA-new-share-class" };
    expect(render()).toMatchObject({
      marketOverview: null,
      annualFinancials: null,
    });
    expect(prior.admitMarketSnapshot(selection(), overview())).toBe(false);
    await prior.loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(1);
    await render().loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(2);
  });
  it("requires the next full identity and clears same-seven-field data before synchronous admission", async () => {
    await render().loadCompanyOverview();
    const old = render();
    expect(old.reset(selection())).toBe(false);
    expect(old.reset(selection(), "full-ALFA-new-security")).toBe(true);
    expect(old.admitMarketSnapshot(selection(), overview())).toBe(true);
    context = { ...context, identityKey: "full-ALFA-new-security" };
    expect(render()).toMatchObject({
      marketOverview: overview(),
      annualFinancials: null,
    });
    await render().loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).toHaveBeenCalledTimes(2);
  });

  it("retires pending work across a synchronous Back and same-company return before rerender", async () => {
    await render().loadAnnualFinancials();
    const held = deferred<PersonalMarketOverviewDto>();
    client.market.mockReturnValueOnce(held.promise);
    const old = render();
    const pending = old.loadMarketData("1m");
    active = false;
    expect(old.cancelPending()).toBe(true);
    active = true;
    held.resolve(overview());
    await pending;
    await old.loadCompanyOverview();
    expect(render()).toMatchObject({
      marketOverview: null,
      annualFinancials: annual(),
      busy: false,
    });
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.market.mock.calls[0]![1]?.aborted).toBe(true);
  });
  it("uses current provider readiness when a former panel handler is retained", async () => {
    const old = render();
    context = {
      ...context,
      providerStatus: { ...context.providerStatus!, status: "not_configured" },
    };
    render();
    await old.loadMarketData("1m");
    expect(client.market).not.toHaveBeenCalled();
    expect(render().marketErrorCode).toBe("not_configured");
  });
  it("retains actual EOD history metadata while accepting an independently successful quote on refresh", async () => {
    await render().loadMarketData("1m");
    await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
    const quote = {
      status: "available" as const,
      value: {
        change: "1",
        changePercent: "1",
        currency: "USD" as const,
        freshness: "current" as const,
        ingestedAt: "2026-09-25T05:15:00.000Z",
        kind: "derived_realtime_reference" as const,
        previousClose: "100",
        price: "101",
        sourceTime: "2026-09-24T20:00:00.000Z",
      },
    };
    client.market.mockResolvedValueOnce({
      ...overview(),
      ingestedAt: "2026-09-25T05:15:00.000Z",
      history: { status: "unavailable", reason: "upstream_unavailable" },
      quote,
    });
    await render().loadMarketData("1m");
    expect(render().marketOverview).toEqual({ ...overview(), quote });
    expect(render().marketErrorCode).toBe("provider_unavailable");
  });
  it.each(["price", "annual"] as const)(
    "clears retained domains and exposes a %s catalog conflict",
    async (domain) => {
      await render().loadCompanyOverview();
      await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
      (domain === "price"
        ? client.market
        : client.annual
      ).mockRejectedValueOnce(new PersonalWorkspaceApiError("conflict"));
      await render().loadCompanyOverview();
      expect(render()).toMatchObject({
        marketOverview: null,
        annualFinancials: null,
        overviewErrorCode: "conflict",
        marketErrorCode: domain === "price" ? "conflict" : null,
        annualFinancialsErrorCode: domain === "annual" ? "conflict" : null,
        busy: false,
      });
      expect(client.annual).toHaveBeenCalledTimes(domain === "price" ? 1 : 2);
    },
  );
  it("rejects response range mismatches and keeps independent annual results", async () => {
    client.market.mockResolvedValueOnce(overview("ALFA", "1y"));
    await render().loadCompanyOverview();
    expect(render()).toMatchObject({
      marketOverview: null,
      marketErrorCode: "invalid_response",
      annualFinancials: annual(),
    });
  });
  it("clears replaced range data while loading and preserves annual when range fails", async () => {
    await render().loadCompanyOverview();
    const held = deferred<PersonalMarketOverviewDto>();
    client.market.mockReturnValueOnce(held.promise);
    const pending = render().loadMarketData("5y");
    expect(render()).toMatchObject({
      marketOverview: null,
      marketRange: "5y",
      annualFinancials: annual(),
      busy: true,
    });
    held.reject(new PersonalWorkspaceApiError("provider_unavailable"));
    await pending;
    expect(render()).toMatchObject({
      marketOverview: null,
      marketRange: "5y",
      annualFinancials: annual(),
      marketErrorCode: "provider_unavailable",
    });
  });
  it("does not publish data after unmount even when an abort-insensitive client resolves", async () => {
    const held = deferred<PersonalMarketOverviewDto>();
    client.market.mockReturnValueOnce(held.promise);
    const pending = render().loadCompanyOverview();
    hooks.unmount();
    held.resolve(overview());
    await pending;
    expect(client.market.mock.calls[0]![1]?.aborted).toBe(true);
    expect(client.annual).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("stays idle on fresh entry, StrictMode replay, remount effects and timer advancement", async () => {
    const old = render();
    hooks.replayCommittedEffects();
    await old.loadCompanyOverview();
    render();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(client.market).not.toHaveBeenCalled();
    expect(client.annual).not.toHaveBeenCalled();
    expect(render()).toMatchObject({
      marketOverview: null,
      annualFinancials: null,
      busy: false,
      action: "load",
      canLoad: true,
    });
  });
  it("loads EOD then annual once and deduplicates all summary/panel controls", async () => {
    const price = deferred<PersonalMarketOverviewDto>();
    const financials = deferred<PersonalAnnualFinancialsDto>();
    client.market.mockReturnValue(price.promise);
    client.annual.mockReturnValue(financials.promise);
    const view = render();
    const pending = view.loadCompanyOverview();
    await view.loadCompanyOverview();
    await view.loadMarketData("1y");
    await view.loadAnnualFinancials();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).not.toHaveBeenCalled();
    expect(client.market.mock.calls[0]![0]).toEqual({
      includeQuote: false,
      listingId: "listing-ALFA",
      symbol: "ALFA",
      range: "1m",
    });
    expect(render()).toMatchObject({ busy: true, activeDomain: "price" });
    price.resolve(overview());
    await flush();
    expect(render()).toMatchObject({
      busy: true,
      activeDomain: "annual",
      marketOverview: overview(),
    });
    expect(client.annual).toHaveBeenCalledTimes(1);
    financials.resolve(annual());
    await pending;
    expect(render()).toMatchObject({
      busy: false,
      marketOverview: overview(),
      annualFinancials: annual(),
      action: "refresh",
      canLoad: false,
      nextLoadAt: startTime + COMPANY_REQUEST_SPACING_MILLISECONDS,
    });
    expect(activity).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(2);
  });
  it("admits a synchronous next-company Markets snapshot before parent rerender, then loads only annual", async () => {
    context = { ...context, selection: null, identityKey: null, active: false };
    active = false;
    const view = render();
    const next = selection("BRIO");
    expect(view.reset(next, "full-BRIO")).toBe(true);
    expect(view.admitMarketSnapshot(next, overview("BRIO"))).toBe(true);
    context = {
      ...context,
      selection: next,
      identityKey: "full-BRIO",
      active: true,
    };
    active = true;
    expect(render().marketOverview).toEqual(overview("BRIO"));
    await render().loadCompanyOverview();
    expect(client.market).not.toHaveBeenCalled();
    expect(client.annual).toHaveBeenCalledTimes(1);
    expect(render().annualFinancials).toEqual(annual("BRIO"));
  });
  it("does not replace already loaded history when returning through a cached Markets row", async () => {
    await render().loadMarketData("1y");
    const view = render();
    expect(view.reset(selection(), "full-ALFA")).toBe(true);
    expect(view.admitMarketSnapshot(selection(), overview())).toBe(true);
    expect(render()).toMatchObject({
      marketRange: "1y",
      marketOverview: overview("ALFA", "1y"),
    });
    await render().loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).toHaveBeenCalledTimes(1);
  });
  it("reuses annual loaded through the panel and requests only missing 1M EOD", async () => {
    await render().loadAnnualFinancials();
    await render().loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).toHaveBeenCalledTimes(1);
    expect(render().marketRange).toBe("1m");
  });
  it("retains cached domains on Back and does no IO on return", async () => {
    await render().loadCompanyOverview();
    const old = render();
    context = { ...context, active: false };
    active = false;
    render();
    await old.loadMarketData("1y");
    context = { ...context, active: true };
    active = true;
    expect(render()).toMatchObject({
      marketOverview: overview(),
      annualFinancials: annual(),
      busy: false,
    });
    await flush();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).toHaveBeenCalledTimes(1);
  });
  it("cancels a pending second domain on Back before rerender, retaining only completed EOD", async () => {
    const held = deferred<PersonalAnnualFinancialsDto>();
    client.annual.mockReturnValue(held.promise);
    const pending = render().loadCompanyOverview();
    await flush();
    active = false;
    held.resolve(annual());
    await pending;
    expect(client.annual.mock.calls[0]![1]?.aborted).toBe(true);
    context = { ...context, active: false };
    expect(render()).toMatchObject({
      marketOverview: overview(),
      annualFinancials: null,
      busy: false,
    });
    active = true;
    context = { ...context, active: true };
    render();
    await flush();
    expect(client.annual).toHaveBeenCalledTimes(1);
  });
  it.each([
    "session",
    "catalog",
    "issuer",
    "listing",
    "name",
    "exchange",
    "disabled",
    "retired",
  ] as const)(
    "clears data and rejects late work on %s retirement",
    async (change) => {
      await render().loadAnnualFinancials();
      const held = deferred<PersonalMarketOverviewDto>();
      client.market.mockReturnValue(held.promise);
      const old = render();
      const pending = old.loadMarketData("1m");
      if (change === "session") context = { ...context, sessionKey: 2 };
      if (change === "catalog")
        context = {
          ...context,
          catalogSnapshotSha256: `sha256:${"b".repeat(64)}`,
        };
      if (change === "issuer")
        context = {
          ...context,
          selection: { ...selection(), issuerId: "issuer-other" },
        };
      if (change === "listing")
        context = {
          ...context,
          selection: { ...selection(), listingId: "listing-other" },
        };
      if (change === "name")
        context = {
          ...context,
          selection: { ...selection(), securityName: "Other class" },
        };
      if (change === "exchange")
        context = {
          ...context,
          selection: { ...selection(), exchangeMic: "XNYS" },
        };
      if (change === "disabled") context = { ...context, enabled: false };
      if (change === "retired") current = false;
      expect(render()).toMatchObject({
        marketOverview: null,
        annualFinancials: null,
        busy: false,
      });
      await old.loadCompanyOverview();
      expect(old.reset(selection(), "full-ALFA")).toBe(false);
      held.resolve(overview());
      await pending;
      expect(render()).toMatchObject({
        marketOverview: null,
        annualFinancials: null,
        busy: false,
      });
      expect(client.market).toHaveBeenCalledTimes(1);
      expect(unavailable).not.toHaveBeenCalled();
    },
  );
  it("retires synchronously when authority turns false and cannot revive former data", async () => {
    await render().loadCompanyOverview();
    const old = render();
    current = false;
    await old.loadCompanyOverview();
    current = true;
    expect(render()).toMatchObject({
      marketOverview: null,
      annualFinancials: null,
    });
    expect(old.admitMarketSnapshot(selection(), overview())).toBe(false);
  });
  it("rejects old same-listing handlers after reset changes the issuer incarnation", async () => {
    const old = render();
    const next = { ...selection(), issuerId: "issuer-next" };
    expect(old.reset(next, "full-next")).toBe(true);
    context = { ...context, selection: next, identityKey: "full-next" };
    render();
    await old.loadCompanyOverview();
    expect(old.reset(selection(), "full-ALFA")).toBe(false);
    expect(old.admitMarketSnapshot(selection(), overview())).toBe(false);
    expect(client.market).not.toHaveBeenCalled();
  });
  it("ignores late session errors from cancelled work without disturbing a fresh request", async () => {
    const oldRequest = deferred<PersonalMarketOverviewDto>();
    const nextRequest = deferred<PersonalMarketOverviewDto>();
    client.market
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(nextRequest.promise);
    const old = render();
    const pendingOld = old.loadMarketData("1m");
    expect(old.reset(selection("BRIO"), "full-BRIO")).toBe(true);
    context = {
      ...context,
      selection: selection("BRIO"),
      identityKey: "full-BRIO",
    };
    const pendingNext = render().loadMarketData("1y");
    oldRequest.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await pendingOld;
    expect(render()).toMatchObject({ busy: true, marketOverview: null });
    expect(unavailable).not.toHaveBeenCalled();
    nextRequest.resolve(overview("BRIO", "1y"));
    await pendingNext;
    expect(render().marketOverview).toEqual(overview("BRIO", "1y"));
  });
  it("handles effect replay during IO without stuck busy state or automatic retry", async () => {
    const held = deferred<PersonalMarketOverviewDto>();
    client.market.mockReturnValue(held.promise);
    const old = render();
    const pending = old.loadCompanyOverview();
    hooks.replayCommittedEffects();
    expect(render().busy).toBe(false);
    expect(client.market.mock.calls[0]![1]?.aborted).toBe(true);
    held.resolve(overview());
    await pending;
    await old.loadCompanyOverview();
    expect(render().marketOverview).toBeNull();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).not.toHaveBeenCalled();
  });
  it("keeps usable EOD when annual entitlement is refused and retries annual alone", async () => {
    client.annual.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_entitled"),
    );
    await render().loadCompanyOverview();
    expect(render()).toMatchObject({
      marketOverview: overview(),
      annualFinancials: null,
      annualFinancialsErrorCode: "not_entitled",
      action: "retry",
    });
    await render().loadCompanyOverview();
    expect(client.annual).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
    expect(render().canLoad).toBe(true);
    await render().loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(1);
    expect(client.annual).toHaveBeenCalledTimes(2);
  });
  it("keeps annual usable after an EOD coverage failure and retries EOD alone", async () => {
    client.market.mockResolvedValueOnce({
      ...overview(),
      history: { status: "unavailable", reason: "not_covered" },
    });
    await render().loadCompanyOverview();
    expect(render()).toMatchObject({
      marketErrorCode: "not_covered",
      annualFinancials: annual(),
      action: "retry",
    });
    await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
    await render().loadCompanyOverview();
    expect(client.market).toHaveBeenCalledTimes(2);
    expect(client.annual).toHaveBeenCalledTimes(1);
  });
  it.each(["credentials_invalid", "access_denied", "rate_limited"] as const)(
    "stops after a shared EOD %s result without requesting annual",
    async (reason) => {
      client.market.mockResolvedValueOnce({
        ...overview(),
        history: { status: "unavailable", reason },
      });
      await render().loadCompanyOverview();
      expect(client.annual).not.toHaveBeenCalled();
      expect(render()).toMatchObject({
        overviewErrorCode: reason,
        marketErrorCode: reason,
        busy: false,
      });
    },
  );
  it("retains previously loaded domains on refresh failure and keeps a longer history range", async () => {
    await render().loadMarketData("1y");
    await render().loadAnnualFinancials();
    await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
    client.market.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("provider_unavailable"),
    );
    client.annual.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("not_entitled"),
    );
    await render().loadCompanyOverview();
    expect(client.market.mock.calls.at(-1)![0]).toMatchObject({
      range: "1y",
      includeQuote: false,
    });
    expect(render()).toMatchObject({
      marketOverview: overview("ALFA", "1y"),
      annualFinancials: annual(),
      marketErrorCode: "provider_unavailable",
      annualFinancialsErrorCode: "not_entitled",
      action: "retry",
    });
  });
  it("preserves independent panel quote/range behavior and calls invalidation only on range change", async () => {
    await render().loadMarketData("1y");
    expect(rangeChanged).not.toHaveBeenCalled();
    await render().loadMarketData("1m");
    expect(rangeChanged).toHaveBeenCalledWith("1m", "1y");
    expect(
      client.market.mock.calls.map(([request]) => [
        request.range,
        request.includeQuote,
      ]),
    ).toEqual([
      ["1y", true],
      ["1m", true],
    ]);
    await render().loadMarketData("1m");
    expect(client.market).toHaveBeenCalledTimes(2);
    await render().loadAnnualFinancials();
    expect(client.annual).toHaveBeenCalledTimes(1);
  });
  it("caps sequences across controls/ranges and preserves the company budget through Back and company toggles", async () => {
    for (const range of ["1m", "3m", "1y", "5y"] as const)
      await render().loadMarketData(range);
    await render().loadAnnualFinancials();
    expect(client.annual).not.toHaveBeenCalled();
    expect(render().nextLoadAt).toBe(startTime + 60 * 60 * 1000);
    const old = render();
    old.reset(selection("BRIO"), "full-BRIO");
    context = {
      ...context,
      selection: selection("BRIO"),
      identityKey: "full-BRIO",
    };
    await render().loadAnnualFinancials();
    expect(client.annual).toHaveBeenCalledTimes(1);
    render().reset(selection(), "full-ALFA");
    context = { ...context, selection: selection(), identityKey: "full-ALFA" };
    await render().loadAnnualFinancials();
    expect(client.annual).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(client.market).toHaveBeenCalledTimes(4);
    await render().loadAnnualFinancials();
    expect(client.annual).toHaveBeenCalledTimes(2);
  });
  it("does not spend a budget or request when activity authorization is refused", async () => {
    activity.mockReturnValueOnce(undefined);
    await render().loadAnnualFinancials();
    expect(client.annual).not.toHaveBeenCalled();
    await render().loadAnnualFinancials();
    expect(client.annual).toHaveBeenCalledTimes(1);
  });
  it.each(["session_unavailable", "completion"] as const)(
    "clears both retained domains on %s failure",
    async (mode) => {
      await render().loadCompanyOverview();
      await vi.advanceTimersByTimeAsync(COMPANY_REQUEST_SPACING_MILLISECONDS);
      if (mode === "session_unavailable")
        client.market.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("session_unavailable"),
        );
      else complete.mockReturnValueOnce(false);
      await render().loadCompanyOverview();
      expect(render()).toMatchObject({
        marketOverview: null,
        annualFinancials: null,
        busy: false,
      });
      expect(unavailable).toHaveBeenCalledTimes(1);
      expect(client.annual).toHaveBeenCalledTimes(1);
    },
  );
  it("validates annual completion independently when the session expires during the second request", async () => {
    const first = vi.fn(() => true),
      second = vi.fn(() => false);
    activity.mockReturnValueOnce(first).mockReturnValueOnce(second);
    await render().loadCompanyOverview();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(render()).toMatchObject({
      marketOverview: null,
      annualFinancials: null,
    });
    expect(unavailable).toHaveBeenCalledOnce();
  });
  it.each(["price", "annual"] as const)(
    "rejects a response with incorrect exact %s identity",
    async (domain) => {
      if (domain === "price")
        client.market.mockResolvedValueOnce({
          ...overview(),
          security: { ...overview().security, exchangeMic: "XNYS" },
        });
      else
        client.annual.mockResolvedValueOnce({
          ...annual(),
          security: { ...annual().security, issuerName: "Wrong issuer" },
        });
      await render().loadCompanyOverview();
      expect(
        domain === "price"
          ? render().marketOverview
          : render().annualFinancials,
      ).toBeNull();
      expect(
        domain === "price"
          ? render().marketErrorCode
          : render().annualFinancialsErrorCode,
      ).toBe("invalid_response");
    },
  );
  it.each(["identity", "window", "history", "unavailable"] as const)(
    "rejects an unusable admitted Markets %s snapshot",
    (change) => {
      const view = render();
      const value = overview();
      const bad =
        change === "identity"
          ? { ...value, security: { ...value.security, symbol: "OTHER" } }
          : change === "window"
            ? { ...value, window: { ...value.window, range: "1y" as const } }
            : change === "history"
              ? overview("ALFA", "1y")
              : {
                  ...value,
                  history: {
                    status: "unavailable" as const,
                    reason: "not_covered" as const,
                  },
                };
      expect(view.admitMarketSnapshot(selection(), bad)).toBe(false);
      expect(render().marketOverview).toBeNull();
    },
  );
  it.each([
    "unconfigured",
    "unknown",
    "inactive",
    "disabled",
    "catalog",
    "selection",
  ] as const)("does no IO when %s", async (change) => {
    if (change === "unconfigured")
      context = {
        ...context,
        providerStatus: {
          ...context.providerStatus!,
          status: "not_configured",
        },
      };
    if (change === "unknown") context = { ...context, providerStatus: null };
    if (change === "inactive") context = { ...context, active: false };
    if (change === "disabled") context = { ...context, enabled: false };
    if (change === "catalog")
      context = { ...context, catalogSnapshotSha256: null };
    if (change === "selection") context = { ...context, selection: null };
    const view = render();
    expect(view.canLoad).toBe(false);
    await view.loadCompanyOverview();
    expect(client.market).not.toHaveBeenCalled();
    expect(client.annual).not.toHaveBeenCalled();
  });
});
function render() {
  hooks.beginRender();
  const view = useCompanyOverviewData(context);
  hooks.commit();
  return view;
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
function selection(symbol = "ALFA"): PersonalMarketSelection {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerId: `issuer-${symbol}`,
    issuerName: `Synthetic ${symbol}`,
    listingId: `listing-${symbol}`,
    securityName: "Common stock",
    symbol,
  };
}
function overview(
  symbol = "ALFA",
  range: PersonalMarketDataRangeDto = "1m",
): PersonalMarketOverviewDto {
  const row = selection(symbol),
    window = { range, startDate: "2026-08-24", endDate: "2026-09-24" };
  return {
    schemaVersion: "2.0.0",
    profile: "personal_single_user_local_market_data",
    ingestedAt: "2026-09-24T23:00:00.000Z",
    security: {
      country: row.country,
      exchangeMic: row.exchangeMic,
      issuerName: row.issuerName,
      listingId: row.listingId,
      securityName: row.securityName,
      symbol,
    },
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      historyFeed: "tiingo_eod_composite",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      quoteFeed: "tiingo_iex_derived_reference",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
    },
    window,
    quote: { status: "not_requested" },
    history: {
      status: "available",
      value: { ...window, currency: "USD", bars: [] },
    },
  };
}
function annual(symbol = "ALFA"): PersonalAnnualFinancialsDto {
  return {
    asOf: "2026-09-24T23:00:00.000Z",
    coverage: {
      earliestFiscalYear: 2025,
      knownReportedCells: 0,
      latestFiscalYear: 2025,
      missingFiscalYears: [
        2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016,
      ],
      requestedAnnualYears: 10,
      returnedAnnualYears: 1,
      status: "partial",
      unknownReportedCells: 30,
    },
    profile: "personal_single_user_local_fundamentals",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      statementFeed: "tiingo_fundamentals_statements",
      valueCurrency: "USD",
    },
    schemaVersion: "1.1.0",
    security: overview(symbol).security,
    status: "available",
    years: [
      {
        fiscalYear: 2025,
        statementDate: "2026-02-15",
        reported: Object.fromEntries(
          PERSONAL_FINANCIAL_REPORTED_FIELDS.map(({ fieldKey }) => [
            fieldKey,
            {
              status: "unknown",
              reason: "not_supplied_by_provider",
              value: null,
            },
          ]),
        ) as PersonalAnnualFinancialsDto["years"][number]["reported"],
      },
    ],
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
