import type {
  PersonalMarketDataStatusDto,
  PersonalQuarterlyFinancialsDto,
  PersonalValuationHistoryDto,
} from "@research-cockpit/contracts";
import { PERSONAL_FINANCIAL_REPORTED_FIELDS } from "@research-cockpit/personal-financial-analytics";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Api from "../../lib/personal-workspace-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  useCompanyFinancialDetailsData,
  type CompanyFinancialDetailsDataContext,
} from "./useCompanyFinancialDetailsData";

const hooks = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  return {
    beginRender() {
      stateIndex = refIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      stateIndex = refIndex = 0;
    },
    useState(this: void, initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] = next;
        },
      ];
    },
    useRef<T>(this: void, initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
  };
});
const client = vi.hoisted(() => ({
  quarterly: vi.fn<typeof Api.fetchPersonalQuarterlyFinancials>(),
  valuation: vi.fn<typeof Api.fetchPersonalValuationHistory>(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: hooks.useState,
  useRef: hooks.useRef,
}));
vi.mock("../../lib/personal-workspace-api", async () => ({
  ...(await vi.importActual<typeof Api>("../../lib/personal-workspace-api")),
  fetchPersonalQuarterlyFinancials: client.quarterly,
  fetchPersonalValuationHistory: client.valuation,
}));

type Resource = "quarterly" | "valuation";
let context: CompanyFinancialDetailsDataContext;
let sessionGeneration = 0;
const sessionUnavailable = vi.fn();
const unexpectedFetch = vi.fn();
beforeEach(() => {
  hooks.reset();
  vi.clearAllMocks();
  sessionGeneration = 1;
  client.quarterly.mockReset().mockResolvedValue(quarterlyFinancials());
  client.valuation.mockReset().mockResolvedValue(valuationHistory());
  sessionUnavailable.mockReset().mockImplementation(() => {
    sessionGeneration += 1;
    render().reset();
  });
  unexpectedFetch.mockReset().mockImplementation(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", unexpectedFetch);
  context = {
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "ZERO Common Stock",
      symbol: "ZERO",
    },
    range: "1y",
    providerStatus: marketStatus(),
    getSessionGeneration: () => sessionGeneration,
    onSessionUnavailable: sessionUnavailable,
  };
});
afterEach(() => {
  expect(unexpectedFetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("explicit company financial details", () => {
  it("loads the two resources independently with exact selection/range and no render-time IO", async () => {
    const quarterly = deferred<PersonalQuarterlyFinancialsDto>();
    const valuation = deferred<PersonalValuationHistoryDto>();
    client.quarterly.mockReturnValueOnce(quarterly.promise);
    client.valuation.mockReturnValueOnce(valuation.promise);
    let view = render();
    expect(client.quarterly).not.toHaveBeenCalled();
    expect(client.valuation).not.toHaveBeenCalled();
    const first = view.loadQuarterlyFinancials();
    const second = view.loadValuationHistory();
    view = render();
    expect(view.quarterlyFinancialsRequestState).toBe("loading");
    expect(view.valuationHistoryRequestState).toBe("loading");
    await view.loadQuarterlyFinancials();
    await view.loadValuationHistory();
    expect(client.quarterly).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-zero", symbol: "ZERO" },
      expect.any(AbortSignal),
    );
    expect(client.valuation).toHaveBeenCalledExactlyOnceWith(
      { listingId: "lst-zero", symbol: "ZERO", range: "1y" },
      expect.any(AbortSignal),
    );
    quarterly.resolve(quarterlyFinancials());
    await first;
    expect(render().valuationHistoryRequestState).toBe("loading");
    valuation.resolve(valuationHistory());
    await second;
    view = render();
    expect(view.quarterlyFinancials).toEqual(quarterlyFinancials());
    expect(view.valuationHistory).toEqual(valuationHistory());
    expect(view.quarterlyFinancialsRequestState).toBe("idle");
    expect(view.valuationHistoryRequestState).toBe("idle");
    context = { ...context };
    expect(render().quarterlyFinancials).toBe(view.quarterlyFinancials);
    expect(render().valuationHistory).toBe(view.valuationHistory);
    expect(client.quarterly).toHaveBeenCalledTimes(1);
    expect(client.valuation).toHaveBeenCalledTimes(1);
  });

  it("does not acquire either resource without a selection", async () => {
    context = { ...context, selection: null };
    const view = render();
    await view.loadQuarterlyFinancials();
    await view.loadValuationHistory();
    expect(client.quarterly).not.toHaveBeenCalled();
    expect(client.valuation).not.toHaveBeenCalled();
  });

  describe.each<Resource>(["quarterly", "valuation"])("%s resource", (kind) => {
    it.each(["not_configured", "unavailable"] as const)(
      "reports %s without dispatch",
      async (code) => {
        context = {
          ...context,
          providerStatus:
            code === "unavailable"
              ? null
              : { ...marketStatus(), status: "not_configured" },
        };
        await resource(kind).load();
        expect(resource(kind).error).toBe(code);
        expect(resource(kind).state).toBe("idle");
        expect(client[kind]).not.toHaveBeenCalled();
        expect(sessionUnavailable).not.toHaveBeenCalled();
      },
    );

    it.each(["not_entitled", "unexpected"] as const)(
      "keeps %s failures separate from session loss",
      async (failure) => {
        client[kind].mockRejectedValueOnce(
          failure === "not_entitled"
            ? new PersonalWorkspaceApiError("not_entitled")
            : new Error("Synthetic transport failure"),
        );
        await resource(kind).load();
        expect(resource(kind).error).toBe(
          failure === "not_entitled" ? "not_entitled" : "unavailable",
        );
        expect(resource(kind).state).toBe("idle");
        expect(sessionUnavailable).not.toHaveBeenCalled();
      },
    );

    it("delegates an active session failure to the host and clears both resources", async () => {
      const loaded = render();
      await loaded.loadQuarterlyFinancials();
      await loaded.loadValuationHistory();
      client[kind].mockRejectedValueOnce(
        new PersonalWorkspaceApiError("session_unavailable"),
      );
      await resource(kind).load();
      expect(sessionUnavailable).toHaveBeenCalledTimes(1);
      expect(render()).toMatchObject({
        quarterlyFinancials: null,
        valuationHistory: null,
        quarterlyFinancialsErrorCode: null,
        valuationHistoryErrorCode: null,
      });
    });

    it.each(["success", "session_error"] as const)(
      "retires late %s and its finally block after a reset and replacement request",
      async (completion) => {
        const first = hold(kind);
        const initial = resource(kind).load();
        const initialSignal = client[kind].mock.calls.at(-1)![1];
        render().reset();
        expect(initialSignal.aborted).toBe(true);
        const replacement = hold(kind);
        const current = resource(kind).load();
        if (completion === "success") first.resolve();
        else first.reject(new PersonalWorkspaceApiError("session_unavailable"));
        await initial;
        expect(resource(kind).data).toBeNull();
        expect(resource(kind).state).toBe("loading");
        expect(resource(kind).error).toBeNull();
        expect(sessionUnavailable).not.toHaveBeenCalled();
        replacement.resolve();
        await current;
        expect(resource(kind).data).not.toBeNull();
        expect(resource(kind).state).toBe("idle");
      },
    );

    it("rejects a completion from a retired host session even without a request reset", async () => {
      const pending = hold(kind);
      const loading = resource(kind).load();
      sessionGeneration += 1;
      pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
      await loading;
      expect(resource(kind).data).toBeNull();
      expect(resource(kind).error).toBeNull();
      expect(sessionUnavailable).not.toHaveBeenCalled();
      render().reset();
      expect(resource(kind).state).toBe("idle");
    });
  });

  it("valuation-only invalidation leaves a pending quarterly load active", async () => {
    const quarterly = hold("quarterly");
    const valuation = hold("valuation");
    const old = render();
    const first = old.loadQuarterlyFinancials();
    const second = old.loadValuationHistory();
    const quarterlySignal = client.quarterly.mock.calls.at(-1)![1];
    const valuationSignal = client.valuation.mock.calls.at(-1)![1];
    old.clearValuationHistoryState();
    context = { ...context, range: "5y" };
    expect(quarterlySignal.aborted).toBe(false);
    expect(valuationSignal.aborted).toBe(true);
    quarterly.resolve();
    valuation.resolve();
    await Promise.all([first, second]);
    expect(render().quarterlyFinancials).not.toBeNull();
    expect(render().valuationHistory).toBeNull();
    await render().loadValuationHistory();
    expect(client.valuation.mock.calls.at(-1)![0].range).toBe("5y");
    expect(client.quarterly).toHaveBeenCalledTimes(1);
  });

  it("a full reset synchronously aborts both pending resources", async () => {
    const quarterly = hold("quarterly");
    const valuation = hold("valuation");
    const old = render();
    const first = old.loadQuarterlyFinancials();
    const second = old.loadValuationHistory();
    old.reset();
    expect(client.quarterly.mock.calls.at(-1)![1].aborted).toBe(true);
    expect(client.valuation.mock.calls.at(-1)![1].aborted).toBe(true);
    quarterly.resolve();
    valuation.resolve();
    await Promise.all([first, second]);
    expect(render()).toMatchObject({
      quarterlyFinancials: null,
      valuationHistory: null,
      quarterlyFinancialsRequestState: "idle",
      valuationHistoryRequestState: "idle",
    });
  });
});

function render() {
  hooks.beginRender();
  return useCompanyFinancialDetailsData(context);
}
function resource(kind: Resource) {
  const view = render();
  return kind === "quarterly"
    ? {
        load: view.loadQuarterlyFinancials,
        data: view.quarterlyFinancials,
        error: view.quarterlyFinancialsErrorCode,
        state: view.quarterlyFinancialsRequestState,
      }
    : {
        load: view.loadValuationHistory,
        data: view.valuationHistory,
        error: view.valuationHistoryErrorCode,
        state: view.valuationHistoryRequestState,
      };
}
function hold(kind: Resource) {
  if (kind === "quarterly") {
    const value = deferred<PersonalQuarterlyFinancialsDto>();
    client.quarterly.mockReturnValueOnce(value.promise);
    return {
      resolve: () => value.resolve(quarterlyFinancials()),
      reject: value.reject,
    };
  }
  const value = deferred<PersonalValuationHistoryDto>();
  client.valuation.mockReturnValueOnce(value.promise);
  return {
    resolve: () => value.resolve(valuationHistory()),
    reject: value.reject,
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

const annualFinancialReportedFieldKeys = PERSONAL_FINANCIAL_REPORTED_FIELDS.map(
  ({ fieldKey }) => fieldKey,
);

function marketStatus(): PersonalMarketDataStatusDto {
  return {
    profile: "personal_single_user_local_market_data",
    provider: marketProvider(),
    schemaVersion: "1.0.0",
    status: "configured",
  };
}

function quarterlyFinancials(
  listingId = "lst-zero",
  symbol = "ZERO",
): PersonalQuarterlyFinancialsDto {
  const reported = Object.fromEntries(
    annualFinancialReportedFieldKeys.map((key, index) => [
      key,
      { status: "known", value: String((index + 1) * 10) },
    ]),
  ) as PersonalQuarterlyFinancialsDto["quarters"][number]["reported"];
  return {
    asOf: "2030-01-15T21:01:00.000Z",
    coverage: {
      earliestFiscalQuarter: 4,
      earliestFiscalYear: 2029,
      knownReportedCells: 30,
      latestFiscalQuarter: 4,
      latestFiscalYear: 2029,
      missingFiscalQuarters: [
        { fiscalQuarter: 3, fiscalYear: 2029 },
        { fiscalQuarter: 2, fiscalYear: 2029 },
        { fiscalQuarter: 1, fiscalYear: 2029 },
        { fiscalQuarter: 4, fiscalYear: 2028 },
        { fiscalQuarter: 3, fiscalYear: 2028 },
        { fiscalQuarter: 2, fiscalYear: 2028 },
        { fiscalQuarter: 1, fiscalYear: 2028 },
        { fiscalQuarter: 4, fiscalYear: 2027 },
        { fiscalQuarter: 3, fiscalYear: 2027 },
        { fiscalQuarter: 2, fiscalYear: 2027 },
        { fiscalQuarter: 1, fiscalYear: 2027 },
        { fiscalQuarter: 4, fiscalYear: 2026 },
        { fiscalQuarter: 3, fiscalYear: 2026 },
        { fiscalQuarter: 2, fiscalYear: 2026 },
        { fiscalQuarter: 1, fiscalYear: 2026 },
      ],
      requestedQuarterlyPeriods: 16,
      returnedQuarterlyPeriods: 1,
      status: "partial",
      unknownReportedCells: 0,
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
    quarters: [
      {
        fiscalQuarter: 4,
        fiscalYear: 2029,
        reported,
        statementDate: "2030-01-15",
      },
    ],
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId,
      securityName: `${symbol} Common Stock`,
      symbol,
    },
    status: "available",
  };
}

function valuationHistory(
  listingId = "lst-zero",
  symbol = "ZERO",
): PersonalValuationHistoryDto {
  const points = [
    valuationPoint("2029-01-15", "23.5"),
    valuationPoint("2030-01-15", "24.125"),
  ] as const;
  return {
    asOf: "2030-01-15T22:00:00.000Z",
    coverage: {
      knownCells: 10,
      observationCount: 2,
      status: "complete",
      unknownCells: 0,
    },
    history: {
      endDate: "2030-01-15",
      latestPoint: points[1],
      points,
      range: "1y",
      startDate: "2029-01-15",
    },
    profile: "personal_single_user_local_valuation",
    provider: {
      attribution: "Tiingo",
      export: "prohibited",
      id: "tiingo",
      name: "Tiingo",
      persistence: "none",
      redistribution: "prohibited",
      retention: "active_owner_session_memory_only",
      revisionBasis: "provider_most_recent",
      valuationFeed: "tiingo_fundamentals_daily",
      valueCurrency: "USD",
    },
    schemaVersion: "1.0.0",
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerName: "Zero Alpha, Inc.",
      listingId,
      securityName: `${symbol} Common Stock`,
      symbol,
    },
    status: "available",
  };
}

function valuationPoint(date: string, pe: string) {
  return {
    date,
    enterpriseValue: {
      status: "known",
      unit: "USD",
      value: "130000000000.5",
    },
    marketCapitalization: {
      status: "known",
      unit: "USD",
      value: "125000000000.25",
    },
    priceToBook: { status: "known", unit: "ratio", value: "6.25" },
    priceToEarnings: { status: "known", unit: "ratio", value: pe },
    trailingPeg1Y: { status: "known", unit: "ratio", value: "1.75" },
  } as const;
}

function marketProvider() {
  return {
    attribution: "Tiingo" as const,
    export: "prohibited" as const,
    historyFeed: "tiingo_eod_composite" as const,
    id: "tiingo" as const,
    name: "Tiingo" as const,
    persistence: "none" as const,
    quoteFeed: "tiingo_iex_derived_reference" as const,
    redistribution: "prohibited" as const,
    retention: "active_owner_session_memory_only" as const,
  };
}
