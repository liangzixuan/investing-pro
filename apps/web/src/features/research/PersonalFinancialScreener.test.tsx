import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialSavedViewsPayloadDto,
  type PersonalSecurityMasterSnapshotReceiptDto,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  let pending: Array<() => void> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      pending = [];
    },
    begin() {
      stateIndex = 0;
      refIndex = 0;
      effectIndex = 0;
    },
    effects() {
      const effects = pending;
      pending = [];
      effects.forEach((effect) => effect());
    },
    unmount() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
    },
    useEffect(
      effect: () => (() => void) | void,
      next: readonly unknown[] | undefined,
    ) {
      const index = effectIndex++;
      const previous = dependencies[index];
      if (
        previous !== undefined &&
        next !== undefined &&
        previous.length === next.length &&
        next.every((item, i) => Object.is(item, previous[i]))
      )
        return;
      dependencies[index] = next;
      pending.push(() => {
        cleanup.get(index)?.();
        const returned = effect();
        if (returned) cleanup.set(index, returned);
      });
    },
    useRef<T>(initial: T) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState(initial: unknown) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (next: unknown) => {
          states[index] =
            typeof next === "function"
              ? (next as (previous: unknown) => unknown)(states[index])
              : next;
        },
      ];
    },
  };
});
const api = vi.hoisted(() => ({
  fetchPersonalFinancialSavedViews: vi.fn(),
  savePersonalFinancialSavedViews: vi.fn(),
  screenPersonalFinancials: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
vi.mock("@/lib/personal-financial-screen-api", async () => ({
  ...(await import("../../lib/personal-financial-screen-api")),
  ...api,
}));
vi.mock(
  "@/lib/personal-workspace-api",
  () => import("../../lib/personal-workspace-api"),
);
import { PersonalWorkspaceApiError } from "@/lib/personal-workspace-api";
import {
  PersonalFinancialScreener,
  type PersonalFinancialScreenerProps,
} from "./PersonalFinancialScreener";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";

const sha = (letter: string): `sha256:${string}` =>
  `sha256:${letter.repeat(64)}`;
let props: PersonalFinancialScreenerProps;
const activityCompletion = vi.fn<() => boolean>();
const activityStart = vi.fn<OwnerSessionActivityStart>();
beforeEach(() => {
  harness.reset();
  Object.values(api).forEach((mock) => mock.mockReset());
  activityCompletion.mockReset().mockReturnValue(true);
  activityStart.mockReset().mockReturnValue(activityCompletion);
  api.fetchPersonalFinancialSavedViews.mockResolvedValue(null);
  api.screenPersonalFinancials.mockResolvedValue(response());
  api.savePersonalFinancialSavedViews.mockImplementation(
    (version: number, payload: PersonalFinancialSavedViewsPayloadDto) =>
      Promise.resolve({ version: version + 1, payload }),
  );
  props = {
    snapshot: {
      snapshotSha256: sha("a"),
    } as PersonalSecurityMasterSnapshotReceiptDto,
    canAddToWatchlist: true,
    onAddToWatchlist: vi.fn(),
    onOpenResearch: vi.fn(),
    onSessionUnavailable: vi.fn(),
    onActivityStart: activityStart,
    savedListingIds: new Set(),
  };
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-2222-4333-8444-555555555555",
  });
});
afterEach(() => {
  harness.unmount();
  vi.unstubAllGlobals();
});

describe("PersonalFinancialScreener", () => {
  it("shows exact signed cash subtraction, input roles and filing details with unresolved revenue", async () => {
    const result = response();
    const row = result.rows[0]!;
    const operating = {
      concept: "NetCashProvidedByUsedInOperatingActivities",
      accessionNumber: "0000000001-25-000001",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      value: "-100.10001",
    };
    const purchases = {
      ...operating,
      concept: "PaymentsToAcquirePropertyPlantAndEquipment",
      value: "23.00002",
    };
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            revenue: {
              status: "unavailable",
              unit: "USD",
              reason: "missing",
              sources: [],
            },
            ppePurchases: {
              status: "available",
              unit: "USD",
              value: purchases.value,
              sources: [purchases],
            },
            operatingCashFlowLessPpePurchases: {
              status: "available",
              unit: "USD",
              value: "-123.10003",
              sources: [operating, purchases],
            },
          },
        },
      ],
    });
    await mount();
    submit(render());
    await flush();
    const view = render();
    expect(text(view)).toContain("PP&E purchases (USD)");
    expect(text(view)).toContain(
      "Operating cash flow less PP&E purchases (USD)",
    );
    expect(text(view)).toContain("Exact value: -123.10003 USD");
    expect(text(view)).toContain("Operating cash flow − PP&E purchases");
    expect(text(view)).toContain(
      "same supported annual period and filing accession",
    );
    expect(text(view)).toContain("Operating cash flow input");
    expect(text(view)).toContain("PP&E purchases input (subtracted)");
    expect(text(view)).toContain("Reported: 23.00002 USD");
    expect(text(view)).toContain("Formula version 1.2.0");
    expect(
      elements(view).some(
        (element) =>
          element.type === "summary" &&
          element.props["aria-label"] ===
            "ONE Operating cash flow less PP&E purchases: -$123.1. Show source details",
      ),
    ).toBe(true);
    expect(
      elements(view).some(
        (element) =>
          element.type === "a" &&
          element.props.href ===
            "https://data.sec.gov/api/xbrl/frames/us-gaap/PaymentsToAcquirePropertyPlantAndEquipment/USD/CY2025.json",
      ),
    ).toBe(true);
    expect(
      elements(view).some(
        (element) =>
          element.type === "a" &&
          element.props.href ===
            "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/0000000001-25-000001-index.html",
      ),
    ).toBe(true);
    expect(activityCompletion).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", "An operating cash flow or PP&E purchase input is unresolved"],
    [
      "period_mismatch",
      "same supported annual period (335–395 inclusive days)",
    ],
    ["filing_mismatch", "different filing accessions"],
    ["unsupported_sign", "Reported PP&E purchases are negative"],
  ] as const)(
    "explains unknown cash subtraction %s without losing source evidence",
    async (reason, explanation) => {
      const result = response();
      const row = result.rows[0]!;
      const source = {
        concept: "PaymentsToAcquirePropertyPlantAndEquipment",
        accessionNumber: "0000000001-25-000001",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        value: "-23.00002",
      };
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              ppePurchases: {
                status: "available",
                unit: "USD",
                value: source.value,
                sources: [source],
              },
              operatingCashFlowLessPpePurchases: {
                status: "unavailable",
                unit: "USD",
                reason,
                sources: [source],
              },
            },
          },
        ],
      });
      await mount();
      submit(render());
      await flush();
      const view = render();
      expect(text(view)).toContain(explanation);
      expect(text(view)).toContain("Exact value: -23.00002 USD");
      expect(text(view)).toContain("Reported: -23.00002 USD");
      expect(
        elements(view).some(
          (element) =>
            element.props["aria-label"] ===
            "ONE Operating cash flow less PP&E purchases: Unknown. Show source details",
        ),
      ).toBe(true);
    },
  );

  it("captures activity before dispatch and credits the original callback only after a current unknown-only result", async () => {
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    const originalCompletion = vi.fn(() => true);
    const replacementCompletion = vi.fn(() => true);
    activityStart.mockReturnValueOnce(originalCompletion);
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    await mount();
    expect(activityStart).not.toHaveBeenCalled();
    submit(render());
    expect(activityStart).toHaveBeenCalledOnce();
    expect(activityStart.mock.invocationCallOrder[0]).toBeLessThan(
      api.screenPersonalFinancials.mock.invocationCallOrder[0]!,
    );
    expect(originalCompletion).not.toHaveBeenCalled();
    props = { ...props, onActivityStart: vi.fn(() => replacementCompletion) };
    render();
    const result = response();
    pending.resolve({
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        status: "not_covered",
      })),
      rows: result.rows.map((row) => ({
        ...row,
        metrics: Object.fromEntries(
          PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
            metric,
            {
              status: "unavailable",
              reason: "missing",
              unit: metric.endsWith("Margin") ? "percent" : "USD",
              sources: [],
            },
          ]),
        ) as unknown as typeof row.metrics,
      })),
      metricCoverage: Object.fromEntries(
        PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
          metric,
          { known: 0, unknown: 1 },
        ]),
      ) as PersonalFinancialScreenResponseDto["metricCoverage"],
    });
    await flush();
    expect(originalCompletion).toHaveBeenCalledOnce();
    expect(replacementCompletion).not.toHaveBeenCalled();
    expect(props.onActivityStart).not.toHaveBeenCalled();
    expect(text(render())).toContain("Open ONE");
    expect(text(render())).toContain("0 known / 1 unknown");
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });

  it("clears the session and makes no screen request when activity cannot start", async () => {
    activityStart.mockReturnValue(undefined);
    await mount();
    submit(render());
    await flush();
    expect(activityStart).toHaveBeenCalledOnce();
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    expect(activityCompletion).not.toHaveBeenCalled();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(text(render())).not.toContain("Open ONE");
  });

  it("discards a decoded response when its captured activity completion rejects the session", async () => {
    activityCompletion.mockReturnValue(false);
    await mount();
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(activityCompletion).toHaveBeenCalledOnce();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(text(render())).not.toContain("Open ONE");
    expect(text(render())).toContain("owner session expired");
  });

  it.each(["invalid_response", "unavailable", "session_unavailable"] as const)(
    "does not credit rejected %s requests",
    async (code) => {
      api.screenPersonalFinancials.mockRejectedValueOnce(
        new PersonalWorkspaceApiError(code),
      );
      await mount();
      submit(render());
      await flush();
      expect(activityStart).toHaveBeenCalledOnce();
      expect(activityCompletion).not.toHaveBeenCalled();
      expect(text(render())).not.toContain("Open ONE");
    },
  );

  it.each(["superseded", "disabled", "unmounted"] as const)(
    "does not credit a pending request after it is %s",
    async (ending) => {
      const pending = deferred<PersonalFinancialScreenResponseDto>();
      const staleCompletion = vi.fn(() => true);
      activityStart.mockReturnValueOnce(staleCompletion);
      api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
      await mount();
      submit(render());
      const signal = api.screenPersonalFinancials.mock
        .calls[0]?.[1] as AbortSignal;
      if (ending === "superseded") {
        submit(render());
        await flush();
        expect(activityCompletion).toHaveBeenCalledOnce();
      } else if (ending === "disabled") {
        props = { ...props, disabled: true };
        render();
      } else harness.unmount();
      expect(signal.aborted).toBe(true);
      pending.resolve(response());
      await flush();
      expect(staleCompletion).not.toHaveBeenCalled();
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
      if (ending === "disabled")
        expect(text(render())).not.toContain("Open ONE");
    },
  );

  it.each([
    "grossProfit",
    "ppePurchases",
    "operatingCashFlowLessPpePurchases",
    "grossMargin",
  ] as const)(
    "filters, sorts, pages and explicitly saves %s without rewriting legacy criteria",
    async (metric) => {
      const legacy = {
        id: "screen-legacy",
        name: "Legacy agreement",
        criteria: {
          calendarYear: 2024,
          identityText: "",
          clauses: [
            {
              field: "netIncome" as const,
              operator: "gte" as const,
              value: "0",
            },
          ],
          sort: { field: "symbol" as const, direction: "asc" as const },
        },
        createdAgainstCatalogSnapshotSha256: sha("c"),
        createdAgainstFinancialSnapshotSha256: sha("d"),
      };
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 4,
        payload: { schemaVersion: 1, views: [legacy] },
      });
      await mount();
      change(render(), "Saved financial screen", legacy.id);
      click(render(), "Load financial criteria");
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      submit(render());
      await flush();
      expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          schemaVersion: "4.0.0",
          financialSnapshotSha256: null,
          criteria: legacy.criteria,
        }),
      );
      change(render(), "Financial metric 1", metric);
      change(render(), "Financial threshold 1", "-10.00001");
      change(render(), "Financial sort field", metric);
      expect(text(render())).not.toContain("Open ONE");
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
      api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 26));
      submit(render());
      await flush();
      const grossRequest = api.screenPersonalFinancials.mock
        .calls[1]?.[0] as PersonalFinancialScreenRequestDto;
      expect(grossRequest.criteria).toEqual({
        ...legacy.criteria,
        clauses: [{ field: metric, operator: "gte", value: "-10.00001" }],
        sort: { field: metric, direction: "asc" },
      });
      api.screenPersonalFinancials.mockResolvedValueOnce(response(25, 26));
      click(render(), "Next financial page");
      await flush();
      expect(api.screenPersonalFinancials.mock.calls[2]?.[0]).toEqual(
        expect.objectContaining({
          schemaVersion: "4.0.0",
          criteria: grossRequest.criteria,
          financialSnapshotSha256: sha("b"),
          page: { offset: 25, limit: 25 },
        }),
      );
      change(render(), "Financial screen name", `Screen ${metric}`);
      click(render(), "Save financial screen as new");
      await flush();
      const payload = api.savePersonalFinancialSavedViews.mock
        .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
      expect(api.savePersonalFinancialSavedViews.mock.calls[0]?.[0]).toBe(4);
      expect(payload.schemaVersion).toBe(1);
      expect(payload.views[0]).toEqual(legacy);
      expect(payload.views[1]?.criteria).toEqual(grossRequest.criteria);
      click(render(), "Reset financial criteria");
      click(render(), "Load financial criteria");
      expect(input(render(), "Financial metric 1").props.value).toBe(metric);
      expect(input(render(), "Financial sort field").props.value).toBe(metric);
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(3);
      submit(render());
      await flush();
      expect(api.screenPersonalFinancials.mock.calls[3]?.[0]).toEqual(
        expect.objectContaining({
          schemaVersion: "4.0.0",
          financialSnapshotSha256: null,
          page: { offset: 0, limit: 25 },
          criteria: grossRequest.criteria,
        }),
      );
    },
  );

  it("shows signed gross profit and accessible exact source details independently of unresolved revenue", async () => {
    const result = response();
    const row = result.rows[0]!;
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            revenue: {
              status: "unavailable",
              unit: "USD",
              reason: "conflicting",
              sources: [],
            },
            grossProfit: {
              status: "available",
              unit: "USD",
              value: "-123.00001",
              sources: [
                {
                  concept: "GrossProfit",
                  accessionNumber: "0000000001-25-000001",
                  startDate: "2024-01-01",
                  endDate: "2024-12-31",
                  value: "-123.00001",
                },
              ],
            },
          },
        },
      ],
    });
    await mount();
    submit(render());
    await flush();
    const view = render();
    expect(text(view)).toContain("Gross profit (USD)");
    expect(text(view)).toContain("Exact value: -123.00001 USD");
    expect(text(view)).toContain(
      "Reported GrossProfit in USD, independent of the revenue basis",
    );
    expect(text(view)).not.toContain("Gross margin");
    expect(
      elements(view).some(
        (element) =>
          element.type === "summary" &&
          element.props["aria-label"] ===
            "ONE Gross profit: -$123. Show source details",
      ),
    ).toBe(true);
    expect(
      elements(view).some(
        (element) =>
          element.type === "a" &&
          text(element) === "SEC GrossProfit" &&
          element.props.href ===
            "https://data.sec.gov/api/xbrl/frames/us-gaap/GrossProfit/USD/CY2025.json",
      ),
    ).toBe(true);
  });

  it("explains the qualified gross-profit ratio, both operands, and its selected denominator", async () => {
    await mount();
    change(render(), "Revenue basis", "Revenues");
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "grossMargin");
    change(render(), "Financial threshold 1", "25");
    change(render(), "Financial sort field", "grossMargin");
    change(render(), "Financial sort direction", "desc");
    expect(text(render())).toContain("Gross profit / selected revenue (%)");
    expect(text(render())).toContain("Threshold ( % )");
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    api.screenPersonalFinancials.mockResolvedValueOnce(ratioResponse());
    submit(render());
    await flush();
    const cell = ratioCell(render());
    expect(text(cell)).toContain("Exact value: 25.00 percent");
    expect(text(cell)).toContain(
      "Reported GrossProfit / selected revenue × 100",
    );
    expect(text(cell)).toContain("335–395 inclusive days");
    expect(text(cell)).toContain("Rounded half-up to two decimal places");
    expect(text(cell)).toContain(
      "Revenue denominator: Revenues (broad concept)",
    );
    expect(text(cell)).toContain("Gross profit numerator GrossProfit");
    expect(text(cell)).toContain("Selected revenue denominator Revenues");
    expect(text(cell)).toContain("Reported: 30 USD");
    expect(text(cell)).toContain("Reported: 120 USD");
    expect(text(cell)).toContain(
      "they do not establish that the company defines gross profit using this revenue concept",
    );
    expect(
      elements(cell).filter((element) => element.type === "a"),
    ).toHaveLength(2);
    change(
      render(),
      "Financial screen name",
      "Gross profit over broad revenue",
    );
    click(render(), "Save financial screen as new");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.views[0]?.criteria).toMatchObject({
      revenueBasis: "Revenues",
      clauses: [{ field: "grossMargin", operator: "gte", value: "25" }],
      sort: { field: "grossMargin", direction: "desc" },
    });
    click(render(), "Reset financial criteria");
    click(render(), "Load financial criteria");
    expect(input(render(), "Revenue basis").props.value).toBe("Revenues");
    expect(input(render(), "Financial metric 1").props.value).toBe(
      "grossMargin",
    );
    expect(input(render(), "Financial sort field").props.value).toBe(
      "grossMargin",
    );
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    expect(ratioCell(render())).toBeUndefined();
  });

  it.each([
    ["-1.01", "-1.01%", "-1.005", "100"],
    ["0.00", "0.00%", "0", "120"],
    ["250.00", "250.00%", "300", "120"],
    [
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
      `${`${"9".repeat(64)}${"0".repeat(64)}`.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}.00%`,
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
    ],
  ])(
    "preserves the exact percentage display for %s",
    async (value, display, grossProfit, revenue) => {
      api.screenPersonalFinancials.mockResolvedValueOnce(
        ratioResponse(value, grossProfit, revenue),
      );
      await mount();
      submit(render());
      await flush();
      const cell = ratioCell(render());
      expect(
        elements(cell).find((element) => element.type === "summary")?.props[
          "aria-label"
        ],
      ).toBe(
        `ONE Gross profit / selected revenue (%): ${display}. Show source details`,
      );
      expect(text(cell)).toContain(`Exact value: ${value} percent`);
      expect(text(cell)).toContain(`Reported: ${grossProfit} USD`);
      expect(text(cell)).toContain(`Reported: ${revenue} USD`);
    },
  );

  it.each([
    ["period_mismatch", "Compare every source date below."],
    ["filing_mismatch", "avoid mixing filing versions"],
    ["nonpositive_revenue", "Selected revenue is zero or negative"],
    ["missing", "Reported gross profit or selected revenue is unresolved"],
  ] as const)(
    "shows the gross-profit ratio's %s reason and retained operands",
    async (reason, explanation) => {
      const result = ratioResponse(
        "25.00",
        "30",
        reason === "nonpositive_revenue" ? "0" : "120",
      );
      const row = result.rows[0]!;
      const sources = row.metrics.grossMargin.sources
        .map((source, index) => ({
          ...source,
          ...(reason === "period_mismatch" && index === 1
            ? { startDate: "2024-02-01" }
            : {}),
          ...(reason === "filing_mismatch" && index === 1
            ? { accessionNumber: "0000000001-25-000002" }
            : {}),
        }))
        .filter(
          (source) => reason !== "missing" || source.concept !== "GrossProfit",
        );
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              ...(reason === "missing"
                ? {
                    grossProfit: {
                      status: "unavailable" as const,
                      reason: "missing" as const,
                      unit: "USD" as const,
                      sources: [],
                    },
                  }
                : {}),
              grossMargin: {
                status: "unavailable",
                reason,
                unit: "percent",
                sources,
              },
            },
          },
        ],
      });
      await mount();
      submit(render());
      await flush();
      const cell = ratioCell(render());
      expect(text(cell)).toContain(
        `Unavailable: ${reason.replaceAll("_", " ")}.`,
      );
      expect(text(cell)).toContain(explanation);
      expect(text(cell)).toContain("Selected revenue denominator");
      if (reason !== "missing") {
        expect(text(cell)).toContain("Gross profit numerator");
        expect(text(cell)).toContain("Reported: 30 USD");
      }
      expect(
        elements(cell).find((element) => element.type === "summary")?.props[
          "aria-label"
        ],
      ).toBe(
        "ONE Gross profit / selected revenue (%): Unknown. Show source details",
      );
      if (reason !== "missing")
        expect(text(render())).toContain("Exact value: 30 USD");
    },
  );

  it("shows missing gross profit as unknown and spans all eleven metrics when no rows match", async () => {
    const result = response();
    const row = result.rows[0]!;
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      rows: [
        {
          ...row,
          metrics: {
            ...row.metrics,
            grossProfit: {
              status: "unavailable",
              unit: "USD",
              reason: "missing",
              sources: [],
            },
          },
        },
      ],
    });
    await mount();
    submit(render());
    await flush();
    expect(
      elements(render()).some(
        (element) =>
          element.props["aria-label"] ===
          "ONE Gross profit: Unknown. Show source details",
      ),
    ).toBe(true);
    api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 0));
    submit(render());
    await flush();
    expect(
      elements(render()).find(
        (element) =>
          element.type === "td" &&
          text(element) === "No matching financial results.",
      )?.props.colSpan,
    ).toBe(13);
  });

  it("requires an explicit run, defaults to the last completed year, and explains annual scope", async () => {
    const view = await mount();
    expect(input(view, "Financial calendar year").props.value).toBe(
      new Date().getUTCFullYear() - 1,
    );
    expect(input(view, "Revenue basis").props.value).toBe("agreement");
    expect(text(view)).toContain("calendar-aligned annual SEC facts");
    expect(text(view)).toContain("Missing or conflicting facts stay unknown");
    expect(text(view)).toContain("Run a financial screen to see results");
    expect(button(view, "Refresh SEC data")).toBeDefined();
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
  });

  it("preserves signed decimal filters, sorting and exact identity actions", async () => {
    let view = await mount();
    click(view, "Add financial filter");
    view = render();
    change(view, "Financial metric 1", "netMargin");
    view = render();
    change(view, "Financial comparison 1", "lte");
    view = render();
    change(view, "Financial threshold 1", "-0.00001");
    view = render();
    change(view, "Financial company filter", "  Example  ");
    view = render();
    change(view, "Financial sort field", "netMargin");
    view = render();
    change(view, "Financial sort direction", "desc");
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials).toHaveBeenCalledWith(
      expect.objectContaining({
        financialSnapshotSha256: null,
        criteria: {
          calendarYear: new Date().getUTCFullYear() - 1,
          identityText: "Example",
          clauses: [{ field: "netMargin", operator: "lte", value: "-0.00001" }],
          sort: { field: "netMargin", direction: "desc" },
        },
        page: { offset: 0, limit: 25 },
        refresh: false,
      }),
      expect.any(AbortSignal),
    );
    view = render();
    click(view, "Open ONE");
    click(view, "Add ONE");
    expect(props.onOpenResearch).toHaveBeenCalledWith(
      response().rows[0]?.identity,
    );
    expect(props.onAddToWatchlist).toHaveBeenCalledWith(
      response().rows[0]?.identity,
    );
    expect(text(view)).toContain("Matches · all filters pass");
    expect(text(view)).toContain("Excluded · a filter fails");
    expect(text(view)).toContain("Unknown · unresolved criteria");
    expect(text(view)).toContain("Exact value: -123456789.12 USD");
    expect(text(view)).toContain("2024-01-01 through 2024-12-31");
    expect(text(view)).toContain("known / 0 unknown");
    expect(text(view)).toContain("Net income / revenue × 100");
    expect(text(view)).toContain("All available concepts must agree");
    const links = elements(view).filter((element) => element.type === "a");
    expect(links.length).toBeGreaterThan(6);
    expect(
      links.every((link) =>
        /^https:\/\/(?:data|www)\.sec\.gov\//u.test(String(link.props.href)),
      ),
    ).toBe(true);
  });

  it("bounds criteria at seven filters and rejects blank thresholds or incomplete years", async () => {
    let view = await mount();
    for (let count = 0; count < 7; count++) {
      click(view, "Add financial filter");
      view = render();
    }
    expect(button(view, "Add financial filter").props.disabled).toBe(true);
    submit(view);
    await flush();
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    expect(text(render())).toContain("Blank thresholds are invalid");
    clickLabel(view, "Remove financial filter 1");
    view = render();
    expect(button(view, "Add financial filter").props.disabled).toBe(false);
    click(view, "Reset financial criteria");
    view = render();
    change(
      view,
      "Financial calendar year",
      String(new Date().getUTCFullYear()),
    );
    submit(render());
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    expect(activityStart).not.toHaveBeenCalled();
  });

  it("changes revenue basis locally, binds paging, and aborts stale basis results", async () => {
    await mount();
    change(render(), "Revenue basis", "Revenues");
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "grossMargin");
    change(render(), "Financial threshold 1", "25");
    change(render(), "Financial sort field", "grossMargin");
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...response(0, 26),
      revenueBasis: "Revenues",
    });
    submit(render());
    await flush();
    expect(text(render())).toContain("Revenue basis: Revenues (broad concept)");
    expect(ratioCell(render())).toBeDefined();
    expect(text(render())).toContain(
      "without substituting another revenue concept",
    );
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...response(25, 26),
      revenueBasis: "Revenues",
    });
    click(render(), "Next financial page");
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      criteria: { revenueBasis: "Revenues" },
      financialSnapshotSha256: sha("b"),
      page: { offset: 25, limit: 25 },
    });
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    click(render(), "Previous financial page");
    const signal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    change(
      render(),
      "Revenue basis",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
    );
    expect(signal.aborted).toBe(true);
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(3);
    pending.resolve({ ...response(), revenueBasis: "Revenues" });
    await flush();
    expect(text(render())).not.toContain("Open ONE");
    expect(ratioCell(render())).toBeUndefined();
    expect(text(render())).toContain("Criteria changed");
    expect(activityStart).toHaveBeenCalledTimes(3);
    expect(activityCompletion).toHaveBeenCalledTimes(2);
    api.screenPersonalFinancials.mockResolvedValueOnce(
      ratioResponse(
        "30.00",
        "30",
        "100",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
      ),
    );
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      criteria: {
        revenueBasis: "RevenueFromContractWithCustomerExcludingAssessedTax",
        clauses: [{ field: "grossMargin", operator: "gte", value: "25" }],
        sort: { field: "grossMargin", direction: "asc" },
      },
      financialSnapshotSha256: null,
      page: { offset: 0, limit: 25 },
      refresh: false,
    });
    expect(text(ratioCell(render()))).toContain("Exact value: 30.00 percent");
    expect(text(ratioCell(render()))).toContain(
      "Revenue denominator: Customer-contract revenue, excluding tax",
    );
  });

  it("saves and loads an explicit basis while preserving an untouched legacy definition", async () => {
    const legacy = {
      id: "screen-legacy",
      name: "Legacy agreement",
      criteria: {
        calendarYear: new Date().getUTCFullYear() - 1,
        identityText: "",
        clauses: [],
        sort: { field: "symbol" as const, direction: "asc" as const },
      },
      createdAgainstCatalogSnapshotSha256: sha("a"),
      createdAgainstFinancialSnapshotSha256: sha("b"),
    };
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 1,
      payload: { schemaVersion: 1, views: [legacy] },
    });
    await mount();
    change(render(), "Saved financial screen", legacy.id);
    click(render(), "Load financial criteria");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    change(render(), "Revenue basis", "Revenues");
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...response(),
      revenueBasis: "Revenues",
    });
    submit(render());
    await flush();
    change(render(), "Financial screen name", "Broad revenue");
    click(render(), "Save financial screen as new");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.views[0]).toEqual(legacy);
    expect(payload.views[0]?.criteria).not.toHaveProperty("revenueBasis");
    expect(payload.views[1]?.criteria.revenueBasis).toBe("Revenues");
    click(render(), "Reset financial criteria");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    click(render(), "Load financial criteria");
    expect(input(render(), "Revenue basis").props.value).toBe("Revenues");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    change(render(), "Saved financial screen", legacy.id);
    click(render(), "Load financial criteria");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    submit(render());
    await flush();
    const legacyRequest = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[0] as PersonalFinancialScreenRequestDto;
    expect(legacyRequest.criteria).not.toHaveProperty("revenueBasis");
  });

  it.each(["agreement", "SalesRevenueNet", "Revenues"] as const)(
    "explains unresolved %s revenue and each dependent margin while retaining sources",
    async (basis) => {
      await mount();
      const result = response();
      const original = result.rows[0]!;
      const reason = basis === "SalesRevenueNet" ? "missing" : "conflicting";
      const metrics = { ...original.metrics };
      const references =
        basis === "agreement"
          ? [
              {
                ...original.metrics.revenue.sources[0]!,
                concept: "Revenues" as const,
                value: "110",
              },
              {
                ...original.metrics.revenue.sources[0]!,
                concept:
                  "RevenueFromContractWithCustomerExcludingAssessedTax" as const,
                value: "100",
              },
            ]
          : [];
      for (const metric of [
        "revenue",
        "netMargin",
        "operatingMargin",
        "operatingCashFlowMargin",
        "grossMargin",
      ] as const)
        metrics[metric] = {
          status: "unavailable",
          reason,
          unit: metric === "revenue" ? "USD" : "percent",
          sources:
            metric === "grossMargin"
              ? [...original.metrics.grossProfit.sources, ...references]
              : references,
        };
      change(render(), "Revenue basis", basis);
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        revenueBasis: basis,
        rows: [{ ...original, metrics }],
      });
      submit(render());
      await flush();
      const rendered = text(render());
      expect(rendered).toContain(`Unavailable: ${reason}`);
      expect(
        rendered.match(
          /This margin remains unknown because revenue is unresolved\./gu,
        ),
      ).toHaveLength(3);
      expect(rendered).toContain(
        "This ratio remains unknown because selected revenue is unresolved.",
      );
      if (basis === "agreement") {
        expect(rendered).toContain(
          "Retained concepts can describe different definitions",
        );
        expect(rendered).toContain("Reported: 110 USD");
        expect(rendered).toContain("Reported: 100 USD");
      } else {
        expect(rendered).toContain(`Revenue uses only ${basis}`);
        expect(rendered).toContain(
          "Missing or unresolved selected facts stay unknown",
        );
        if (basis === "Revenues") {
          expect(rendered).toContain(
            "Any retained source references are shown below",
          );
          expect(rendered).not.toContain(
            "Retained concepts can describe different definitions",
          );
        }
      }
      expect(
        elements(render()).filter(
          (element) =>
            element.type === "a" &&
            String(element.props.href).startsWith("https://data.sec.gov/"),
        ),
      ).toHaveLength(8);
    },
  );

  it("pins every page including the return to page one and resets the digest only for a new run or refresh", async () => {
    await mount();
    api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 26));
    submit(render());
    await flush();
    api.screenPersonalFinancials.mockResolvedValueOnce(response(25, 26));
    click(render(), "Next financial page");
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      financialSnapshotSha256: sha("b"),
      page: { offset: 25, limit: 25 },
    });
    api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 26));
    click(render(), "Previous financial page");
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      financialSnapshotSha256: sha("b"),
      page: { offset: 0, limit: 25 },
    });
    click(render(), "Refresh SEC data");
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      financialSnapshotSha256: null,
      refresh: true,
      page: { offset: 0, limit: 25 },
    });
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      financialSnapshotSha256: null,
      refresh: false,
    });
    expect(activityStart).toHaveBeenCalledTimes(5);
    expect(activityCompletion).toHaveBeenCalledTimes(5);
    for (let index = 0; index < 5; index++) {
      expect(activityStart.mock.invocationCallOrder[index]).toBeLessThan(
        api.screenPersonalFinancials.mock.invocationCallOrder[index]!,
      );
      expect(
        api.screenPersonalFinancials.mock.invocationCallOrder[index],
      ).toBeLessThan(activityCompletion.mock.invocationCallOrder[index]!);
    }
  });

  it("clears old results on criteria edits and ignores an aborted response", async () => {
    await mount();
    submit(render());
    await flush();
    expect(text(render())).toContain("Open ONE");
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    submit(render());
    const signal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    change(render(), "Financial company filter", "Different");
    expect(signal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).not.toContain("Open ONE");
    expect(text(render())).toContain("Criteria changed");
    expect(activityStart).toHaveBeenCalledTimes(2);
    expect(activityCompletion).toHaveBeenCalledOnce();
  });

  it("clears results after snapshot conflicts and waits for an explicit rerun", async () => {
    await mount();
    api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 26));
    submit(render());
    await flush();
    api.screenPersonalFinancials.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    click(render(), "Next financial page");
    await flush();
    const view = render();
    expect(text(view)).not.toContain("Open ONE");
    expect(text(view)).toContain("Results were cleared");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    submit(view);
    await flush();
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      financialSnapshotSha256: null,
      page: { offset: 0, limit: 25 },
    });
  });

  it("shows partial sources and unknown facts without turning them into zero", async () => {
    await mount();
    const result = response();
    api.screenPersonalFinancials.mockResolvedValue({
      ...result,
      sources: result.sources.map((source, index) => ({
        ...source,
        status: index === 0 ? "upstream_unavailable" : "available",
      })),
      totalUnknown: 3,
      identityMatches: 4,
      metricCoverage: Object.fromEntries(
        PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
          metric,
          { known: 1, unknown: 3 },
        ]),
      ),
      rows: result.rows.map((row) => ({
        ...row,
        metrics: {
          ...row.metrics,
          netMargin: {
            status: "unavailable",
            reason: "period_mismatch",
            unit: "percent",
            sources: [],
          },
        },
      })),
    });
    submit(render());
    await flush();
    expect(text(render())).toContain("SEC source coverage is partial");
    expect(text(render())).toContain("Unavailable: period mismatch");
    expect(text(render())).toContain("upstream unavailable");
  });

  it("saves only the completed criteria, reloads them faithfully, renames, and deletes", async () => {
    let view = await mount();
    click(view, "Add financial filter");
    view = render();
    change(view, "Financial threshold 1", "1000000000.0001");
    view = render();
    change(view, "Financial sort field", "revenue");
    submit(render());
    await flush();
    change(render(), "Financial screen name", "Large revenue");
    click(render(), "Save financial screen");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(Object.keys(payload).sort()).toEqual(["schemaVersion", "views"]);
    expect(Object.keys(payload.views[0] ?? {}).sort()).toEqual([
      "createdAgainstCatalogSnapshotSha256",
      "createdAgainstFinancialSnapshotSha256",
      "criteria",
      "id",
      "name",
    ]);
    expect(payload.views[0]).toMatchObject({
      name: "Large revenue",
      criteria: {
        clauses: [
          { field: "revenue", operator: "gte", value: "1000000000.0001" },
        ],
        sort: { field: "revenue", direction: "asc" },
      },
      createdAgainstFinancialSnapshotSha256: sha("b"),
    });
    expect(payload.views[0]?.criteria).not.toHaveProperty("revenueBasis");
    click(render(), "Reset financial criteria");
    click(render(), "Load financial criteria");
    view = render();
    expect(input(view, "Financial threshold 1").props.value).toBe(
      "1000000000.0001",
    );
    expect(input(view, "Financial sort field").props.value).toBe("revenue");
    expect(text(view)).not.toContain("Open ONE");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    submit(view);
    await flush();
    change(render(), "Financial screen name", "Renamed revenue");
    click(render(), "Save financial screen");
    await flush();
    expect(api.savePersonalFinancialSavedViews.mock.calls.at(-1)?.[0]).toBe(1);
    expect(
      (
        api.savePersonalFinancialSavedViews.mock.calls.at(
          -1,
        )?.[1] as PersonalFinancialSavedViewsPayloadDto
      ).views,
    ).toHaveLength(1);
    click(render(), "Delete financial screen");
    await flush();
    expect(api.savePersonalFinancialSavedViews.mock.calls.at(-1)?.[1]).toEqual({
      schemaVersion: 1,
      views: [],
    });
  });

  it("distinguishes complete source failure from partial coverage and local request contention", async () => {
    await mount();
    const result = response();
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        status: "upstream_unavailable",
      })),
    });
    submit(render());
    await flush();
    expect(text(render())).toContain("All concept requests failed");
    expect(text(render())).not.toContain("SEC source coverage is partial");
    api.screenPersonalFinancials.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("rate_limited"),
    );
    submit(render());
    await flush();
    expect(text(render())).toContain("Another SEC screen is running");
    expect(text(render())).not.toContain("SEC is rate limiting");
  });

  it("keeps names unique and caps saved financial criteria at 20", async () => {
    const views = Array.from({ length: 20 }, (_, index) => ({
      id: `screen-${String(index)}`,
      name: `Screen ${String(index)}`,
      criteria: {
        calendarYear: 2024,
        identityText: "",
        clauses: [],
        sort: { field: "symbol", direction: "asc" },
      },
      createdAgainstCatalogSnapshotSha256: sha("a"),
      createdAgainstFinancialSnapshotSha256: sha("b"),
    }));
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 3,
      payload: { schemaVersion: 1, views },
    });
    await mount();
    submit(render());
    await flush();
    expect(
      button(render(), "Save financial screen as new").props.disabled,
    ).toBe(true);
    change(render(), "Financial screen name", "New screen");
    click(render(), "Save financial screen");
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(text(render())).toContain("Up to 20 financial screens");
    change(render(), "Saved financial screen", "screen-1");
    change(render(), "Financial screen name", "SCREEN 0");
    click(render(), "Save financial screen");
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(text(render())).toContain("Use a unique screen name");
  });

  it("requires saved-view reconciliation after a conflicting write", async () => {
    await mount();
    submit(render());
    await flush();
    change(render(), "Financial screen name", "Profitable");
    api.savePersonalFinancialSavedViews.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    click(render(), "Save financial screen");
    await flush();
    expect(text(render())).toContain("changed elsewhere");
    expect(button(render(), "Save financial screen").props.disabled).toBe(true);
    click(render(), "Reload saved screens");
    await flush();
    expect(button(render(), "Save financial screen").props.disabled).toBe(
      false,
    );
  });

  it("clears private data on session expiry and aborts other pending work", async () => {
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 2,
      payload: {
        schemaVersion: 1,
        views: [
          {
            id: "screen-private",
            name: "Private saved criteria",
            criteria: {
              calendarYear: 2024,
              identityText: "",
              clauses: [],
              sort: { field: "symbol", direction: "asc" },
            },
            createdAgainstCatalogSnapshotSha256: sha("a"),
            createdAgainstFinancialSnapshotSha256: sha("b"),
          },
        ],
      },
    });
    await mount();
    submit(render());
    await flush();
    expect(text(render())).toContain("Private saved criteria");
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    submit(render());
    const screenSignal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    api.fetchPersonalFinancialSavedViews.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    click(render(), "Reload saved screens");
    await flush();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(screenSignal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).not.toContain("Private saved criteria");
    expect(text(render())).not.toContain("Open ONE");
    expect(input(render(), "Financial screen name").props.value).toBe("");
    expect(activityCompletion).toHaveBeenCalledOnce();
  });

  it("aborts requests on snapshot change and does not restore old session results", async () => {
    await mount();
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    submit(render());
    const signal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    props = {
      ...props,
      snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
    };
    render();
    expect(signal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).not.toContain("Open ONE");
    expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledTimes(2);
    expect(activityCompletion).not.toHaveBeenCalled();
  });

  it("aborts pending saved writes on unmount and suppresses the completion", async () => {
    await mount();
    submit(render());
    await flush();
    change(render(), "Financial screen name", "Pending");
    const pending = deferred<{
      version: number;
      payload: PersonalFinancialSavedViewsPayloadDto;
    }>();
    api.savePersonalFinancialSavedViews.mockReturnValueOnce(pending.promise);
    click(render(), "Save financial screen");
    const signal = api.savePersonalFinancialSavedViews.mock.calls.at(
      -1,
    )?.[2] as AbortSignal;
    harness.unmount();
    expect(signal.aborted).toBe(true);
    pending.resolve({ version: 1, payload: { schemaVersion: 1, views: [] } });
    await flush();
    expect(text(render())).not.toContain("Financial screen criteria saved");
  });

  it("makes no requests when the workspace is unavailable and clears an active screen when disabled", async () => {
    props = { ...props, workspaceReady: false };
    await mount();
    submit(render());
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    expect(api.fetchPersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(activityStart).not.toHaveBeenCalled();
    props = { ...props, workspaceReady: true };
    render();
    await flush();
    submit(render());
    await flush();
    expect(text(render())).toContain("Open ONE");
    expect(ratioCell(render())).toBeDefined();
    props = { ...props, disabled: true };
    render();
    expect(text(render())).not.toContain("Open ONE");
    expect(ratioCell(render())).toBeUndefined();
  });
});

