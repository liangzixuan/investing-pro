"use client";

import type {
  PersonalAnnualFinancialsDto,
  PersonalMarketDataIdentityDto,
  PersonalMarketDataRangeDto,
  PersonalMarketDataStatusDto,
  PersonalMarketOverviewDto,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";
import {
  personalMarketBatchStopCode,
  personalMarketFeedErrorCode,
} from "../../lib/personal-market-snapshot";
import {
  fetchPersonalAnnualFinancials,
  fetchPersonalMarketOverview,
  PersonalWorkspaceApiError,
  type PersonalWorkspaceApiErrorCode,
} from "../../lib/personal-workspace-api";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";

export const COMPANY_REQUEST_SPACING_MILLISECONDS = 15 * 60 * 1_000;
const HOUR = 60 * 60 * 1_000;

export interface CompanyOverviewDataContext {
  readonly selection: PersonalMarketSelection | null;
  readonly identityKey: string | null;
  readonly active: boolean;
  readonly enabled: boolean;
  readonly catalogSnapshotSha256: string | null;
  readonly sessionKey: number;
  readonly isCurrent: () => boolean;
  readonly isActive: () => boolean;
  readonly providerStatus: PersonalMarketDataStatusDto | null;
  readonly onActivityStart: OwnerSessionActivityStart;
  readonly onSessionUnavailable: () => void;
  readonly onMarketRangeChange: (
    next: PersonalMarketDataRangeDto,
    previous: PersonalMarketDataRangeDto,
  ) => void;
}
type ErrorCode = PersonalWorkspaceApiErrorCode | null;
interface State {
  readonly marketOverview: PersonalMarketOverviewDto | null;
  readonly marketRange: PersonalMarketDataRangeDto;
  readonly marketErrorCode: ErrorCode;
  readonly annualFinancials: PersonalAnnualFinancialsDto | null;
  readonly annualFinancialsErrorCode: ErrorCode;
  readonly activeDomain: "price" | "annual" | null;
  readonly overviewErrorCode: ErrorCode | "refresh_deferred";
  readonly deferredRequestAt: number | null;
}
type Step =
  | {
      readonly domain: "price";
      readonly range: PersonalMarketDataRangeDto;
      readonly includeQuote: boolean;
    }
  | { readonly domain: "annual" };
interface Budget {
  starts: number[];
  readonly requests: Map<string, number>;
}
const initial: State = {
  marketOverview: null,
  marketRange: "1y",
  marketErrorCode: null,
  annualFinancials: null,
  annualFinancialsErrorCode: null,
  activeDomain: null,
  overviewErrorCode: null,
  deferredRequestAt: null,
};

/** One mounted coordinator serves the overview and the existing Price/Financials panels. */
export function useCompanyOverviewData(context: CompanyOverviewDataContext) {
  const [state, setState] = useState<State>(initial);
  const contextCurrent = context.isCurrent();
  const current = useRef({
    context,
    contextCurrent,
    selection: context.selection,
    identityKey: context.identityKey,
    state,
    mounted: true,
    epoch: 0,
    controller: null as AbortController | null,
    budgets: new Map<string, Budget>(),
  });
  const prior = current.current.context;
  const authorityChanged =
    prior.sessionKey !== context.sessionKey ||
    prior.catalogSnapshotSha256 !== context.catalogSnapshotSha256 ||
    prior.enabled !== context.enabled;
  const selectionChanged =
    selectionKey(context.selection) !==
      selectionKey(current.current.selection) ||
    context.identityKey !== current.current.identityKey;
  const retired = current.current.contextCurrent && !contextCurrent;
  if (
    authorityChanged ||
    selectionChanged ||
    retired ||
    prior.active !== context.active
  ) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    current.current.selection = context.selection;
    current.current.identityKey = context.identityKey;
    current.current.state =
      authorityChanged || selectionChanged || retired
        ? initial
        : { ...current.current.state, activeDomain: null };
    setState(current.current.state);
  } else current.current.state = state;
  current.current.context = context;
  current.current.contextCurrent = contextCurrent;
  const epoch = current.current.epoch;
  let admissionEpoch = epoch;
  let admissionIdentityKey = context.identityKey;

  function publish(next: State) {
    current.current.state = next;
    setState(next);
  }
  function retire(clear: boolean) {
    current.current.epoch += 1;
    current.current.controller?.abort();
    current.current.controller = null;
    if (current.current.mounted)
      publish(
        clear ? initial : { ...current.current.state, activeDomain: null },
      );
  }
  function valid(expectedEpoch: number, requireActive: boolean) {
    const latest = current.current.context;
    if (
      !current.current.mounted ||
      expectedEpoch !== current.current.epoch ||
      context.sessionKey !== latest.sessionKey ||
      context.catalogSnapshotSha256 !== latest.catalogSnapshotSha256 ||
      !context.enabled ||
      !latest.enabled ||
      context.catalogSnapshotSha256 === null
    )
      return false;
    if (!context.isCurrent() || !latest.isCurrent()) {
      current.current.contextCurrent = false;
      retire(true);
      return false;
    }
    if (
      requireActive &&
      (!context.active ||
        !latest.active ||
        !context.isActive() ||
        !latest.isActive())
    ) {
      retire(false);
      return false;
    }
    return true;
  }
  function budgetFor(selection: PersonalMarketSelection): Budget {
    const key = JSON.stringify([
      context.sessionKey,
      context.catalogSnapshotSha256,
      current.current.identityKey,
      selectionKey(selection),
    ]);
    let budget = current.current.budgets.get(key);
    if (budget === undefined) {
      budget = { starts: [], requests: new Map() };
      current.current.budgets.set(key, budget);
    }
    return budget;
  }
  function nextAllowedAt(
    steps: readonly Step[],
    selection: PersonalMarketSelection,
    now: number,
  ) {
    if (!Number.isFinite(now)) return null;
    const budget = budgetFor(selection);
    budget.starts = budget.starts.filter((start) => now - start < HOUR);
    const hourly = budget.starts.length < 4 ? now : budget.starts[0]! + HOUR;
    return Math.max(
      now,
      hourly,
      ...steps.map((step) => {
        const last = budget.requests.get(stepKey(step));
        return last === undefined
          ? now
          : last + COMPANY_REQUEST_SPACING_MILLISECONDS;
      }),
    );
  }
  function summaryPlan(): {
    action: "load" | "retry" | "refresh";
    steps: Step[];
  } {
    const value = current.current.state;
    const priceMissing = value.marketOverview?.history.status !== "available";
    const annualMissing = value.annualFinancials === null;
    const priceFailed = value.marketErrorCode !== null;
    const annualFailed = value.annualFinancialsErrorCode !== null;
    const refresh =
      !priceMissing && !annualMissing && !priceFailed && !annualFailed;
    return {
      action: refresh
        ? "refresh"
        : priceFailed || annualFailed
          ? "retry"
          : "load",
      steps: [
        ...(refresh || priceMissing || priceFailed
          ? [
              {
                domain: "price" as const,
                range: priceMissing ? ("1m" as const) : value.marketRange,
                includeQuote: false,
              },
            ]
          : []),
        ...(refresh || annualMissing || annualFailed
          ? [{ domain: "annual" as const }]
          : []),
      ],
    };
  }
  async function perform(steps: readonly Step[]) {
    if (!valid(epoch, true) || current.current.controller !== null) return;
    const selection = current.current.selection;
    if (
      selection === null ||
      current.current.identityKey === null ||
      context.identityKey !== current.current.identityKey ||
      selectionKey(context.selection) !== selectionKey(selection)
    )
      return;
    const unavailable =
      current.current.context.providerStatus === null
        ? "unavailable"
        : current.current.context.providerStatus.status === "not_configured"
          ? "not_configured"
          : null;
    if (unavailable !== null) {
      publish({
        ...current.current.state,
        overviewErrorCode: unavailable,
        ...(steps.some((step) => step.domain === "price")
          ? { marketErrorCode: unavailable }
          : {}),
        ...(steps.some((step) => step.domain === "annual")
          ? { annualFinancialsErrorCode: unavailable }
          : {}),
      });
      return;
    }
    const now = Date.now();
    const next = nextAllowedAt(steps, selection, now);
    if (next === null || next > now) {
      publish({
        ...current.current.state,
        overviewErrorCode: "refresh_deferred",
        deferredRequestAt: next,
      });
      return;
    }
    const completions = steps.map(() => context.onActivityStart());
    if (
      completions.some((complete) => complete === undefined) ||
      !valid(epoch, true)
    )
      return;
    const controller = new AbortController();
    current.current.controller = controller;
    const budget = budgetFor(selection);
    budget.starts.push(now);
    const requestCurrent = () =>
      valid(epoch, true) &&
      !controller.signal.aborted &&
      current.current.controller === controller;
    publish({
      ...current.current.state,
      overviewErrorCode: null,
      deferredRequestAt: null,
    });
    try {
      for (const [index, step] of steps.entries()) {
        if (!requestCurrent()) break;
        // Capture all completions at the user action, then validate each response
        // once. A later annual response must still satisfy the session deadline.
        const complete = completions[index]!;
        let completed = false;
        function acceptActivity() {
          if (completed) return true;
          completed = true;
          if (complete()) return true;
          retire(true);
          context.onSessionUnavailable();
          return false;
        }
        budget.requests.set(stepKey(step), Date.now());
        if (step.domain === "price") {
          const previous = current.current.state.marketRange;
          if (previous !== step.range)
            context.onMarketRangeChange(step.range, previous);
          if (!requestCurrent()) break;
          publish({
            ...current.current.state,
            activeDomain: "price",
            marketRange: step.range,
            marketOverview:
              previous === step.range
                ? current.current.state.marketOverview
                : null,
            marketErrorCode: null,
          });
        } else
          publish({
            ...current.current.state,
            activeDomain: "annual",
            annualFinancialsErrorCode: null,
          });
        try {
          if (step.domain === "price") {
            const value = await fetchPersonalMarketOverview(
              {
                includeQuote: step.includeQuote,
                listingId: selection.listingId,
                symbol: selection.symbol,
                range: step.range,
              },
              controller.signal,
            );
            if (!requestCurrent() || !acceptActivity()) break;
            if (
              !matchesIdentity(selection, value.security) ||
              value.window.range !== step.range ||
              (value.history.status === "available" &&
                value.history.value.range !== step.range)
            )
              throw new PersonalWorkspaceApiError("invalid_response");
            const error =
              value.history.status === "unavailable"
                ? personalMarketFeedErrorCode(value.history.reason)
                : null;
            publish({
              ...current.current.state,
              marketOverview:
                value.history.status === "available" ||
                current.current.state.marketOverview === null
                  ? value
                  : {
                      ...current.current.state.marketOverview,
                      quote: value.quote,
                    },
              marketErrorCode: error,
            });
            const stop = personalMarketBatchStopCode(value);
            if (stop !== null) {
              publish({ ...current.current.state, overviewErrorCode: stop });
              break;
            }
          } else {
            const value = await fetchPersonalAnnualFinancials(
              { listingId: selection.listingId, symbol: selection.symbol },
              controller.signal,
            );
            if (!requestCurrent() || !acceptActivity()) break;
            if (!matchesIdentity(selection, value.security))
              throw new PersonalWorkspaceApiError("invalid_response");
            publish({
              ...current.current.state,
              annualFinancials: value,
              annualFinancialsErrorCode: null,
            });
          }
        } catch (error) {
          if (!requestCurrent()) break;
          const code =
            error instanceof PersonalWorkspaceApiError
              ? error.code
              : "unavailable";
          if (code === "session_unavailable") {
            retire(true);
            context.onSessionUnavailable();
            break;
          }
          if (!acceptActivity()) break;
          if (code === "conflict") {
            publish({
              ...initial,
              overviewErrorCode: code,
              ...(step.domain === "price"
                ? { marketErrorCode: code }
                : { annualFinancialsErrorCode: code }),
            });
            break;
          }
          publish({
            ...current.current.state,
            ...(step.domain === "price"
              ? { marketErrorCode: code }
              : { annualFinancialsErrorCode: code }),
          });
          if (
            [
              "credentials_invalid",
              "access_denied",
              "rate_limited",
              "not_configured",
              "conflict",
            ].includes(code)
          ) {
            publish({ ...current.current.state, overviewErrorCode: code });
            break;
          }
        }
      }
    } finally {
      if (current.current.controller === controller) {
        current.current.controller = null;
        if (current.current.mounted)
          publish({ ...current.current.state, activeDomain: null });
      }
    }
  }
  useEffect(() => {
    const reactivated = !current.current.mounted;
    current.current.mounted = true;
    if (reactivated) publish({ ...current.current.state, activeDomain: null });
    return () => {
      current.current.mounted = false;
      current.current.epoch += 1;
      current.current.controller?.abort();
      current.current.controller = null;
    };
  }, []);

  const visible = current.current.state;
  const plan = summaryPlan();
  const now = Date.now();
  const nextLoadAt =
    current.current.selection === null
      ? null
      : nextAllowedAt(plan.steps, current.current.selection, now);
  const deferred = nextLoadAt !== null && nextLoadAt > now;
  const deferredActionAt =
    visible.deferredRequestAt !== null && visible.deferredRequestAt > now
      ? visible.deferredRequestAt
      : null;
  const nextEligibilityAt = Math.min(
    deferred ? nextLoadAt : Infinity,
    deferredActionAt ?? Infinity,
  );
  // Only eligibility is refreshed by this timer; acquisition remains an explicit action.
  useEffect(() => {
    if (!Number.isFinite(nextEligibilityAt) || nextEligibilityAt <= Date.now())
      return;
    const timer = setTimeout(() => {
      if (current.current.mounted) publish({ ...current.current.state });
    }, nextEligibilityAt - Date.now());
    return () => clearTimeout(timer);
  }, [nextEligibilityAt]);
  const ready =
    context.active &&
    context.enabled &&
    contextCurrent &&
    context.isActive() &&
    context.selection !== null &&
    context.identityKey !== null &&
    context.catalogSnapshotSha256 !== null;
  const busy = visible.activeDomain !== null;
  const deferralMessage = !ready
    ? "Select a company in the active workspace."
    : context.providerStatus === null
      ? "Price provider status is unavailable."
      : context.providerStatus.status === "not_configured"
        ? "The price provider is not configured."
        : deferredActionAt !== null || deferred
          ? `The ${deferredActionAt !== null ? "last requested action" : "company overview request"} is paused by the company refresh limit. Try it again after ${new Date(deferredActionAt ?? nextLoadAt!).toLocaleTimeString()}.`
          : null;
  return {
    ...visible,
    marketOverview:
      context.enabled && contextCurrent ? visible.marketOverview : null,
    annualFinancials:
      context.enabled && contextCurrent ? visible.annualFinancials : null,
    marketRequestState: requestState(visible.activeDomain === "price"),
    annualFinancialsRequestState: requestState(
      visible.activeDomain === "annual",
    ),
    overviewRequestState: requestState(busy),
    busy,
    action: plan.action,
    canLoad:
      ready &&
      !busy &&
      context.providerStatus?.status === "configured" &&
      !deferred,
    deferralMessage,
    nextLoadAt: deferred ? nextLoadAt : null,
    loadCompanyOverview: () => perform(summaryPlan().steps),
    loadMarketData: (range: PersonalMarketDataRangeDto) =>
      perform([{ domain: "price", range, includeQuote: true }]),
    loadAnnualFinancials: () => perform([{ domain: "annual" }]),
    cancelPending: () => {
      if (!valid(epoch, false)) return false;
      retire(false);
      return true;
    },
    reset: (
      nextSelection: PersonalMarketSelection | null = null,
      nextIdentityKey: string | null = null,
    ) => {
      if (!valid(epoch, false)) return false;
      if ((nextSelection === null) !== (nextIdentityKey === null)) return false;
      const changed =
        selectionKey(current.current.selection) !==
          selectionKey(nextSelection) ||
        current.current.identityKey !== nextIdentityKey;
      retire(changed);
      if (!changed)
        publish({
          ...current.current.state,
          deferredRequestAt: null,
          overviewErrorCode:
            current.current.state.overviewErrorCode === "refresh_deferred"
              ? null
              : current.current.state.overviewErrorCode,
        });
      current.current.selection = nextSelection;
      current.current.identityKey = nextIdentityKey;
      admissionEpoch = current.current.epoch;
      admissionIdentityKey = nextIdentityKey;
      return true;
    },
    admitMarketSnapshot: (
      selection: PersonalMarketSelection,
      overview: PersonalMarketOverviewDto,
    ) => {
      if (
        !valid(admissionEpoch, false) ||
        admissionIdentityKey === null ||
        admissionIdentityKey !== current.current.identityKey ||
        current.current.controller !== null ||
        selectionKey(selection) !== selectionKey(current.current.selection) ||
        !matchesIdentity(selection, overview.security) ||
        overview.window.range !== "1m" ||
        overview.history.status !== "available" ||
        overview.history.value.range !== "1m"
      )
        return false;
      if (current.current.state.marketOverview?.history.status === "available")
        return true;
      const previous = current.current.state.marketRange;
      if (previous !== "1m") context.onMarketRangeChange("1m", previous);
      if (!valid(admissionEpoch, false)) return false;
      publish({
        ...current.current.state,
        marketOverview: overview,
        marketRange: "1m",
        marketErrorCode: null,
      });
      return true;
    },
  };
}

function stepKey(step: Step): string {
  return step.domain === "annual"
    ? "annual"
    : `price:${step.range}:${String(step.includeQuote)}`;
}
function selectionKey(
  selection: PersonalMarketSelection | null,
): string | null {
  return selection === null
    ? null
    : JSON.stringify([
        selection.issuerId,
        selection.country,
        selection.exchangeMic,
        selection.issuerName,
        selection.listingId,
        selection.securityName,
        selection.symbol,
      ]);
}
function matchesIdentity(
  selection: PersonalMarketSelection,
  actual: PersonalMarketDataIdentityDto,
) {
  return (
    selection.country === actual.country &&
    selection.exchangeMic === actual.exchangeMic &&
    selection.issuerName === actual.issuerName &&
    selection.listingId === actual.listingId &&
    selection.securityName === actual.securityName &&
    selection.symbol === actual.symbol
  );
}

function requestState(active: boolean): "loading" | "idle" {
  return active ? "loading" : "idle";
}