function render() {
  harness.begin();
  const view = PersonalFinancialScreener(props);
  harness.effects();
  return view;
}
async function mount() {
  render();
  await flush();
  return render();
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(text).join(" ").replace(/\s+/gu, " ");
  if (!React.isValidElement(value)) return "";
  const element = value as React.ReactElement<Record<string, unknown>>;
  return typeof element.type === "function"
    ? text(Reflect.apply(element.type, undefined, [element.props]) as unknown)
    : text(element.props.children);
}
function elements(
  value: unknown,
): Array<React.ReactElement<Record<string, unknown>>> {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, unknown>>;
  return [
    element,
    ...elements(
      typeof element.type === "function"
        ? (Reflect.apply(element.type, undefined, [element.props]) as unknown)
        : element.props.children,
    ),
  ];
}
function input(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.props["aria-label"] === label,
  );
  if (!found) throw new Error(`Missing input: ${label}`);
  return found as React.ReactElement<{
    value: unknown;
    onChange: (event: { target: { value: string } }) => void;
  }>;
}
function change(value: unknown, label: string, next: string) {
  input(value, label).props.onChange({ target: { value: next } });
}
function button(value: unknown, label: string) {
  const found = elements(value).find(
    (element) => element.type === "button" && text(element) === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found as React.ReactElement<{
    disabled?: boolean;
    onClick?: () => void;
  }>;
}
function click(value: unknown, label: string) {
  button(value, label).props.onClick?.();
}
function clickLabel(value: unknown, label: string) {
  const found = elements(value).find(
    (element) =>
      element.type === "button" && element.props["aria-label"] === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  (found.props.onClick as () => void)();
}
function submit(value: unknown) {
  const form = elements(value).find((element) => element.type === "form");
  if (!form) throw new Error("Missing screen form");
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({
    preventDefault: () => undefined,
  });
}
function ratioCell(value: unknown) {
  return elements(value).find(
    (element) =>
      element.type === "details" &&
      element.props.className === "financial-screen-cell" &&
      elements(element).some(
        (child) =>
          child.type === "summary" &&
          String(child.props["aria-label"]).startsWith(
            "ONE Gross profit / selected revenue (%):",
          ),
      ),
  );
}
function ratioResponse(
  value = "25.00",
  grossProfit = "30",
  revenue = "120",
  basis:
    | "Revenues"
    | "RevenueFromContractWithCustomerExcludingAssessedTax" = "Revenues",
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const numerator = {
    ...row.metrics.grossProfit.sources[0]!,
    value: grossProfit,
  };
  const denominator = {
    ...row.metrics.revenue.sources[0]!,
    concept: basis,
    value: revenue,
  };
  return {
    ...result,
    revenueBasis: basis,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          grossProfit: {
            status: "available",
            unit: "USD",
            value: grossProfit,
            sources: [numerator],
          },
          revenue: {
            status: "available",
            unit: "USD",
            value: revenue,
            sources: [denominator],
          },
          grossMargin: {
            status: "available",
            unit: "percent",
            value,
            sources: [numerator, denominator],
          },
        },
      },
    ],
  };
}
function response(offset = 0, count = 1): PersonalFinancialScreenResponseDto {
  return {
    schemaVersion: "4.0.0",
    catalogSnapshotSha256: sha("a"),
    financialSnapshotSha256: sha("b"),
    calendarYear: new Date().getUTCFullYear() - 1,
    fetchedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:30:00.000Z",
    formulaVersion: "1.2.0",
    sources: PERSONAL_SEC_ANNUAL_CONCEPTS.map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025.json`,
    })),
    rows: Array.from(
      { length: Math.min(25, Math.max(0, count - offset)) },
      (_, index) => ({
        identity: {
          cik: "0000000001",
          country: "US",
          exchangeMic: "XNAS",
          instrumentType: "common_stock",
          issuerId: "issuer-one",
          issuerName: "Example One",
          listingId: `listing-${String(offset + index)}`,
          securityId: "security-one",
          securityName: "Example One Common Stock",
          shareClassId: "class-one",
          shareClassName: "Common",
          symbol: offset + index === 0 ? "ONE" : `ONE${String(offset + index)}`,
        },
        metrics: Object.fromEntries(
          PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
            metric,
            {
              status: "available",
              value:
                metric === "operatingCashFlow"
                  ? "-123456789.12"
                  : metric === "operatingCashFlowLessPpePurchases"
                    ? "-123456804.12"
                    : metric === "grossMargin"
                      ? "100.00"
                      : "15",
              unit: metric.endsWith("Margin") ? "percent" : "USD",
              sources: (metric === "operatingCashFlowLessPpePurchases"
                ? [
                    "NetCashProvidedByUsedInOperatingActivities",
                    "PaymentsToAcquirePropertyPlantAndEquipment",
                  ]
                : metric === "grossMargin"
                  ? ["GrossProfit", "Revenues"]
                  : [
                      metric === "grossProfit"
                        ? "GrossProfit"
                        : metric === "ppePurchases"
                          ? "PaymentsToAcquirePropertyPlantAndEquipment"
                          : metric === "operatingCashFlow"
                            ? "NetCashProvidedByUsedInOperatingActivities"
                            : "Revenues",
                    ]
              ).map((concept) => ({
                concept,
                accessionNumber: "0000000001-25-000001",
                startDate: "2024-01-01",
                endDate: "2024-12-31",
                value:
                  concept === "NetCashProvidedByUsedInOperatingActivities"
                    ? "-123456789.12"
                    : "15",
              })),
            },
          ]),
        ) as unknown as PersonalFinancialScreenResponseDto["rows"][number]["metrics"],
      }),
    ),
    totalUniverse: count + 3,
    identityMatches: count,
    totalMatches: count,
    totalNonMatches: 0,
    totalUnknown: 0,
    metricCoverage: Object.fromEntries(
      PERSONAL_FINANCIAL_SCREEN_METRICS.map((metric) => [
        metric,
        { known: count, unknown: 0 },
      ]),
    ) as PersonalFinancialScreenResponseDto["metricCoverage"],
    offset,
    limitApplied: 25,
    hasMore: offset + 25 < count,
  };
}
