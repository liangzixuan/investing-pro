import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
  PERSONAL_SEC_INSTANT_CONCEPTS,
  PERSONAL_SEC_REVENUE_CONCEPTS,
  type PersonalFinancialScreenGrowthCellDto,
  type PersonalFinancialScreenInstantCellDto,
  type PersonalFinancialScreenInstantSourceRefDto,
  type PersonalFinancialScreenRequestDto,
  type PersonalFinancialScreenResponseDto,
  type PersonalFinancialSavedViewsPayloadDto,
  type PersonalFinancialSavedViewDto,
  type PersonalFinancialSavedViewWithDisplayDto,
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
  let commit: (() => void) | undefined;
  return {
    reset() {
      states.splice(0);
      refs.splice(0);
      dependencies.splice(0);
      cleanup.clear();
      pending = [];
      commit = undefined;
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
    onCommit(callback: () => void) {
      commit = callback;
    },
    flushSync<T>(callback: () => T): T {
      const result = callback();
      commit?.();
      return result;
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
vi.mock("react-dom", () => ({
  flushSync: <T,>(callback: () => T) => harness.flushSync(callback),
}));
vi.mock("@/lib/personal-financial-screen-api", async () => ({
  ...(await import("../../lib/personal-financial-screen-api")),
  ...api,
}));
vi.mock(
  "@/lib/personal-workspace-api",
  () => import("../../lib/personal-workspace-api"),
);
import {
  PersonalWorkspaceApiError,
  type PersonalWatchlistMembership,
} from "@/lib/personal-workspace-api";
import {
  PersonalFinancialScreener,
  type PersonalFinancialScreenerProps,
} from "./PersonalFinancialScreener";
import type { OwnerSessionActivityStart } from "./owner-session-lifecycle";

const sha = (letter: string): `sha256:${string}` =>
  `sha256:${letter.repeat(64)}`;
const cashPpeMarginLabel =
  "Operating cash flow less PP&E purchases / selected revenue (%)";
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
  it("retains a pre-expansion saved Q4 layout and adds totals only after an explicit edit and save", async () => {
    const old = {
      ...savedViewFixture("old-balances"),
      display: {
        visibleMetrics: [
          "currentAssets",
          "currentLiabilities",
          "currentRatio",
          "currentAssetsLessCurrentLiabilities",
        ] as const,
      },
    };
    const untouched = { ...savedViewFixture("legacy"), display: null };
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 3,
      payload: { schemaVersion: 2, views: [old, untouched] },
    });
    api.screenPersonalFinancials.mockResolvedValue(comparisonResponse(0, 2));
    await mount();
    change(render(), "Saved financial view", old.id);
    click(render(), "Load financial view");
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    submit(render());
    await flush();
    expect(columnHeaders(render())).toEqual([
      "Company",
      "Current assets USD",
      "Current liabilities USD",
      "Current assets / current liabilities (×)",
      "Current assets less current liabilities (USD)",
      "Actions",
    ]);
    toggleColumn(render(), "Reported total assets (USD)", true);
    toggleColumn(render(), "Reported total liabilities (USD)", true);
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "totalAssets");
    change(render(), "Financial threshold 1", "1000");
    change(render(), "Financial sort field", "totalLiabilities");
    submit(render());
    await flush();
    click(render(), "Save financial view");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]![1] as Extract<
      PersonalFinancialSavedViewsPayloadDto,
      { schemaVersion: 2 }
    >;
    expect(payload.views[0]!.display?.visibleMetrics).toEqual([
      ...old.display.visibleMetrics,
      "totalAssets",
      "totalLiabilities",
    ]);
    expect(payload.views[1]).toEqual(untouched);
    expect(payload.views[0]!.criteria.clauses).toEqual([
      { field: "totalAssets", operator: "gte", value: "1000" },
    ]);
    expect(payload.views[0]!.criteria.sort.field).toBe("totalLiabilities");
    harness.unmount();
    harness.reset();
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 4,
      payload: structuredClone(payload),
    });
    await mount();
    change(render(), "Saved financial view", old.id);
    click(render(), "Load financial view");
    expect(input(render(), "Financial column view").props.value).toBe(
      "q4Balances",
    );
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledOnce();
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    click(render(), "Select CMP1 for comparison");
    click(render(), "Compare companies");
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(6);
    expect(
      comparisonMetricRows(comparisonPanel(render()))
        .slice(-2)
        .map((row) => text(row).trim()),
    ).toEqual([
      "Reported total assets (USD)",
      "Reported total liabilities (USD)",
    ]);
    expect(text(comparisonPanel(render()))).toContain(
      "Reported total assets (USD)",
    );
    expect(text(comparisonPanel(render()))).toContain(
      "Reported total liabilities (USD)",
    );
    inspectCell(
      comparisonPanel(render()),
      "Reported total liabilities (USD)",
      "CMP0",
    );
    expect(text(inspector(render()))).toContain("Exact value: 600 USD");
    expect(text(inspector(render()))).toContain("Liabilities");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["totalAssets", "Assets", "Reported total assets (USD)"],
    ["totalLiabilities", "Liabilities", "Reported total liabilities (USD)"],
  ] as const)(
    "shows exact %s signs, dates and filing without changing existing current metrics",
    async (field, concept, label) => {
      const base = response();
      const date = `${String(base.calendarYear)}-10-01`;
      const cell: PersonalFinancialScreenInstantCellDto = {
        status: "available",
        unit: "USD",
        value: "-9007199254740993.00001",
        sources: [
          {
            concept,
            asOfDate: date,
            value: "-9007199254740993.00001",
            accessionNumber: "0000000001-25-000099",
          },
        ],
      };
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...base,
        rows: base.rows.map((row) => ({
          ...row,
          metrics: { ...row.metrics, [field]: cell },
        })),
      });
      await mount();
      change(render(), "Financial column view", "q4Balances");
      submit(render());
      await flush();
      inspectCell(render(), label);
      const details = inspector(render());
      expect(text(details)).toContain(
        "Exact value: -9007199254740993.00001 USD",
      );
      expect(text(details)).toContain(`Actual balance date: ${date}`);
      expect(text(details)).toContain("Filing 0000000001-25-000099");
      expect(text(details)).toContain("October 1 through December 31");
      expect(text(details)).not.toContain(
        "Calculated by this app from reported current balances",
      );
      expect(
        elements(details).some(
          (item) =>
            item.props.href ===
            "https://www.sec.gov/Archives/edgar/data/1/000000000125000099/0000000001-25-000099-index.html",
        ),
      ).toBe(true);
      expect(
        text(inspectCell(render(), "Current assets / current liabilities (×)")),
      ).toContain("Exact value: 1.25 ×");
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    },
  );

  it.each([
    "missing",
    "source_unavailable",
    "conflicting",
    "unsupported_balance_date",
  ] as const)(
    "explains unknown total liabilities %s independently of total assets",
    async (reason) => {
      const base = response();
      const date = `${String(base.calendarYear)}-09-30`;
      const sources =
        reason === "unsupported_balance_date" || reason === "conflicting"
          ? [
              {
                concept: "Liabilities" as const,
                asOfDate: date,
                value: "-12.5",
                accessionNumber: "0000000001-25-000001",
              },
            ]
          : [];
      const cell: PersonalFinancialScreenInstantCellDto = {
        status: "unavailable",
        unit: "USD",
        reason,
        sources,
      };
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...base,
        rows: base.rows.map((row) => ({
          ...row,
          metrics: { ...row.metrics, totalLiabilities: cell },
        })),
        metricCoverage: {
          ...base.metricCoverage,
          totalLiabilities: { known: 0, unknown: 1 },
        },
      });
      await mount();
      submit(render());
      await flush();
      inspectCell(render(), "Reported total liabilities (USD)");
      expect(text(inspector(render()))).toContain(
        `Unavailable: ${reason.replaceAll("_", " ")}.`,
      );
      expect(text(inspector(render()))).toContain(
        "This is total reported liabilities, not financial debt",
      );
      expect(text(inspector(render()))).not.toContain(
        "The ratio remains unknown",
      );
      if (sources.length > 0)
        expect(text(inspector(render()))).toContain(
          `Actual balance date: ${date}`,
        );
      expect(
        text(inspectCell(render(), "Reported total assets (USD)")),
      ).toContain("Exact value: 1000 USD");
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    },
  );

  it("restores saved criteria and custom columns after remount for results and comparison without automatic requests", async () => {
    api.screenPersonalFinancials.mockResolvedValue(comparisonResponse(0, 3));
    await mount();
    change(render(), "Financial calendar year", "2024");
    change(render(), "Revenue basis", "Revenues");
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "netIncome");
    change(render(), "Financial threshold 1", "-12.5");
    change(render(), "Financial column view", "cashFlow");
    toggleColumn(render(), "Selected revenue YoY change (%)", true);
    toggleColumn(render(), "Operating cash flow margin", false);
    submit(render());
    await flush();
    const headers = columnHeaders(render());
    change(render(), "Financial view name", "Cash discipline");
    click(render(), "Save financial view");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.schemaVersion).toBe(2);
    const admitted = payload
      .views[0] as PersonalFinancialSavedViewWithDisplayDto;
    expect(admitted.display?.visibleMetrics).toEqual([
      "operatingCashFlow",
      "ppePurchases",
      "operatingCashFlowLessPpePurchases",
      "operatingCashFlowToNetIncome",
      "operatingCashFlowLessPpePurchasesMargin",
      "revenueGrowth",
    ]);
    expect(admitted.criteria.clauses).toEqual([
      { field: "netIncome", operator: "gte", value: "-12.5" },
    ]);
    expect(admitted.createdAgainstCatalogSnapshotSha256).toBe(sha("a"));
    expect(admitted.createdAgainstFinancialSnapshotSha256).toBe(sha("b"));
    harness.unmount();
    harness.reset();
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 1,
      payload: structuredClone(payload),
    });
    await mount();
    expect(input(render(), "Financial column view").props.value).toBe(
      "overview",
    );
    change(render(), "Saved financial view", admitted.id);
    click(render(), "Load financial view");
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(input(render(), "Financial calendar year").props.value).toBe(2024);
    expect(input(render(), "Revenue basis").props.value).toBe("Revenues");
    expect(input(render(), "Financial threshold 1").props.value).toBe("-12.5");
    expect(columnHeaders(render())).toEqual([]);
    expect(text(render())).toContain("Results require an explicit run");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledOnce();
    submit(render());
    await flush();
    expect(columnHeaders(render())).toEqual(headers);
    click(render(), "Select CMP0 for comparison");
    click(render(), "Select CMP1 for comparison");
    click(render(), "Compare companies");
    const comparisonRows = comparisonMetricRows(comparisonPanel(render()));
    expect(comparisonRows).toHaveLength(
      admitted.display!.visibleMetrics.length,
    );
    expect(text(comparisonPanel(render()))).toContain(
      "Selected revenue YoY change",
    );
    expect(text(comparisonPanel(render()))).not.toContain(
      "Operating cash flow margin",
    );
    change(render(), "Financial column view", "q4Balances");
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(6);
    expect(text(render())).toContain("2 of 3 companies selected");
    click(render(), "Load financial view");
    expect(columnHeaders(render())).toEqual([]);
    expect(comparisonPanel(render())).toBeUndefined();
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledOnce();
  });

  it.each([1, 2] as const)(
    "loads legacy schema %s criteria without changing columns or writing, and upgrades only after explicit save",
    async (schemaVersion) => {
      const legacy = savedViewFixture("legacy");
      const untouched = savedViewFixture("untouched");
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 4,
        payload:
          schemaVersion === 1
            ? { schemaVersion, views: [legacy, untouched] }
            : {
                schemaVersion,
                views: [legacy, untouched].map((view) => ({
                  ...view,
                  display: null,
                })),
              },
      });
      await mount();
      change(render(), "Financial column view", "q4Balances");
      change(render(), "Saved financial view", legacy.id);
      expect(text(render())).toContain("Legacy criteria-only view");
      click(render(), "Load financial view");
      expect(input(render(), "Financial column view").props.value).toBe(
        "q4Balances",
      );
      expect(input(render(), "Financial company filter").props.value).toBe(
        "legacy",
      );
      expect(text(render())).toContain("current columns were kept");
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      submit(render());
      await flush();
      click(render(), "Save financial view");
      await flush();
      const [version, payload] = api.savePersonalFinancialSavedViews.mock
        .calls[0] as [number, PersonalFinancialSavedViewsPayloadDto];
      expect(version).toBe(4);
      expect(payload).toMatchObject({
        schemaVersion: 2,
        views: [
          {
            id: legacy.id,
            display: {
              visibleMetrics: [
                "currentAssets",
                "currentLiabilities",
                "currentRatio",
                "currentAssetsLessCurrentLiabilities",
                "totalAssets",
                "totalLiabilities",
              ],
            },
          },
          { ...untouched, display: null },
        ],
      });
      expect(text(render())).not.toContain("Legacy criteria-only view");
    },
  );

  it("preserves unrelated mixed views through save-as, replacement, and deletion", async () => {
    const legacy = { ...savedViewFixture("legacy"), display: null };
    const modern = {
      ...savedViewFixture("modern"),
      display: { visibleMetrics: ["netIncome"] as const },
    };
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 7,
      payload: { schemaVersion: 2, views: [legacy, modern] },
    });
    await mount();
    change(render(), "Saved financial view", modern.id);
    click(render(), "Load financial view");
    submit(render());
    await flush();
    change(render(), "Financial column view", "cashFlow");
    change(render(), "Financial view name", "New cash view");
    click(render(), "Save financial view as new");
    await flush();
    const copied = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(copied.views.slice(0, 2)).toEqual([legacy, modern]);
    expect(copied.views[2]?.id).not.toBe(modern.id);
    change(render(), "Financial column view", "q4Balances");
    change(render(), "Financial view name", "Renamed balances");
    click(render(), "Save financial view");
    await flush();
    const replaced = api.savePersonalFinancialSavedViews.mock
      .calls[1]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(replaced.views.slice(0, 2)).toEqual([legacy, modern]);
    expect(replaced.views).toHaveLength(3);
    expect(replaced.views[2]).toMatchObject({
      id: copied.views[2]?.id,
      name: "Renamed balances",
      display: {
        visibleMetrics: [
          "currentAssets",
          "currentLiabilities",
          "currentRatio",
          "currentAssetsLessCurrentLiabilities",
          "totalAssets",
          "totalLiabilities",
        ],
      },
    });
    click(render(), "Delete financial view");
    await flush();
    expect(
      api.savePersonalFinancialSavedViews.mock.calls[2]?.slice(0, 2),
    ).toEqual([9, { schemaVersion: 2, views: [legacy, modern] }]);
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
  });

  it("deletes a legacy view without upgrading the remaining payload", async () => {
    const first = savedViewFixture("first");
    const second = savedViewFixture("second");
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 5,
      payload: { schemaVersion: 1, views: [first, second] },
    });
    await mount();
    change(render(), "Saved financial view", first.id);
    click(render(), "Delete financial view");
    await flush();
    expect(
      api.savePersonalFinancialSavedViews.mock.calls[0]?.slice(0, 2),
    ).toEqual([5, { schemaVersion: 1, views: [second] }]);
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
  });

  it.each(["catalog", "watchlist"] as const)(
    "loads stored columns and criteria while preserving the current %s cohort",
    async (scope) => {
      configureWatchlist(3);
      const memberships = props.watchlistMemberships;
      const modern = {
        ...savedViewFixture("balances"),
        display: { visibleMetrics: ["currentRatio"] },
      };
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 2,
        payload: { schemaVersion: 2, views: [modern] },
      });
      await mount();
      if (scope === "watchlist") {
        change(render(), "Financial screen scope", scope);
        selectFinancialListing(render(), "CMP1", true);
      }
      change(render(), "Saved financial view", modern.id);
      click(render(), "Load financial view");
      expect(input(render(), "Financial screen scope").props.value).toBe(scope);
      expect(props.watchlistMemberships).toBe(memberships);
      if (scope === "watchlist")
        expect(text(render())).toContain("1 of 3 saved listings selected");
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      api.screenPersonalFinancials.mockImplementationOnce(
        (request: PersonalFinancialScreenRequestDto) =>
          Promise.resolve(
            scope === "watchlist" ? watchlistResponse(request) : response(),
          ),
      );
      submit(render());
      await flush();
      expect(columnHeaders(render())).toEqual([
        "Company",
        "Current assets / current liabilities (×)",
        "Actions",
      ]);
      if (scope === "watchlist")
        expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toMatchObject({
          scope: { listingIds: ["listing-1"] },
        });
    },
  );

  it.each(["save", "delete"] as const)(
    "reloads mixed definitions after a %s conflict without losing unrelated layouts",
    async (action) => {
      const legacy = { ...savedViewFixture("legacy"), display: null };
      const original = {
        ...savedViewFixture("modern"),
        display: { visibleMetrics: ["revenue"] },
      };
      const changed = {
        ...original,
        display: { visibleMetrics: ["netIncome", "currentRatio"] },
      };
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 3,
        payload: { schemaVersion: 2, views: [legacy, original] },
      });
      await mount();
      change(render(), "Saved financial view", original.id);
      click(render(), "Load financial view");
      submit(render());
      await flush();
      const stale = render();
      api.savePersonalFinancialSavedViews.mockRejectedValueOnce(
        new PersonalWorkspaceApiError("conflict"),
      );
      click(
        render(),
        action === "save" ? "Save financial view" : "Delete financial view",
      );
      await flush();
      expect(text(render())).toContain("changed elsewhere");
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 4,
        payload: { schemaVersion: 2, views: [legacy, changed] },
      });
      click(render(), "Reload saved views");
      await flush();
      click(stale, "Load financial view");
      expect(input(render(), "Financial column view").props.value).toBe(
        "custom",
      );
      change(render(), "Saved financial view", changed.id);
      click(render(), "Load financial view");
      submit(render());
      await flush();
      click(render(), "Save financial view");
      await flush();
      expect(
        api.savePersonalFinancialSavedViews.mock.calls[1]?.slice(0, 2),
      ).toEqual([
        4,
        {
          schemaVersion: 2,
          views: [
            legacy,
            { ...changed, createdAgainstFinancialSnapshotSha256: sha("b") },
          ],
        },
      ]);
    },
  );

  it.each([
    "selection",
    "name",
    "criteria",
    "columns",
    "response",
    "payload",
    "scope",
    "catalog",
    "workspace",
    "disabled",
  ] as const)(
    "ignores retained saved-view callbacks after a newer %s",
    async (changeKind) => {
      const first = {
        ...savedViewFixture("first"),
        display: { visibleMetrics: ["revenue"] },
      };
      const second = {
        ...savedViewFixture("second"),
        display: { visibleMetrics: ["netIncome"] },
      };
      const record = {
        version: 3,
        payload: { schemaVersion: 2, views: [first, second] },
      };
      api.fetchPersonalFinancialSavedViews.mockResolvedValue(record);
      await mount();
      change(render(), "Saved financial view", first.id);
      click(render(), "Load financial view");
      submit(render());
      await flush();
      const stale = render();
      if (changeKind === "selection")
        change(render(), "Saved financial view", second.id);
      else if (changeKind === "name")
        change(render(), "Financial view name", "New draft");
      else if (changeKind === "criteria")
        change(render(), "Financial company filter", "New criteria");
      else if (changeKind === "columns")
        change(render(), "Financial column view", "cashFlow");
      else if (changeKind === "response") {
        submit(render());
        await flush();
      } else if (changeKind === "payload") {
        api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
          version: 4,
          payload: { schemaVersion: 2, views: [second] },
        });
        click(render(), "Reload saved views");
        await flush();
      } else if (changeKind === "scope")
        change(render(), "Financial screen scope", "watchlist");
      else {
        props =
          changeKind === "catalog"
            ? {
                ...props,
                snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
              }
            : {
                ...props,
                ...(changeKind === "workspace"
                  ? { workspaceReady: false }
                  : { disabled: true }),
              };
        render();
        await flush();
      }
      const before = text(render());
      const readCount = api.fetchPersonalFinancialSavedViews.mock.calls.length;
      click(stale, "Load financial view");
      click(stale, "Save financial view");
      click(stale, "Save financial view as new");
      click(stale, "Delete financial view");
      click(stale, "Reload saved views");
      change(stale, "Saved financial view", first.id);
      change(stale, "Financial view name", "Stale draft");
      await flush();
      expect(text(render())).toBe(before);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledTimes(
        readCount,
      );
    },
  );

  it.each(["save", "saveAs", "delete"] as const)(
    "does not reselect or overwrite a newer view when pending %s completes",
    async (action) => {
      const first = {
        ...savedViewFixture("first"),
        display: { visibleMetrics: ["revenue"] },
      };
      const second = {
        ...savedViewFixture("second"),
        display: { visibleMetrics: ["netIncome"] },
      };
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 3,
        payload: { schemaVersion: 2, views: [first, second] },
      });
      await mount();
      change(render(), "Saved financial view", first.id);
      click(render(), "Load financial view");
      submit(render());
      await flush();
      if (action === "saveAs")
        change(render(), "Financial view name", "Copy first");
      const pending = deferred<{
        version: number;
        payload: PersonalFinancialSavedViewsPayloadDto;
      }>();
      api.savePersonalFinancialSavedViews.mockReturnValueOnce(pending.promise);
      const stale = render();
      click(
        stale,
        action === "delete"
          ? "Delete financial view"
          : action === "saveAs"
            ? "Save financial view as new"
            : "Save financial view",
      );
      click(stale, "Save financial view");
      click(stale, "Load financial view");
      click(stale, "Reload saved views");
      expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledOnce();
      expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledOnce();
      change(render(), "Saved financial view", second.id);
      change(render(), "Financial view name", "Newer draft");
      pending.resolve({
        version: 4,
        payload: api.savePersonalFinancialSavedViews.mock
          .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto,
      });
      await flush();
      expect(input(render(), "Saved financial view").props.value).toBe(
        second.id,
      );
      expect(input(render(), "Financial view name").props.value).toBe(
        "Newer draft",
      );
      click(render(), "Load financial view");
      expect(input(render(), "Financial company filter").props.value).toBe(
        "second",
      );
      expect(input(render(), "Financial view name").props.value).toBe(
        second.name,
      );
      submit(render());
      await flush();
      expect(columnHeaders(render())).toEqual([
        "Company",
        "Net income USD",
        "Actions",
      ]);
    },
  );

  it.each(["catalog", "workspace"] as const)(
    "rejects saved callbacks from a new %s render before its boundary effect",
    async (boundary) => {
      const legacy = savedViewFixture("legacy");
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 3,
        payload: { schemaVersion: 1, views: [legacy] },
      });
      await mount();
      change(render(), "Saved financial view", legacy.id);
      click(render(), "Load financial view");
      submit(render());
      await flush();
      props =
        boundary === "catalog"
          ? {
              ...props,
              snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
            }
          : { ...props, workspaceReady: false };
      render((newBoundary) => {
        click(newBoundary, "Load financial view");
        click(newBoundary, "Save financial view");
        click(newBoundary, "Delete financial view");
        click(newBoundary, "Reload saved views");
        expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
        expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledOnce();
      });
      await flush();
      expect(input(render(), "Financial view name").props.value).toBe("");
    },
  );

  it.each(["selection", "name"] as const)(
    "does not revive retained callbacks after a %s changes away and back",
    async (field) => {
      const legacy = savedViewFixture("legacy");
      api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
        version: 3,
        payload: { schemaVersion: 1, views: [legacy] },
      });
      await mount();
      change(render(), "Saved financial view", legacy.id);
      click(render(), "Load financial view");
      submit(render());
      await flush();
      const stale = render();
      const label =
        field === "selection" ? "Saved financial view" : "Financial view name";
      change(render(), label, "");
      change(render(), label, field === "selection" ? legacy.id : legacy.name);
      click(stale, "Load financial view");
      click(stale, "Save financial view");
      click(stale, "Delete financial view");
      click(stale, "Reload saved views");
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledOnce();
      expect(text(render())).toContain("Open ONE");
      click(render(), "Save financial view");
      await flush();
      expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledOnce();
    },
  );

  it("keeps catalog requests unchanged and watchlist selection explicit", async () => {
    configureWatchlist(3);
    await mount();
    expect(input(render(), "Financial screen scope").props.value).toBe(
      "catalog",
    );
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).not.toHaveProperty(
      "scope",
    );
    change(render(), "Financial screen scope", "watchlist");
    expect(text(render())).toContain("0 of 3 saved listings selected");
    expect(button(render(), "Run financial screen").props.disabled).toBe(true);
    submit(render());
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    selectFinancialListing(render(), "CMP1", true);
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    api.screenPersonalFinancials.mockImplementationOnce(
      (request: PersonalFinancialScreenRequestDto) =>
        Promise.resolve(watchlistResponse(request)),
    );
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls[1]?.[0]).toMatchObject({
      scope: {
        kind: "watchlist",
        watchlistVersion: 7,
        listingIds: ["listing-1"],
      },
    });
    expect(text(render())).toContain("1 selected saved listings");
    expect(text(render())).toContain("My Watchlist contains 3 saved listings");
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it("makes empty and unavailable watchlists actionable without source requests", async () => {
    configureWatchlist(0);
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    expect(text(render())).toContain(
      "My Watchlist is empty. Add companies from Security search or catalog financial results",
    );
    expect(button(render(), "Run financial screen").props.disabled).toBe(true);
    expect(button(render(), "Refresh SEC data").props.disabled).toBe(true);
    props = { ...props, watchlistAvailable: false };
    render();
    expect(text(render())).toContain(
      "My Watchlist is unavailable or needs reconciliation",
    );
    submit(render());
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
  });

  it("limits explicit selection to20 across searchable pages without changing membership", async () => {
    configureWatchlist(55);
    const originalMembers = props.watchlistMemberships;
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    expect(text(render())).toContain("1 – 50 of 55 matching saved listings");
    click(render(), "Select first 20 for financials");
    expect(text(render())).toContain("20 of 55 saved listings selected");
    expect(financialListing(render(), "CMP20").props.disabled).toBe(true);
    selectFinancialListing(render(), "CMP20", true);
    expect(text(render())).toContain("20 of 55 saved listings selected");
    click(render(), "Next financial selections");
    expect(text(render())).toContain("51 – 55 of 55 matching saved listings");
    change(render(), "Find a saved financial listing", "CMP54");
    expect(text(render())).toContain("1 – 1 of 1 matching saved listings");
    click(render(), "Clear financial selection");
    selectFinancialListing(render(), "CMP54", true);
    expect(text(render())).toContain("1 of 55 saved listings selected");
    expect(props.watchlistMemberships).toBe(originalMembers);
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
  });

  it("retains explicit filters and year through scope changes, starters and saved criteria while never saving scope", async () => {
    configureWatchlist(3);
    await mount();
    change(render(), "Financial calendar year", "2023");
    click(render(), "Add financial filter");
    change(render(), "Financial threshold 1", "10");
    change(render(), "Financial screen scope", "watchlist");
    click(render(), "Select all for financials");
    expect(input(render(), "Financial calendar year").props.value).toBe(2023);
    expect(input(render(), "Financial threshold 1").props.value).toBe("10");
    api.screenPersonalFinancials.mockImplementation(
      (request: PersonalFinancialScreenRequestDto) =>
        Promise.resolve(watchlistResponse(request)),
    );
    submit(render());
    await flush();
    change(render(), "Financial view name", "Watchlist filters");
    click(render(), "Save financial view");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.schemaVersion).toBe(2);
    expect(JSON.stringify(payload)).not.toContain("listingIds");
    expect(JSON.stringify(payload)).not.toContain("watchlistVersion");
    expect(JSON.stringify(payload)).not.toContain('"scope"');
    click(render(), "Reset financial criteria");
    click(render(), "Load financial view");
    expect(input(render(), "Financial threshold 1").props.value).toBe("10");
    expect(text(render())).toContain("3 of 3 saved listings selected");
    click(render(), "Apply Q4 liquidity cover");
    expect(text(render())).toContain("3 of 3 saved listings selected");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
  });

  it("reuses all20 columns, comparison and source inspection for selected saved companies", async () => {
    configureWatchlist(3);
    api.screenPersonalFinancials.mockImplementation(
      (request: PersonalFinancialScreenRequestDto) =>
        Promise.resolve(watchlistResponse(request)),
    );
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    click(render(), "Select all for financials");
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    click(render(), "Select CMP1 for comparison");
    click(render(), "Compare companies");
    change(render(), "Financial column view", "all");
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(20);
    const comparison = comparisonPanel(render());
    expect(text(comparison)).toContain(cashPpeMarginLabel);
    const cell = ratioCell(
      comparisonPanel(render()),
      "Reported total assets (USD)",
      "CMP0",
    )!;
    (cell.props.onClick as (event: unknown) => void)({ currentTarget: null });
    expect(text(inspector(render()))).toContain("Exact value");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    selectFinancialListing(render(), "CMP2", false);
    expect(comparisonPanel(render())).toBeUndefined();
    expect(inspector(render())).toBeUndefined();
    expect(text(render())).not.toContain("Financial results");
  });

  it.each([
    "scope",
    "selection",
    "version",
    "identity",
    "availability",
    "snapshot",
    "session",
  ] as const)(
    "discards pending watchlist data and stale callbacks after %s changes",
    async (changeKind) => {
      configureWatchlist(3);
      const pending = deferred<PersonalFinancialScreenResponseDto>();
      api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
      await mount();
      change(render(), "Financial screen scope", "watchlist");
      click(render(), "Select all for financials");
      const oldView = render();
      submit(oldView);
      const request = api.screenPersonalFinancials.mock
        .calls[0]?.[0] as PersonalFinancialScreenRequestDto;
      const signal = api.screenPersonalFinancials.mock
        .calls[0]?.[1] as AbortSignal;
      const result = watchlistResponse(request);
      if (changeKind === "scope")
        change(render(), "Financial screen scope", "catalog");
      if (changeKind === "selection")
        selectFinancialListing(render(), "CMP2", false);
      if (changeKind === "version") props = { ...props, watchlistVersion: 8 };
      if (changeKind === "identity")
        props = {
          ...props,
          watchlistMemberships: props.watchlistMemberships!.map(
            (member, index) =>
              index === 0
                ? { ...member, issuerName: "Changed issuer" }
                : member,
          ),
        };
      if (changeKind === "availability")
        props = { ...props, watchlistAvailable: false };
      if (changeKind === "snapshot")
        props = {
          ...props,
          snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
        };
      if (changeKind === "session") props = { ...props, disabled: true };
      render(() => submit(oldView));
      pending.resolve(result);
      await flush();
      expect(signal.aborted).toBe(true);
      expect(text(render())).not.toContain("Financial results");
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
      expect(activityCompletion).not.toHaveBeenCalled();
    },
  );

  it("preserves catalog results and comparison when the saved watchlist version changes", async () => {
    configureWatchlist(3);
    api.screenPersonalFinancials.mockResolvedValueOnce(
      comparisonResponse(0, 3),
    );
    await mount();
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    props = {
      ...props,
      watchlistVersion: 8,
      watchlistMemberships: props.watchlistMemberships!.slice(1),
    };
    render();
    expect(text(render())).toContain("Financial results");
    expect(text(render())).toContain("1 of 3 companies selected");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
  });

  it("clears completed watchlist comparison and source details before a version change can reuse callbacks", async () => {
    configureWatchlist(3);
    api.screenPersonalFinancials.mockImplementation(
      (request: PersonalFinancialScreenRequestDto) =>
        Promise.resolve(watchlistResponse(request)),
    );
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    click(render(), "Select all for financials");
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    click(render(), "Select CMP1 for comparison");
    click(render(), "Compare companies");
    const staleSelection = button(render(), "Select CMP2 for comparison");
    const staleCell = ratioCell(comparisonPanel(render()), "Revenue", "CMP0")!;
    (staleCell.props.onClick as (event: unknown) => void)({
      currentTarget: null,
    });
    expect(inspector(render())).toBeDefined();
    props = { ...props, watchlistVersion: 8 };
    render((view) => {
      expect(comparisonPanel(view)).toBeUndefined();
      expect(inspector(view)).toBeUndefined();
      staleSelection.props.onClick?.();
      (staleCell.props.onClick as (event: unknown) => void)({
        currentTarget: null,
      });
    });
    expect(text(render())).toContain("0 of 3 saved listings selected");
    expect(comparisonPanel(render())).toBeUndefined();
    expect(inspector(render())).toBeUndefined();
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
  });

  it("clears selected listings on a server watchlist conflict and explains recovery", async () => {
    configureWatchlist(3);
    api.screenPersonalFinancials.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    click(render(), "Select all for financials");
    submit(render());
    await flush();
    expect(text(render())).toContain(
      "My Watchlist, the catalog or SEC data changed",
    );
    expect(text(render())).toContain("0 of 3 saved listings selected");
    expect(button(render(), "Run financial screen").props.disabled).toBe(true);
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });

  it.each([
    "country",
    "exchangeMic",
    "instrumentType",
    "issuerId",
    "issuerName",
    "listingId",
    "securityId",
    "securityName",
    "shareClassId",
    "shareClassName",
    "symbol",
  ] as const)(
    "rejects a returned watchlist identity with changed %s",
    async (field) => {
      configureWatchlist(1);
      api.screenPersonalFinancials.mockImplementationOnce(
        (request: PersonalFinancialScreenRequestDto) => {
          const result = watchlistResponse(request);
          return Promise.resolve({
            ...result,
            rows: result.rows.map((row) => ({
              ...row,
              identity: { ...row.identity, [field]: "changed" },
            })),
          });
        },
      );
      await mount();
      change(render(), "Financial screen scope", "watchlist");
      click(render(), "Select all for financials");
      submit(render());
      await flush();
      expect(text(render())).toContain("financial response failed validation");
      expect(text(render())).not.toContain("Financial results");
    },
  );

  it("rejects a response describing another total saved-watchlist count", async () => {
    configureWatchlist(1);
    api.screenPersonalFinancials.mockImplementationOnce(
      (request: PersonalFinancialScreenRequestDto) => {
        const result = watchlistResponse(request);
        return Promise.resolve({
          ...result,
          scope: { ...result.scope!, totalWatchlistListings: 2 },
        });
      },
    );
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    click(render(), "Select all for financials");
    submit(render());
    await flush();
    expect(text(render())).toContain("financial response failed validation");
  });

  it.each([
    {
      name: "Growth with cash after PP&E",
      clauses: [
        { field: "revenueGrowth", operator: "gte", value: "5" },
        {
          field: "operatingCashFlowLessPpePurchases",
          operator: "gte",
          value: "0",
        },
      ],
      sort: "revenueGrowth",
      columns: [
        "Revenue USD",
        "Operating cash flow USD",
        "PP&E purchases USD",
        "Operating cash flow less PP&E purchases USD",
        "Selected revenue YoY change (%)",
      ],
    },
    {
      name: "Cash flow relative to income",
      clauses: [
        {
          field: "operatingCashFlowToNetIncome",
          operator: "gte",
          value: "100",
        },
      ],
      sort: "operatingCashFlowToNetIncome",
      columns: [
        "Net income USD",
        "Operating cash flow USD",
        "Operating cash flow / net income (%)",
      ],
    },
    {
      name: "Q4 liquidity cover",
      clauses: [{ field: "currentRatio", operator: "gte", value: "1" }],
      sort: "currentRatio",
      columns: [
        "Current assets USD",
        "Current liabilities USD",
        "Current assets / current liabilities (×)",
      ],
    },
  ])(
    "applies $name as editable ordinary criteria without fetching or saving",
    async ({ name, clauses, sort, columns }) => {
      await mount();
      change(render(), "Financial calendar year", "2009");
      change(render(), "Revenue basis", "Revenues");
      change(render(), "Financial company filter", "  Scoped company  ");
      click(render(), "Add financial filter");
      change(render(), "Financial threshold 1", "999");
      change(render(), "Financial column view", "all");
      click(render(), `Apply ${name}`);
      const applied = render();
      expect(input(applied, "Financial calendar year").props.value).toBe(2009);
      expect(input(applied, "Revenue basis").props.value).toBe("Revenues");
      expect(input(applied, "Financial company filter").props.value).toBe(
        "  Scoped company  ",
      );
      expect(input(applied, "Financial sort field").props.value).toBe(sort);
      expect(input(applied, "Financial sort direction").props.value).toBe(
        "desc",
      );
      for (const [index, clause] of clauses.entries()) {
        expect(
          input(applied, `Financial metric ${String(index + 1)}`).props.value,
        ).toBe(clause.field);
        expect(
          input(applied, `Financial comparison ${String(index + 1)}`).props
            .value,
        ).toBe(clause.operator);
        expect(
          input(applied, `Financial threshold ${String(index + 1)}`).props
            .value,
        ).toBe(clause.value);
      }
      expect(
        elements(applied).filter((item) =>
          /^Financial metric \d+$/u.test(String(item.props["aria-label"])),
        ),
      ).toHaveLength(clauses.length);
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledOnce();
      expect(activityStart).not.toHaveBeenCalled();
      expect(props.onAddToWatchlist).not.toHaveBeenCalled();
      expect(text(applied)).toContain("Sparse, illustrative starting points");
      expect(text(applied)).toContain(
        "combining filters does not establish a common period",
      );
      expect(text(applied)).toContain("requires positive prior revenue");
      expect(text(applied)).toContain("Requires positive net income");
      expect(text(applied)).toContain("positive liabilities");
      submit(applied);
      await flush();
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
      expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toEqual({
        schemaVersion: "10.0.0",
        catalogSnapshotSha256: sha("a"),
        financialSnapshotSha256: null,
        criteria: {
          calendarYear: 2009,
          revenueBasis: "Revenues",
          identityText: "Scoped company",
          clauses,
          sort: { field: sort, direction: "desc" },
        },
        page: { offset: 0, limit: 25 },
        refresh: false,
      });
      expect(columnHeaders(render())).toEqual([
        "Company",
        ...columns,
        "Actions",
      ]);
      change(render(), "Financial threshold 1", "7.5");
      change(render(), "Financial comparison 1", "lte");
      change(render(), "Financial sort direction", "asc");
      expect(input(render(), "Financial threshold 1").props.value).toBe("7.5");
      expect(input(render(), "Financial comparison 1").props.value).toBe("lte");
      expect(input(render(), "Financial sort direction").props.value).toBe(
        "asc",
      );
      expect(text(render())).not.toContain("Open ONE");
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    },
  );

  it("clears a result and source inspector when applying a starter without restoring focus or crediting activity", async () => {
    await mount();
    submit(render());
    await flush();
    const focus = vi.fn();
    const trigger = {
      isConnected: true,
      focus,
    } as unknown as HTMLButtonElement;
    inspectCell(render(), "Net income", "ONE", trigger);
    const oldButton = ratioCell(render(), "Net income")!;
    expect(inspector(render())).toBeDefined();
    click(render(), "Apply Growth with cash after PP&E");
    expect(inspector(render())).toBeUndefined();
    expect(text(render())).not.toContain("Open ONE");
    (
      oldButton.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
      }) => void
    )({ currentTarget: trigger });
    expect(inspector(render())).toBeUndefined();
    expect(focus).not.toHaveBeenCalled();
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(activityStart).toHaveBeenCalledOnce();
    expect(activityCompletion).toHaveBeenCalledOnce();
  });

  it.each(["success", "session rejection"])(
    "ignores a prior in-flight %s after applying a starter",
    async (outcome) => {
      await mount();
      let resolve!: (value: PersonalFinancialScreenResponseDto) => void;
      let reject!: (reason: Error) => void;
      api.screenPersonalFinancials.mockReturnValueOnce(
        new Promise<PersonalFinancialScreenResponseDto>((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      submit(render());
      const signal = api.screenPersonalFinancials.mock
        .calls[0]?.[1] as AbortSignal;
      click(render(), "Apply Q4 liquidity cover");
      expect(signal.aborted).toBe(true);
      if (outcome === "success") resolve(response());
      else reject(new PersonalWorkspaceApiError("session_unavailable"));
      await flush();
      expect(text(render())).not.toContain("Open ONE");
      expect(text(render())).toContain("Q4 liquidity cover applied");
      expect(input(render(), "Financial metric 1").props.value).toBe(
        "currentRatio",
      );
      expect(button(render(), "Run financial screen").props.disabled).toBe(
        false,
      );
      expect(activityCompletion).not.toHaveBeenCalled();
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it("detaches a starter from the selected saved screen and round-trips edited criteria and columns using saved v2", async () => {
    const legacy = {
      id: "financial-screen-original",
      name: "Original financial screen",
      criteria: {
        calendarYear: 2009,
        identityText: "Retained company",
        clauses: [],
        sort: { field: "symbol" as const, direction: "asc" as const },
      },
      createdAgainstCatalogSnapshotSha256: sha("a"),
      createdAgainstFinancialSnapshotSha256: sha("c"),
    };
    api.fetchPersonalFinancialSavedViews.mockResolvedValueOnce({
      version: 3,
      payload: { schemaVersion: 1, views: [structuredClone(legacy)] },
    });
    await mount();
    change(render(), "Saved financial view", legacy.id);
    click(render(), "Load financial view");
    change(render(), "Financial view name", "Unsaved rename");
    click(render(), "Apply Growth with cash after PP&E");
    expect(input(render(), "Saved financial view").props.value).toBe("");
    expect(input(render(), "Financial view name").props.value).toBe("");
    expect(button(render(), "Load financial view").props.disabled).toBe(true);
    expect(button(render(), "Delete financial view").props.disabled).toBe(true);
    click(render(), "Save financial view");
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    change(render(), "Financial threshold 1", "7.5");
    submit(render());
    await flush();
    change(render(), "Financial view name", "Edited growth starter");
    click(render(), "Save financial view");
    await flush();
    const [version, payload] = api.savePersonalFinancialSavedViews.mock
      .calls[0] as [number, PersonalFinancialSavedViewsPayloadDto];
    expect(version).toBe(3);
    expect(Object.keys(payload).sort()).toEqual(["schemaVersion", "views"]);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.views).toHaveLength(2);
    expect(payload.views[0]).toEqual({ ...legacy, display: null });
    expect(payload.views[1]?.id).not.toBe(legacy.id);
    expect(Object.keys(payload.views[1]!).sort()).toEqual([
      "createdAgainstCatalogSnapshotSha256",
      "createdAgainstFinancialSnapshotSha256",
      "criteria",
      "display",
      "id",
      "name",
    ]);
    expect(payload.views[1]?.criteria).toEqual({
      calendarYear: 2009,
      identityText: "Retained company",
      clauses: [
        { field: "revenueGrowth", operator: "gte", value: "7.5" },
        {
          field: "operatingCashFlowLessPpePurchases",
          operator: "gte",
          value: "0",
        },
      ],
      sort: { field: "revenueGrowth", direction: "desc" },
    });
    click(render(), "Reset financial criteria");
    click(render(), "Load financial view");
    expect(input(render(), "Financial threshold 1").props.value).toBe("7.5");
    expect(input(render(), "Financial calendar year").props.value).toBe(2009);
    expect(input(render(), "Financial company filter").props.value).toBe(
      "Retained company",
    );
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    change(render(), "Saved financial view", legacy.id);
    click(render(), "Load financial view");
    expect(input(render(), "Financial sort field").props.value).toBe("symbol");
    expect(input(render(), "Financial view name").props.value).toBe(
      legacy.name,
    );
    expect(
      elements(render()).some(
        (item) => item.props["aria-label"] === "Financial metric 1",
      ),
    ).toBe(false);
  });

  it("blocks starter application while saved screens load", async () => {
    const loading = deferred<null>();
    api.fetchPersonalFinancialSavedViews.mockReturnValueOnce(loading.promise);
    await mount();
    expect(button(render(), "Apply Q4 liquidity cover").props.disabled).toBe(
      true,
    );
    click(render(), "Apply Q4 liquidity cover");
    expect(input(render(), "Financial sort field").props.value).toBe("symbol");
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    loading.resolve(null);
    await flush();
    expect(button(render(), "Apply Q4 liquidity cover").props.disabled).toBe(
      false,
    );
    click(render(), "Apply Q4 liquidity cover");
    expect(input(render(), "Financial metric 1").props.value).toBe(
      "currentRatio",
    );
  });

  it("blocks starter application during a saved write so its completion cannot reattach an older selection", async () => {
    await mount();
    submit(render());
    await flush();
    change(render(), "Financial view name", "In-flight saved screen");
    const saving = deferred<{
      version: number;
      payload: PersonalFinancialSavedViewsPayloadDto;
    }>();
    api.savePersonalFinancialSavedViews.mockReturnValueOnce(saving.promise);
    click(render(), "Save financial view");
    const pendingPayload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(
      button(render(), "Apply Cash flow relative to income").props.disabled,
    ).toBe(true);
    click(render(), "Apply Cash flow relative to income");
    expect(input(render(), "Financial sort field").props.value).toBe("symbol");
    expect(input(render(), "Financial view name").props.value).toBe(
      "In-flight saved screen",
    );
    saving.resolve({ version: 1, payload: pendingPayload });
    await flush();
    expect(input(render(), "Saved financial view").props.value).toBe(
      pendingPayload.views[0]?.id,
    );
    click(render(), "Apply Cash flow relative to income");
    expect(input(render(), "Saved financial view").props.value).toBe("");
    expect(input(render(), "Financial view name").props.value).toBe("");
    expect(input(render(), "Financial metric 1").props.value).toBe(
      "operatingCashFlowToNetIncome",
    );
    expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledOnce();
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(activityStart).toHaveBeenCalledOnce();
  });

  it("filters and saves selected revenue change while showing both annual operands and filing roles", async () => {
    api.screenPersonalFinancials.mockResolvedValueOnce(growthResponse());
    await mount();
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "revenueGrowth");
    change(render(), "Financial comparison 1", "gte");
    change(render(), "Financial threshold 1", "-10.5");
    change(render(), "Financial sort field", "revenueGrowth");
    change(render(), "Financial sort direction", "desc");
    expect(text(render())).toContain("Threshold ( % )");
    expect(
      elements(render()).find(
        (item) => item.props["aria-label"] === "Financial threshold 1",
      )?.props.placeholder,
    ).toBe("15 = 15%");
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toMatchObject({
      schemaVersion: "10.0.0",
      criteria: {
        clauses: [{ field: "revenueGrowth", operator: "gte", value: "-10.5" }],
        sort: { field: "revenueGrowth", direction: "desc" },
      },
    });
    expect(columnHeaders(render())).not.toContain(
      "Selected revenue YoY change (%)",
    );
    const details = inspectCell(render(), "Selected revenue YoY change (%)");
    expect(text(details)).toContain("Exact value: 25.00 percent");
    expect(text(details)).toContain("Current selected revenue: 15 USD");
    expect(text(details)).toContain("Prior selected revenue: 12 USD");
    expect(text(details)).toContain("does not measure organic growth");
    const cards = elements(details).filter((item) => item.type === "article");
    expect(cards).toHaveLength(2);
    expect(text(cards[0])).toContain(
      `Current selected revenue · CY ${String(new Date().getUTCFullYear() - 1)}`,
    );
    expect(text(cards[1])).toContain(
      `Prior selected revenue · CY ${String(new Date().getUTCFullYear() - 2)}`,
    );
    const links = elements(details).filter((item) => item.type === "a");
    expect(links.map((item) => item.props.href)).toEqual([
      "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/0000000001-25-000001-index.html",
      "https://www.sec.gov/Archives/edgar/data/1/000000000124000002/0000000001-24-000002-index.html",
    ]);
    change(render(), "Financial view name", "Revenue change");
    click(render(), "Save financial view");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.schemaVersion).toBe(2);
    expect(payload.views[0]?.criteria).toEqual(
      (
        api.screenPersonalFinancials.mock
          .calls[0]?.[0] as PersonalFinancialScreenRequestDto
      ).criteria,
    );
    click(render(), "Reset financial criteria");
    click(render(), "Load financial view");
    expect(input(render(), "Financial metric 1").props.value).toBe(
      "revenueGrowth",
    );
    expect(input(render(), "Financial threshold 1").props.value).toBe("-10.5");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    expect(inspector(render())).toBeUndefined();
  });

  it.each([
    ["-100.00", "-100.00%", "0", "12"],
    ["-150.00", "-150.00%", "-6", "12"],
    ["0.00", "0.00%", "12", "12"],
    [
      `${"9".repeat(128)}.00`,
      `${"9".repeat(128).replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}.00%`,
      "15",
      "12",
    ],
  ])(
    "preserves exact revenue-change display %s without Number coercion",
    async (value, display, current, prior) => {
      api.screenPersonalFinancials.mockResolvedValueOnce(
        growthResponse(defaultGrowthCell(value, current, prior)),
      );
      await mount();
      submit(render());
      await flush();
      change(render(), "Financial column view", "all");
      expect(text(ratioCell(render(), "Selected revenue YoY change (%)"))).toBe(
        display,
      );
    },
  );

  it.each([
    ["concept_set_changed", "revenue concepts changed between years"],
    ["nonadjacent_periods", "annual periods overlap or leave a gap"],
    ["nonpositive_prior_revenue", "Prior selected revenue is zero or negative"],
    ["filing_mismatch", "different filings across the two years are allowed"],
    ["period_mismatch", "consistent supported annual periods"],
  ] as const)(
    "explains revenue-change %s and retains both reference sets",
    async (reason, explanation) => {
      const { currentRevenue, priorRevenue, sources } = defaultGrowthCell();
      const cell = {
        unit: "percent" as const,
        currentRevenue,
        priorRevenue,
        sources,
      };
      api.screenPersonalFinancials.mockResolvedValueOnce(
        growthResponse({ ...cell, status: "unavailable", reason }),
      );
      await mount();
      submit(render());
      await flush();
      const details = inspectCell(render(), "Selected revenue YoY change (%)");
      expect(text(details)).toContain(explanation);
      expect(text(details)).toContain("Reported: 15 USD");
      expect(text(details)).toContain("Reported: 12 USD");
      expect(text(details)).not.toContain("Exact value:");
    },
  );

  it("keeps an unavailable prior operand distinct from current revenue and preserves prior source status", async () => {
    const { currentRevenue, priorRevenue, sources } = defaultGrowthCell();
    const cell = {
      unit: "percent" as const,
      currentRevenue,
      priorRevenue,
      sources,
    };
    const result = growthResponse({
      ...cell,
      status: "unavailable",
      reason: "prior_unavailable",
      priorRevenue: {
        status: "unavailable",
        unit: "USD",
        reason: "source_unavailable",
        sources: [],
      },
      sources: cell.sources.filter(
        (source) => source.role === "current_revenue",
      ),
    });
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      priorRevenueSources: result.priorRevenueSources.map((source) => ({
        ...source,
        status: "rate_limited",
      })),
    });
    await mount();
    submit(render());
    await flush();
    const details = inspectCell(render(), "Selected revenue YoY change (%)");
    expect(text(details)).toContain(
      "Prior selected revenue is unresolved (source unavailable)",
    );
    expect(text(details)).toContain("Current selected revenue: 15 USD");
    expect(text(render())).toContain("SEC source coverage is partial");
    const priorLinks = elements(render()).filter(
      (item) => item.type === "a" && text(item).includes("Prior revenue · CY"),
    );
    expect(priorLinks).toHaveLength(3);
    expect(
      priorLinks.every((item) =>
        String(item.props.href).endsWith(
          `CY${String(result.priorCalendarYear)}.json`,
        ),
      ),
    ).toBe(true);
  });

  it.each([
    [
      "overview",
      [
        "Revenue USD",
        "Net income USD",
        "Operating cash flow USD",
        "Net margin %",
        "Current assets / current liabilities (×)",
      ],
    ],
    [
      "profitability",
      [
        "Revenue USD",
        "Gross profit USD",
        "Net income USD",
        "Operating income USD",
        "Net margin %",
        "Operating margin %",
        "Gross profit / selected revenue (%)",
      ],
    ],
    [
      "cashFlow",
      [
        "Operating cash flow USD",
        "Operating cash flow margin %",
        "PP&E purchases USD",
        "Operating cash flow less PP&E purchases USD",
        "Operating cash flow / net income (%)",
        "Operating cash flow less PP&E purchases / selected revenue (%)",
      ],
    ],
    [
      "q4Balances",
      [
        "Current assets USD",
        "Current liabilities USD",
        "Current assets / current liabilities (×)",
        "Current assets less current liabilities (USD)",
        "Reported total assets (USD)",
        "Reported total liabilities (USD)",
      ],
    ],
    [
      "all",
      [
        "Revenue USD",
        "Gross profit USD",
        "Net income USD",
        "Operating income USD",
        "Operating cash flow USD",
        "Net margin %",
        "Operating margin %",
        "Operating cash flow margin %",
        "PP&E purchases USD",
        "Operating cash flow less PP&E purchases USD",
        "Gross profit / selected revenue (%)",
        "Operating cash flow / net income (%)",
        "Operating cash flow less PP&E purchases / selected revenue (%)",
        "Current assets USD",
        "Current liabilities USD",
        "Current assets / current liabilities (×)",
        "Current assets less current liabilities (USD)",
        "Reported total assets (USD)",
        "Reported total liabilities (USD)",
        "Selected revenue YoY change (%)",
      ],
    ],
  ] as const)(
    "shows the %s preset in canonical order without another request",
    async (viewName, columns) => {
      await mount();
      expect(input(render(), "Financial column view").props.value).toBe(
        "overview",
      );
      change(render(), "Financial column view", viewName);
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      submit(render());
      await flush();
      expect(columnHeaders(render())).toEqual([
        "Company",
        ...columns,
        "Actions",
      ]);
      expect(inspector(render())).toBeUndefined();
      expect(text(render())).not.toContain("Exact value:");
      expect(
        elements(render()).find(
          (item) => item.props["aria-label"] === "Financial results table",
        )?.props,
      ).toMatchObject({ role: "region", tabIndex: 0 });
      change(render(), "Financial column view", "overview");
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
      expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledTimes(1);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it("keeps hidden filters and sorting explicit while custom columns stay outside requests and persist in saved v2", async () => {
    await mount();
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "operatingCashFlowLessPpePurchases");
    change(render(), "Financial comparison 1", "lte");
    change(render(), "Financial threshold 1", "-0.00001");
    change(render(), "Financial sort field", "grossMargin");
    change(render(), "Financial sort direction", "desc");
    change(render(), "Financial column view", "q4Balances");
    api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 26));
    submit(render());
    await flush();
    const firstRequest = structuredClone(
      api.screenPersonalFinancials.mock.calls[0]?.[0],
    ) as PersonalFinancialScreenRequestDto;
    const summary = elements(render()).find(
      (item) => item.props.className === "financial-screen-applied-criteria",
    );
    expect(text(summary)).toContain(
      "Operating cash flow less PP&E purchases ≤ -0.00001 USD",
    );
    expect(text(summary)).toContain(
      "Gross profit / selected revenue (%) , descending",
    );
    expect(columnHeaders(render())).not.toContain(
      "Gross profit / selected revenue (%)",
    );
    expect(text(render())).toContain("Columns affect display only");
    toggleColumn(render(), "Revenue", true);
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(columnHeaders(render())).toEqual([
      "Company",
      "Revenue USD",
      "Current assets USD",
      "Current liabilities USD",
      "Current assets / current liabilities (×)",
      "Current assets less current liabilities (USD)",
      "Reported total assets (USD)",
      "Reported total liabilities (USD)",
      "Actions",
    ]);
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toEqual(
      firstRequest,
    );
    expect(Object.keys(firstRequest.criteria).sort()).toEqual([
      "calendarYear",
      "clauses",
      "identityText",
      "sort",
    ]);
    change(render(), "Financial view name", "Hidden financial filters");
    click(render(), "Save financial view");
    await flush();
    const saved = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(saved.schemaVersion).toBe(2);
    expect(saved.views[0]?.criteria).toEqual(firstRequest.criteria);
    expect(Object.keys(saved.views[0]!).sort()).toEqual([
      "createdAgainstCatalogSnapshotSha256",
      "createdAgainstFinancialSnapshotSha256",
      "criteria",
      "display",
      "id",
      "name",
    ]);
    api.screenPersonalFinancials.mockResolvedValueOnce(response(25, 26));
    click(render(), "Next financial page");
    await flush();
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(api.screenPersonalFinancials.mock.calls[1]?.[0]).toMatchObject({
      criteria: firstRequest.criteria,
      financialSnapshotSha256: sha("b"),
      page: { offset: 25, limit: 25 },
    });
    click(render(), "Reset financial criteria");
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    click(render(), "Load financial view");
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(input(render(), "Financial metric 1").props.value).toBe(
      "operatingCashFlowLessPpePurchases",
    );
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    submit(render());
    await flush();
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(api.screenPersonalFinancials.mock.calls[2]?.[0]).toMatchObject({
      criteria: firstRequest.criteria,
      financialSnapshotSha256: null,
    });
  });

  it("keeps at least one column and adjusts empty results to the visible table", async () => {
    await mount();
    api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 0));
    submit(render());
    await flush();
    expect(
      elements(render()).find((item) => item.type === "td")?.props.colSpan,
    ).toBe(7);
    for (const label of [
      "Revenue",
      "Net income",
      "Operating cash flow",
      "Net margin",
    ])
      toggleColumn(render(), label, false);
    const checkbox = elements(render()).find(
      (item) =>
        item.props["aria-label"] ===
        "Show Current assets / current liabilities (×) column",
    );
    expect(checkbox?.props).toMatchObject({ checked: true, disabled: true });
    toggleColumn(render(), "Current assets / current liabilities (×)", false);
    expect(
      elements(render()).find((item) => item.type === "td")?.props.colSpan,
    ).toBe(3);
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
  });

  it("scrolls each focused value into the padded viewport without opening details or requesting data", async () => {
    await mount();
    change(render(), "Financial column view", "all");
    submit(render());
    await flush();
    const values = elements(render()).filter(
      (item) =>
        item.type === "button" &&
        item.props.className === "financial-screen-value-button",
    );
    expect(values).toHaveLength(20);
    for (const value of values) {
      const scrollIntoView = vi.fn();
      const closest = vi.fn().mockReturnValue(null);
      (
        value.props.onFocus as (event: {
          currentTarget: {
            scrollIntoView: typeof scrollIntoView;
            closest: typeof closest;
          };
        }) => void
      )({ currentTarget: { scrollIntoView, closest } });
      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      expect(value.props["aria-expanded"]).toBe(false);
    }
    expect(inspector(render())).toBeUndefined();
    expect(input(render(), "Financial column view").props.value).toBe("all");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledTimes(1);
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(activityStart).toHaveBeenCalledOnce();
  });

  it.each([
    ["covered by company", 775, 862, true, true, 1399],
    ["beyond the right edge", 1200, 1320, true, true, 1556],
    ["already visible", 900, 1000, true, true, 1508],
    ["missing scroller", 775, 862, false, true, 1508],
    ["missing company", 775, 862, true, false, 1508],
  ] as const)(
    "keeps the focused value clear when %s without changing selection or requests",
    async (_name, left, right, hasScroller, hasCompany, expectedScroll) => {
      await mount();
      change(render(), "Financial column view", "all");
      submit(render());
      await flush();
      const value = ratioCell(
        render(),
        "Operating cash flow less PP&E purchases",
      )!;
      const scroller = {
        scrollLeft: 1508,
        getBoundingClientRect: vi.fn(() => ({ right: 1280 })),
      };
      const company = { getBoundingClientRect: vi.fn(() => ({ right: 876 })) };
      const querySelector = vi.fn((selector: string) =>
        selector === 'th[scope="row"]' && hasCompany ? company : null,
      );
      const closest = vi.fn((selector: string) =>
        selector === "tr"
          ? { querySelector }
          : selector === ".personal-stock-screener-table-wrap" && hasScroller
            ? scroller
            : null,
      );
      const scrollIntoView = vi.fn();
      const getBoundingClientRect = vi.fn(() => ({ left, right }));
      (value.props.onFocus as (event: unknown) => void)({
        currentTarget: { closest, scrollIntoView, getBoundingClientRect },
      });
      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      expect(closest).toHaveBeenCalledWith("tr");
      expect(closest).toHaveBeenCalledWith(
        ".personal-stock-screener-table-wrap",
      );
      expect(querySelector).toHaveBeenCalledExactlyOnceWith('th[scope="row"]');
      expect(scroller.scrollLeft).toBe(expectedScroll);
      if (hasScroller && hasCompany)
        expect(scrollIntoView.mock.invocationCallOrder[0]).toBeLessThan(
          getBoundingClientRect.mock.invocationCallOrder[0]!,
        );
      else expect(getBoundingClientRect).not.toHaveBeenCalled();
      expect(inspector(render())).toBeUndefined();
      expect(value.props["aria-expanded"]).toBe(false);
      expect(input(render(), "Financial column view").props.value).toBe("all");
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
      expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledTimes(1);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      expect(activityStart).toHaveBeenCalledOnce();
    },
  );

  it("focuses one named inspector, preserves link access, and restores focus on Close or Escape", async () => {
    await mount();
    submit(render());
    await flush();
    const triggerFocus = vi.fn();
    const trigger = {
      isConnected: true,
      focus: triggerFocus,
    } as unknown as HTMLButtonElement;
    const headingFocus = vi.fn();
    const headingScroll = vi.fn();
    const heading = {
      focus: headingFocus,
      scrollIntoView: headingScroll,
    } as unknown as HTMLHeadingElement;
    const fallbackFocus = vi.fn();
    const fallbackScroll = vi.fn();
    const fallback = {
      focus: fallbackFocus,
      scrollIntoView: fallbackScroll,
    } as unknown as HTMLHeadingElement;
    const source = ratioCell(
      render(),
      "Current assets / current liabilities (×)",
    )!;
    expect(source.props).toMatchObject({
      type: "button",
      "aria-expanded": false,
    });
    expect(source.props["aria-controls"]).toBeUndefined();
    (
      source.props.onClick as (event: {
        currentTarget: HTMLButtonElement;
      }) => void
    )({ currentTarget: trigger });
    render((view) => {
      attachHeading(view, "financial-screen-inspector-title", heading);
      const resultsTitle = elements(view).find(
        (item) => item.type === "h3" && text(item) === "Financial results",
      )!;
      (
        resultsTitle.props.ref as React.RefObject<HTMLHeadingElement | null>
      ).current = fallback;
    });
    expect(headingFocus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(headingScroll).toHaveBeenCalledExactlyOnceWith({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
    expect(headingFocus.mock.invocationCallOrder[0]).toBeLessThan(
      headingScroll.mock.invocationCallOrder[0]!,
    );
    const opened = inspector(render())!;
    expect(opened.props).toMatchObject({
      "aria-labelledby": "financial-screen-inspector-title",
    });
    expect(opened.props["aria-modal"]).toBeUndefined();
    expect(text(opened)).toContain(
      "ONE · Current assets / current liabilities (×)",
    );
    expect(elements(opened).filter((item) => item.type === "a")).toHaveLength(
      2,
    );
    expect(
      ratioCell(render(), "Current assets / current liabilities (×)")?.props,
    ).toMatchObject({
      "aria-expanded": true,
      "aria-controls": "financial-screen-source-inspector",
    });
    const preventDefault = vi.fn(),
      stopPropagation = vi.fn();
    (opened.props.onKeyDown as (event: unknown) => void)({
      key: "Tab",
      preventDefault,
      stopPropagation,
    });
    expect(preventDefault).not.toHaveBeenCalled();
    (opened.props.onKeyDown as (event: unknown) => void)({
      key: "Escape",
      preventDefault,
      stopPropagation,
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(triggerFocus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(inspector(render())).toBeUndefined();
    inspectCell(render(), "Net income", "ONE", trigger);
    expect(text(inspector(render()))).not.toContain("Current assets numerator");
    click(render(), "Close details");
    expect(triggerFocus).toHaveBeenCalledTimes(2);
    inspectCell(render(), "Net income", "ONE", {
      isConnected: false,
      focus: vi.fn(),
    } as unknown as HTMLButtonElement);
    click(render(), "Close details");
    expect(fallbackFocus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(fallbackScroll).toHaveBeenCalledExactlyOnceWith({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    expect(activityStart).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it.each(["Close details", "Escape"] as const)(
    "commits inspector removal before %s restores focus and measures the value",
    async (action) => {
      api.screenPersonalFinancials.mockResolvedValueOnce(growthResponse());
      await mount();
      submit(render());
      await flush();
      const label = "Selected revenue YoY change (%)";
      let committedView: unknown;
      const scrollIntoView = vi.fn(() => {
        expect(inspector(committedView)).toBeUndefined();
      });
      const triggerFocus = vi.fn((options: FocusOptions) => {
        // Do not render here: a queued state change is not a DOM commit.
        expect(inspector(committedView)).toBeUndefined();
        // Prevent the browser's default focus scroll from competing with the
        // value's explicit instant scroll when the document uses smooth CSS.
        expect(options).toEqual({ preventScroll: true });
        const value = ratioCell(committedView, label)!;
        (value.props.onFocus as (event: unknown) => void)({
          currentTarget: trigger,
        });
      });
      const trigger = {
        isConnected: true,
        focus: triggerFocus,
        scrollIntoView,
        closest: () => null,
      } as unknown as HTMLButtonElement;
      inspectCell(render(), label, "ONE", trigger);
      committedView = render();
      expect(inspector(committedView)).toBeDefined();
      harness.onCommit(() => {
        committedView = render();
      });
      const requestCount = api.screenPersonalFinancials.mock.calls.length;
      const activityCount = activityStart.mock.calls.length;
      if (action === "Close details") click(committedView, action);
      else {
        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();
        (inspector(committedView)!.props.onKeyDown as (event: unknown) => void)(
          {
            key: "Escape",
            preventDefault,
            stopPropagation,
          },
        );
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(stopPropagation).toHaveBeenCalledOnce();
      }
      expect(inspector(committedView)).toBeUndefined();
      expect(triggerFocus).toHaveBeenCalledExactlyOnceWith({
        preventScroll: true,
      });
      expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      expect(triggerFocus.mock.invocationCallOrder[0]).toBeLessThan(
        scrollIntoView.mock.invocationCallOrder[0]!,
      );
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(requestCount);
      expect(activityStart).toHaveBeenCalledTimes(activityCount);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      expect(props.onAddToWatchlist).not.toHaveBeenCalled();
    },
  );

  it.each(["detached trigger", "invalidated response"] as const)(
    "rechecks the %s after committing inspector removal",
    async (boundary) => {
      await mount();
      submit(render());
      await flush();
      const triggerFocus = vi.fn();
      const trigger = {
        isConnected: true,
        focus: triggerFocus,
      };
      inspectCell(
        render(),
        "Net income",
        "ONE",
        trigger as unknown as HTMLButtonElement,
      );
      let committedView: unknown;
      const fallbackFocus = vi.fn(() => {
        expect(inspector(committedView)).toBeUndefined();
      });
      const fallback = {
        focus: fallbackFocus,
        scrollIntoView: vi.fn(),
      } as unknown as HTMLHeadingElement;
      const resultsRef = elements(render()).find(
        (item) => item.type === "h3" && text(item) === "Financial results",
      )!.props.ref as React.RefObject<HTMLHeadingElement | null>;
      resultsRef.current = fallback;
      committedView = render();
      harness.onCommit(() => {
        // Model other queued work flushed before imperative focus restoration.
        if (boundary === "detached trigger") trigger.isConnected = false;
        else change(committedView, "Financial company filter", "Other");
        committedView = render();
        if (boundary === "invalidated response") resultsRef.current = null;
      });
      const requestCount = api.screenPersonalFinancials.mock.calls.length;
      const activityCount = activityStart.mock.calls.length;
      click(committedView, "Close details");
      expect(inspector(committedView)).toBeUndefined();
      expect(triggerFocus).not.toHaveBeenCalled();
      expect(fallbackFocus).toHaveBeenCalledTimes(
        boundary === "detached trigger" ? 1 : 0,
      );
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(requestCount);
      expect(activityStart).toHaveBeenCalledTimes(activityCount);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it.each(["run", "refresh", "page"] as const)(
    "clears inspection before %s and cannot revive it from an old response sharing the snapshot",
    async (action) => {
      await mount();
      api.screenPersonalFinancials.mockResolvedValueOnce(response(0, 26));
      submit(render());
      await flush();
      const triggerFocus = vi.fn();
      const trigger = {
        isConnected: true,
        focus: triggerFocus,
      } as unknown as HTMLButtonElement;
      inspectCell(render(), "Net income", "ONE", trigger);
      const staleButton = ratioCell(render(), "Net income")!;
      const pending = deferred<PersonalFinancialScreenResponseDto>();
      api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
      if (action === "run") submit(render());
      else
        click(
          render(),
          action === "refresh" ? "Refresh SEC data" : "Next financial page",
        );
      expect(inspector(render())).toBeUndefined();
      expect(triggerFocus).not.toHaveBeenCalled();
      (staleButton.props.onClick as () => void)();
      expect(inspector(render())).toBeUndefined();
      pending.resolve(response(action === "page" ? 25 : 0, 26));
      await flush();
      expect(inspector(render())).toBeUndefined();
      (staleButton.props.onClick as () => void)();
      expect(inspector(render())).toBeUndefined();
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    "basis",
    "company",
    "sort",
    "reset",
    "load",
    "view",
    "columns",
  ] as const)(
    "clears source inspection on %s without restoring old focus or dispatching a screen",
    async (action) => {
      await mount();
      submit(render());
      await flush();
      change(render(), "Financial view name", "Inspection criteria");
      click(render(), "Save financial view");
      await flush();
      const triggerFocus = vi.fn();
      const trigger = {
        isConnected: true,
        focus: triggerFocus,
      } as unknown as HTMLButtonElement;
      inspectCell(render(), "Net income", "ONE", trigger);
      if (action === "basis") change(render(), "Revenue basis", "Revenues");
      else if (action === "company")
        change(render(), "Financial company filter", "Other");
      else if (action === "sort")
        change(render(), "Financial sort field", "currentRatio");
      else if (action === "reset") click(render(), "Reset financial criteria");
      else if (action === "load") click(render(), "Load financial view");
      else if (action === "view")
        change(render(), "Financial column view", "q4Balances");
      else toggleColumn(render(), "Revenue", false);
      expect(inspector(render())).toBeUndefined();
      expect(triggerFocus).not.toHaveBeenCalled();
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["snapshot", "disabled", "session"] as const)(
    "clears inspector and resets columns immediately on the %s boundary",
    async (boundary) => {
      await mount();
      change(render(), "Financial column view", "q4Balances");
      submit(render());
      await flush();
      const triggerFocus = vi.fn();
      const trigger = {
        isConnected: true,
        focus: triggerFocus,
      } as unknown as HTMLButtonElement;
      inspectCell(
        render(),
        "Current assets / current liabilities (×)",
        "ONE",
        trigger,
      );
      if (boundary === "snapshot")
        props = {
          ...props,
          snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
        };
      else if (boundary === "disabled") props = { ...props, disabled: true };
      else {
        api.fetchPersonalFinancialSavedViews.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("session_unavailable"),
        );
        click(render(), "Reload saved views");
        await flush();
      }
      render();
      expect(inspector(render())).toBeUndefined();
      expect(input(render(), "Financial column view").props.value).toBe(
        "overview",
      );
      expect(triggerFocus).not.toHaveBeenCalled();
      if (boundary === "session")
        expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [
      "totalAssets",
      "Reported total assets (USD)",
      "USD",
      "1000000000 = $1 billion",
    ],
    [
      "totalLiabilities",
      "Reported total liabilities (USD)",
      "USD",
      "1000000000 = $1 billion",
    ],
    ["currentAssets", "Current assets (USD)", "USD", "1000000000 = $1 billion"],
    [
      "currentLiabilities",
      "Current liabilities (USD)",
      "USD",
      "1000000000 = $1 billion",
    ],
    [
      "currentRatio",
      "Current assets / current liabilities (×)",
      "×",
      "1 = 1.00×",
    ],
    [
      "currentAssetsLessCurrentLiabilities",
      "Current assets less current liabilities (USD)",
      "USD",
      "1000000000 = $1 billion",
    ],
  ])(
    "filters and sorts %s with the explicit unit and fixed-Q4 selection",
    async (field, label, unit, placeholder) => {
      await mount();
      expect(text(render())).toContain(
        `Balance sheet: CY${String(new Date().getUTCFullYear() - 1)} Q4 instant frame; inspect actual balance date.`,
      );
      click(render(), "Add financial filter");
      change(render(), "Financial metric 1", field);
      change(render(), "Financial threshold 1", "1.000");
      change(render(), "Financial sort field", field);
      change(render(), "Financial sort direction", "desc");
      expect(text(render())).toContain(label);
      expect(text(render())).toContain(`Threshold ( ${unit} )`);
      expect(input(render(), "Financial threshold 1").props).toMatchObject({
        placeholder,
      });
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      submit(render());
      await flush();
      expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toMatchObject({
        schemaVersion: "10.0.0",
        criteria: {
          clauses: [{ field, operator: "gte", value: "1.000" }],
          sort: { field, direction: "desc" },
        },
      });
      expect(
        (
          api.screenPersonalFinancials.mock
            .calls[0]?.[0] as PersonalFinancialScreenRequestDto
        ).criteria,
      ).not.toHaveProperty("instantQuarter");
    },
  );

  it.each([
    ["100.25", "120.5", "-20.25", "-$20.25"],
    ["100", "0", "100", "$100"],
    ["100", "100", "0", "$0"],
  ])(
    "shows the exact current-balance subtraction %s minus %s, signed result and retained inputs",
    async (assets, liabilities, difference, display) => {
      const result = currentBalanceDifferenceResponse(
        assets,
        liabilities,
        difference,
      );
      api.screenPersonalFinancials.mockResolvedValueOnce(result);
      await mount();
      change(render(), "Financial column view", "q4Balances");
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      submit(render());
      await flush();
      expect(text(render())).toContain(
        "Current assets less current liabilities (USD) : 1 known / 0 unknown",
      );
      const cell = inspectCell(
        render(),
        "Current assets less current liabilities (USD)",
      );
      expect(
        ratioCell(render(), "Current assets less current liabilities (USD)")
          ?.props["aria-label"],
      ).toBe(
        `ONE Current assets less current liabilities (USD): ${display}. Show source details`,
      );
      expect(text(cell)).toContain(`Exact value: ${difference} USD`);
      expect(text(cell)).toContain(
        `Exact subtraction: ${assets} USD − ${liabilities} USD = ${difference} USD.`,
      );
      expect(text(cell)).toContain("Current assets input AssetsCurrent");
      expect(text(cell)).toContain(
        "Current liabilities input (subtracted) LiabilitiesCurrent",
      );
      expect(text(cell)).toContain(`Reported: ${assets} USD`);
      expect(text(cell)).toContain(`Reported: ${liabilities} USD`);
      expect(text(cell)).toContain(
        `Actual balance date: ${String(new Date().getUTCFullYear() - 1)}-12-27`,
      );
      expect(text(cell)).toContain(
        "Zero liabilities and a negative difference are valid",
      );
      expect(text(cell)).toContain("not cash available to spend");
      expect(text(cell)).not.toContain("Revenue denominator:");
      const filingLinks = elements(inspector(render())).filter(
        (element) => element.type === "a",
      );
      expect(filingLinks).toHaveLength(2);
      expect(filingLinks.map((link) => link.props.href)).toEqual([
        "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/0000000001-25-000001-index.html",
        "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/0000000001-25-000001-index.html",
      ]);
      if (liabilities === "0") {
        expect(
          text(ratioCell(render(), "Current assets / current liabilities (×)")),
        ).toBe("Unknown");
        expect(text(render())).toContain(
          "Current assets / current liabilities (×) : 0 known / 1 unknown",
        );
      }
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["unsupported_balance_date", "falls outside October 1–December 31"],
    ["balance_date_mismatch", "different actual balance dates"],
    ["filing_mismatch", "different filing accessions"],
    ["unsupported_sign", "current assets or current liabilities are negative"],
    ["missing", "missing or failed inputs are never treated as zero"],
    [
      "source_unavailable",
      "missing or failed inputs are never treated as zero",
    ],
    ["conflicting", "missing or failed inputs are never treated as zero"],
  ] as const)(
    "explains unknown current-balance subtraction %s while retaining every input reference",
    async (reason, explanation) => {
      const result = response();
      const row = result.rows[0]!;
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              currentAssetsLessCurrentLiabilities: {
                status: "unavailable",
                unit: "USD",
                reason,
                sources:
                  row.metrics.currentAssetsLessCurrentLiabilities.sources,
              },
            },
          },
        ],
      });
      await mount();
      submit(render());
      await flush();
      const cell = inspectCell(
        render(),
        "Current assets less current liabilities (USD)",
      );
      expect(text(cell)).toContain(explanation);
      expect(text(cell)).toContain("Reported: 100 USD");
      expect(text(cell)).toContain("Reported: 80 USD");
      expect(text(cell)).not.toContain("Exact subtraction:");
    },
  );

  it("saves and reloads signed current-balance criteria and selected columns in saved v2", async () => {
    const legacy = {
      id: "legacy-screen",
      name: "Annual screen",
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
    click(render(), "Add financial filter");
    change(
      render(),
      "Financial metric 1",
      "currentAssetsLessCurrentLiabilities",
    );
    change(render(), "Financial comparison 1", "lte");
    change(render(), "Financial threshold 1", "-0.00001");
    change(
      render(),
      "Financial sort field",
      "currentAssetsLessCurrentLiabilities",
    );
    change(render(), "Financial sort direction", "asc");
    toggleColumn(
      render(),
      "Current assets less current liabilities (USD)",
      true,
    );
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    submit(render());
    await flush();
    const request = api.screenPersonalFinancials.mock
      .calls[0]?.[0] as PersonalFinancialScreenRequestDto;
    expect(request.criteria).toMatchObject({
      clauses: [
        {
          field: "currentAssetsLessCurrentLiabilities",
          operator: "lte",
          value: "-0.00001",
        },
      ],
      sort: { field: "currentAssetsLessCurrentLiabilities", direction: "asc" },
    });
    expect(columnHeaders(render())).toContain(
      "Current assets less current liabilities (USD)",
    );
    const applied = elements(render()).find(
      (item) => item.props.className === "financial-screen-applied-criteria",
    );
    expect(text(applied)).toContain(
      "Current assets less current liabilities (USD) ≤ -0.00001 USD",
    );
    change(render(), "Financial view name", "Current-balance shortfall");
    click(render(), "Save financial view as new");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.schemaVersion).toBe(2);
    expect(payload.views[0]).toEqual({ ...legacy, display: null });
    expect(payload.views[1]?.criteria).toEqual(request.criteria);
    expect(payload.views[1]?.criteria).not.toHaveProperty("visibleMetrics");
    click(render(), "Reset financial criteria");
    click(render(), "Load financial view");
    expect(input(render(), "Financial metric 1").props.value).toBe(
      "currentAssetsLessCurrentLiabilities",
    );
    expect(input(render(), "Financial threshold 1").props.value).toBe(
      "-0.00001",
    );
    expect(input(render(), "Financial sort field").props.value).toBe(
      "currentAssetsLessCurrentLiabilities",
    );
    expect(input(render(), "Financial column view").props.value).toBe("custom");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
  });

  it("shows exact multiples, actual dates, input roles and only the fixed instant source links", async () => {
    await mount();
    submit(render());
    await flush();
    const cell = inspectCell(
      render(),
      "Current assets / current liabilities (×)",
    );
    expect(text(cell)).toContain("Exact value: 1.25 ×");
    expect(text(cell)).toContain("Current assets numerator AssetsCurrent");
    expect(text(cell)).toContain(
      "Current liabilities denominator LiabilitiesCurrent",
    );
    expect(text(cell)).toContain(
      `Actual balance date: ${String(new Date().getUTCFullYear() - 1)}-12-27`,
    );
    expect(text(cell)).toContain(
      "inclusive filters compare the displayed rounded multiple",
    );
    expect(text(cell)).toContain("Calculated by this app");
    expect(text(cell)).not.toContain("Revenue denominator:");
    expect(text(cell)).not.toContain("through 2024-12-31");
    expect(text(cell)).not.toContain("1.25%");
    const links = elements(render()).filter(
      (element) =>
        element.type === "a" &&
        String(element.props.href).includes("/api/xbrl/frames/"),
    );
    expect(links).toHaveLength(15);
    expect(
      links
        .filter((link) => String(link.props.href).endsWith("CY2025Q4I.json"))
        .map((link) => text(link)),
    ).toEqual([
      "SEC AssetsCurrent",
      "SEC LiabilitiesCurrent",
      "SEC Assets",
      "SEC Liabilities",
    ]);
  });

  it.each(["0.00", "1.00", `${"9".repeat(64)}${"0".repeat(62)}.00`])(
    "renders exact current multiple %s without Number conversion",
    async (value) => {
      const result = response();
      const row = result.rows[0]!;
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              currentRatio: {
                ...row.metrics.currentRatio,
                status: "available",
                value,
              },
            },
          },
        ],
      });
      await mount();
      submit(render());
      await flush();
      const cell = inspectCell(
        render(),
        "Current assets / current liabilities (×)",
      );
      const display = value.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
      expect(
        elements(cell).find((element) => element.type === "button")?.props[
          "aria-label"
        ],
      ).toBe(
        `ONE Current assets / current liabilities (×): ${display} ×. Show source details`,
      );
      expect(text(cell)).toContain(`Exact value: ${value} ×`);
    },
  );

  it.each([
    ["unsupported_balance_date", "falls outside October 1–December 31"],
    ["balance_date_mismatch", "different actual balance dates"],
    ["filing_mismatch", "different filing accessions"],
    ["nonpositive_current_liabilities", "requires a positive denominator"],
    ["unsupported_sign", "current assets are negative"],
    ["source_unavailable", "input is unresolved"],
  ] as const)(
    "explains current ratio unknown reason %s with retained balances",
    async (reason, explanation) => {
      const result = response();
      const row = result.rows[0]!;
      const refs = row.metrics.currentRatio.sources.map((ref) => ({
        ...ref,
        asOfDate:
          reason === "unsupported_balance_date" ? "2026-01-31" : ref.asOfDate,
      }));
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              currentRatio: {
                status: "unavailable",
                unit: "multiple",
                reason,
                sources: refs,
              },
            },
          },
        ],
      });
      await mount();
      submit(render());
      await flush();
      const cell = inspectCell(
        render(),
        "Current assets / current liabilities (×)",
      );
      expect(text(cell)).toContain(explanation);
      expect(text(cell)).toContain("Reported: 100 USD");
      expect(text(cell)).toContain("Reported: 80 USD");
      if (reason === "unsupported_balance_date") {
        expect(text(cell)).toContain("Actual balance date: 2026-01-31");
        expect(text(cell)).toContain("not an SEC-published date tolerance");
      }
    },
  );

  it("saves all three balance fields beside untouched legacy criteria, then resets and loads without fetching", async () => {
    const legacy = {
      id: "old-screen",
      name: "Annual screen",
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
    for (const [index, field] of [
      "currentAssets",
      "currentLiabilities",
      "currentRatio",
    ].entries()) {
      click(render(), "Add financial filter");
      change(render(), `Financial metric ${String(index + 1)}`, field);
      change(render(), `Financial threshold ${String(index + 1)}`, "1.00");
    }
    change(render(), "Financial sort field", "currentRatio");
    submit(render());
    await flush();
    change(render(), "Financial view name", "Q4 liquidity");
    click(render(), "Save financial view as new");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.schemaVersion).toBe(2);
    expect(payload.views[0]).toEqual({ ...legacy, display: null });
    expect(
      payload.views[1]!.criteria.clauses.map((clause) => clause.field),
    ).toEqual(["currentAssets", "currentLiabilities", "currentRatio"]);
    expect(payload.views[1]!.criteria).not.toHaveProperty("instantQuarter");
    click(render(), "Reset financial criteria");
    expect(
      ratioCell(render(), "Current assets / current liabilities (×)"),
    ).toBeUndefined();
    click(render(), "Load financial view");
    expect(input(render(), "Financial sort field").props.value).toBe(
      "currentRatio",
    );
    expect(input(render(), "Financial threshold 3").props.value).toBe("1.00");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
  });

  it("pins instant results across pages and clears them on basis changes and disabled sessions", async () => {
    api.screenPersonalFinancials
      .mockResolvedValueOnce(response(0, 26))
      .mockResolvedValueOnce(response(25, 26));
    await mount();
    submit(render());
    await flush();
    click(render(), "Next financial page");
    await flush();
    expect(api.screenPersonalFinancials.mock.calls[1]?.[0]).toMatchObject({
      financialSnapshotSha256: sha("b"),
      page: { offset: 25, limit: 25 },
      refresh: false,
    });
    expect(
      ratioCell(render(), "Current assets / current liabilities (×)", "ONE25"),
    ).toBeDefined();
    change(render(), "Revenue basis", "Revenues");
    expect(
      ratioCell(render(), "Current assets / current liabilities (×)"),
    ).toBeUndefined();
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...response(),
      revenueBasis: "Revenues",
    });
    submit(render());
    await flush();
    expect(
      ratioCell(render(), "Current assets / current liabilities (×)"),
    ).toBeDefined();
    props = { ...props, disabled: true };
    render();
    expect(
      ratioCell(render(), "Current assets / current liabilities (×)"),
    ).toBeUndefined();
  });
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
    inspectCell(render(), "Operating cash flow less PP&E purchases");
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
    expect(text(view)).toContain("Formula version 1.7.0");
    expect(
      elements(view).some(
        (element) =>
          element.type === "button" &&
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
      expect(text(inspectCell(render(), "PP&E purchases"))).toContain(
        "Exact value: -23.00002 USD",
      );
      inspectCell(render(), "Operating cash flow less PP&E purchases");
      const view = render();
      expect(text(view)).toContain(explanation);
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
            metric === "currentAssets" ||
            metric === "currentLiabilities" ||
            metric === "currentRatio" ||
            metric === "currentAssetsLessCurrentLiabilities"
              ? defaultInstantCells()[metric]
              : {
                  status: "unavailable",
                  reason: "missing",
                  unit:
                    metric.endsWith("Margin") ||
                    metric === "operatingCashFlowToNetIncome"
                      ? "percent"
                      : "USD",
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
    "operatingCashFlowToNetIncome",
    "operatingCashFlowLessPpePurchasesMargin",
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
      change(render(), "Saved financial view", legacy.id);
      click(render(), "Load financial view");
      expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
      submit(render());
      await flush();
      expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          schemaVersion: "10.0.0",
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
          schemaVersion: "10.0.0",
          criteria: grossRequest.criteria,
          financialSnapshotSha256: sha("b"),
          page: { offset: 25, limit: 25 },
        }),
      );
      change(render(), "Financial view name", `Screen ${metric}`);
      click(render(), "Save financial view as new");
      await flush();
      const payload = api.savePersonalFinancialSavedViews.mock
        .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
      expect(api.savePersonalFinancialSavedViews.mock.calls[0]?.[0]).toBe(4);
      expect(payload.schemaVersion).toBe(2);
      expect(payload.views[0]).toEqual({ ...legacy, display: null });
      expect(payload.views[1]?.criteria).toEqual(grossRequest.criteria);
      click(render(), "Reset financial criteria");
      click(render(), "Load financial view");
      expect(input(render(), "Financial metric 1").props.value).toBe(metric);
      expect(input(render(), "Financial sort field").props.value).toBe(metric);
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(3);
      submit(render());
      await flush();
      expect(api.screenPersonalFinancials.mock.calls[3]?.[0]).toEqual(
        expect.objectContaining({
          schemaVersion: "10.0.0",
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
    inspectCell(render(), "Gross profit");
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
          element.type === "button" &&
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
    const cell = inspectCell(render());
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
    change(render(), "Financial view name", "Gross profit over broad revenue");
    click(render(), "Save financial view as new");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.views[0]?.criteria).toMatchObject({
      revenueBasis: "Revenues",
      clauses: [{ field: "grossMargin", operator: "gte", value: "25" }],
      sort: { field: "grossMargin", direction: "desc" },
    });
    click(render(), "Reset financial criteria");
    click(render(), "Load financial view");
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
      const cell = inspectCell(render());
      expect(
        elements(cell).find((element) => element.type === "button")?.props[
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
      const cell = inspectCell(render());
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
        elements(cell).find((element) => element.type === "button")?.props[
          "aria-label"
        ],
      ).toBe(
        "ONE Gross profit / selected revenue (%): Unknown. Show source details",
      );
      if (reason !== "missing")
        expect(text(inspectCell(render(), "Gross profit"))).toContain(
          "Exact value: 30 USD",
        );
    },
  );

  it("shows missing gross profit as unknown and spans all twenty metrics when no rows match", async () => {
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
    change(render(), "Financial column view", "all");
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
    ).toBe(22);
  });

  it("screens cash after PP&E as a percentage and exposes exact three-input arithmetic, revenue multiplicity and coverage", async () => {
    const result = cashPpeMarginResponse(
      "-1.01",
      "1.00001",
      "2.00501",
      "100",
      true,
    );
    api.screenPersonalFinancials.mockResolvedValueOnce(result);
    await mount();
    click(render(), "Add financial filter");
    change(
      render(),
      "Financial metric 1",
      "operatingCashFlowLessPpePurchasesMargin",
    );
    change(render(), "Financial comparison 1", "lte");
    change(render(), "Financial threshold 1", "-1.01");
    change(
      render(),
      "Financial sort field",
      "operatingCashFlowLessPpePurchasesMargin",
    );
    change(render(), "Financial sort direction", "desc");
    change(render(), "Financial column view", "cashFlow");
    expect(text(render())).toContain("Threshold ( % )");
    expect(
      elements(render()).find(
        (item) => item.props["aria-label"] === "Financial threshold 1",
      )?.props.placeholder,
    ).toBe("15 = 15%");
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toMatchObject({
      schemaVersion: "10.0.0",
      criteria: {
        clauses: [
          {
            field: "operatingCashFlowLessPpePurchasesMargin",
            operator: "lte",
            value: "-1.01",
          },
        ],
        sort: {
          field: "operatingCashFlowLessPpePurchasesMargin",
          direction: "desc",
        },
      },
    });
    expect(columnHeaders(render())).toContain(cashPpeMarginLabel);
    expect(text(render())).toContain(
      `${cashPpeMarginLabel} : 1 known / 0 unknown`,
    );
    const details = inspectCell(render(), cashPpeMarginLabel);
    expect(text(details)).toContain("Exact value: -1.01 percent");
    expect(text(details)).toContain(
      "Exact operands: ( 1.00001 USD − 2.00501 USD) / 100 USD × 100. Rounded once: -1.01 %.",
    );
    expect(text(details)).toContain(
      "rounded half-up once to two decimal places",
    );
    expect(text(details)).toContain("app-defined historical cash measure");
    expect(text(details)).toContain("excludes other investing cash flows");
    expect(text(details)).toContain("Revenue denominator: Require agreement");
    const cards = elements(details).filter(
      (item) => item.props.className === "financial-screen-source-card",
    );
    expect(cards).toHaveLength(4);
    expect(cards.map(text)).toEqual([
      expect.stringContaining(
        "Operating cash flow input NetCashProvidedByUsedInOperatingActivities",
      ),
      expect.stringContaining(
        "PP&E purchases input (subtracted) PaymentsToAcquirePropertyPlantAndEquipment",
      ),
      expect.stringContaining("Selected revenue denominator Revenues"),
      expect.stringContaining(
        "Selected revenue denominator RevenueFromContractWithCustomerExcludingAssessedTax",
      ),
    ]);
    for (const card of cards) {
      expect(text(card)).toContain("2024-01-01 through 2024-12-31");
      expect(elements(card).find((item) => item.type === "a")?.props.href).toBe(
        "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/0000000001-25-000001-index.html",
      );
    }
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it.each([
    ["0.00", "1", "1", "100"],
    ["0.00", "0", "0.004", "100"],
    ["150.00", "200", "50", "100"],
    ["-25.00", "-10", "15", "100"],
  ])(
    "retains cash after PP&E percentage %s from signed exact inputs %s and %s",
    async (value, operating, purchases, revenue) => {
      api.screenPersonalFinancials.mockResolvedValueOnce(
        cashPpeMarginResponse(value, operating, purchases, revenue),
      );
      await mount();
      submit(render());
      await flush();
      const details = inspectCell(render(), cashPpeMarginLabel);
      expect(ratioCell(render(), cashPpeMarginLabel)?.props["aria-label"]).toBe(
        `ONE ${cashPpeMarginLabel}: ${value}%. Show source details`,
      );
      expect(text(details)).toContain(`Exact value: ${value} percent`);
      for (const amount of [operating, purchases, revenue])
        expect(text(details)).toContain(`Reported: ${amount} USD`);
    },
  );

  it("renders a large exact cash-after-PP&E percentage without floating-point conversion", async () => {
    const operating = `-${"9".repeat(63)}`;
    const purchases = "9".repeat(64);
    const revenue = `0.${"0".repeat(61)}1`;
    const whole = `${String(BigInt("9".repeat(63)) + BigInt(purchases))}${"0".repeat(64)}`;
    const value = `-${whole}.00`;
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
    expect(value).toHaveLength(133);
    api.screenPersonalFinancials.mockResolvedValueOnce(
      cashPpeMarginResponse(value, operating, purchases, revenue),
    );
    await mount();
    submit(render());
    await flush();
    const details = inspectCell(render(), cashPpeMarginLabel);
    expect(ratioCell(render(), cashPpeMarginLabel)?.props["aria-label"]).toBe(
      `ONE ${cashPpeMarginLabel}: -${grouped}.00%. Show source details`,
    );
    expect(text(details)).toContain(`Exact value: ${value} percent`);
    expect(text(details)).toContain(`Reported: ${operating} USD`);
    expect(text(details)).toContain(`Reported: ${purchases} USD`);
    expect(text(details)).toContain(`Reported: ${revenue} USD`);
  });

  it.each([
    [
      "revenue",
      "source_unavailable",
      "Selected revenue is unresolved (source unavailable)",
    ],
    [
      "operatingCashFlow",
      "conflicting",
      "Operating cash flow is unresolved (conflicting)",
    ],
    ["ppePurchases", "missing", "PP&E purchases are unresolved (missing)"],
    [
      null,
      "period_mismatch",
      "The three inputs do not share the same supported annual period",
    ],
    [
      null,
      "filing_mismatch",
      "The three inputs come from different filing accessions",
    ],
    [null, "unsupported_sign", "Reported PP&E purchases are negative"],
    [null, "nonpositive_revenue", "Selected revenue is zero or negative"],
  ] as const)(
    "explains cash after PP&E %s / %s while keeping all retained operand evidence",
    async (unresolved, reason, explanation) => {
      const result = cashPpeMarginResponse(
        "25.00",
        "30",
        reason === "unsupported_sign" ? "-5" : "5",
        reason === "nonpositive_revenue" ? "0" : "100",
      );
      const row = result.rows[0]!;
      const sourceInputs = {
        revenue: row.metrics.revenue,
        operatingCashFlow: row.metrics.operatingCashFlow,
        ppePurchases: row.metrics.ppePurchases,
      };
      const inputs =
        unresolved === null
          ? sourceInputs
          : {
              ...sourceInputs,
              [unresolved]: {
                status: "unavailable",
                unit: "USD",
                reason,
                sources: sourceInputs[unresolved].sources,
              },
            };
      const sources =
        row.metrics.operatingCashFlowLessPpePurchasesMargin.sources.map(
          (source, index) => ({
            ...source,
            ...(index === 2 && reason === "period_mismatch"
              ? { endDate: "2024-12-30" }
              : {}),
            ...(index === 2 && reason === "filing_mismatch"
              ? { accessionNumber: "0000000001-25-000002" }
              : {}),
          }),
        );
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...result,
        rows: [
          {
            ...row,
            metrics: {
              ...row.metrics,
              ...inputs,
              operatingCashFlowLessPpePurchasesMargin: {
                status: "unavailable",
                unit: "percent",
                reason,
                sources,
              },
            },
          },
        ],
        metricCoverage: {
          ...result.metricCoverage,
          operatingCashFlowLessPpePurchasesMargin: { known: 0, unknown: 1 },
        },
      });
      await mount();
      submit(render());
      await flush();
      const details = inspectCell(render(), cashPpeMarginLabel);
      expect(text(details)).toContain(explanation);
      expect(text(details)).toContain(
        `Unavailable: ${reason.replaceAll("_", " ")}`,
      );
      expect(text(details)).not.toContain("Exact operands:");
      expect(text(details)).toContain("Operating cash flow input");
      expect(text(details)).toContain("PP&E purchases input (subtracted)");
      expect(text(details)).toContain("Selected revenue denominator");
      expect(
        elements(details).filter(
          (item) => item.props.className === "financial-screen-source-card",
        ),
      ).toHaveLength(3);
      expect(text(render())).toContain(
        `${cashPpeMarginLabel} : 0 known / 1 unknown`,
      );
      if (reason === "period_mismatch")
        expect(text(details)).toContain("2024-12-30");
      if (reason === "filing_mismatch")
        expect(text(details)).toContain("0000000001-25-000002");
    },
  );

  it("explains unresolved revenue before unresolved cash inputs for the new percentage", async () => {
    const result = cashPpeMarginResponse();
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
              reason: "source_unavailable",
              sources: [],
            },
            operatingCashFlow: {
              status: "unavailable",
              unit: "USD",
              reason: "conflicting",
              sources: [],
            },
            ppePurchases: {
              status: "unavailable",
              unit: "USD",
              reason: "missing",
              sources: [],
            },
            operatingCashFlowLessPpePurchasesMargin: {
              status: "unavailable",
              unit: "percent",
              reason: "source_unavailable",
              sources: [],
            },
          },
        },
      ],
    });
    await mount();
    submit(render());
    await flush();
    const details = inspectCell(render(), cashPpeMarginLabel);
    expect(text(details)).toContain(
      "Selected revenue is unresolved (source unavailable)",
    );
    expect(text(details)).toContain(
      "Operating cash flow : Unknown (conflicting)",
    );
    expect(text(details)).toContain("PP&E purchases : Unknown (missing)");
    expect(text(details)).toContain("No source references were retained");
    expect(text(details)).not.toContain("Exact operands:");
  });

  it("uses percent controls and explains both cash-flow-to-income operands independently of revenue", async () => {
    await mount();
    change(render(), "Revenue basis", "SalesRevenueNet");
    click(render(), "Add financial filter");
    change(render(), "Financial metric 1", "operatingCashFlowToNetIncome");
    change(render(), "Financial threshold 1", "150");
    change(render(), "Financial sort field", "operatingCashFlowToNetIncome");
    change(render(), "Financial sort direction", "desc");
    expect(text(render())).toContain("Operating cash flow / net income (%)");
    expect(text(render())).toContain("Threshold ( % )");
    expect(
      elements(render()).find(
        (element) => element.props["aria-label"] === "Financial threshold 1",
      )?.props.placeholder,
    ).toBe("15 = 15%");
    expect(api.screenPersonalFinancials).not.toHaveBeenCalled();
    const result = cashIncomeResponse("150.00", "150", "100");
    const row = result.rows[0]!;
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      revenueBasis: "SalesRevenueNet",
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
          },
        },
      ],
    });
    submit(render());
    await flush();
    expect(api.screenPersonalFinancials.mock.calls[0]?.[0]).toMatchObject({
      schemaVersion: "10.0.0",
      criteria: {
        revenueBasis: "SalesRevenueNet",
        clauses: [
          {
            field: "operatingCashFlowToNetIncome",
            operator: "gte",
            value: "150",
          },
        ],
        sort: { field: "operatingCashFlowToNetIncome", direction: "desc" },
      },
    });
    const cell = inspectCell(render(), "Operating cash flow / net income (%)");
    expect(text(cell)).toContain("Exact value: 150.00 percent");
    expect(text(cell)).toContain("Requires positive reported net income");
    expect(text(cell)).toContain("335–395 inclusive days");
    expect(text(cell)).toContain("Rounded half-up to two decimal places");
    expect(text(cell)).toContain("Independent of the revenue basis");
    expect(text(cell)).toContain(
      "Operating cash flow numerator NetCashProvidedByUsedInOperatingActivities",
    );
    expect(text(cell)).toContain("Net income denominator NetIncomeLoss");
    expect(text(cell)).toContain("Reported: 150 USD");
    expect(text(cell)).toContain("Reported: 100 USD");
    expect(text(cell)).toContain("2024-01-01 through 2024-12-31");
    expect(text(cell)).toContain(
      "not a company-reported cash-conversion measure or a quality score",
    );
    expect(text(cell)).not.toContain("Revenue denominator:");
    expect(text(cell)).not.toContain("selected revenue");
    const links = elements(cell).filter((element) => element.type === "a");
    expect(links).toHaveLength(2);
    expect(
      links.every(
        (element) =>
          element.props.href ===
          "https://www.sec.gov/Archives/edgar/data/1/000000000125000001/0000000001-25-000001-index.html",
      ),
    ).toBe(true);
    expect(
      elements(render()).find(
        (element) =>
          element.type === "th" &&
          text(element).trim() === "Operating cash flow / net income (%)",
      ),
    ).toBeDefined();
    click(render(), "Reset financial criteria");
    expect(cashIncomeCell(render())).toBeUndefined();
    expect(input(render(), "Financial sort field").props.value).toBe("symbol");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["-50.00", "-50.00%", "-50", "100"],
    ["0.00", "0.00%", "0", "100"],
    ["150.00", "150.00%", "150", "100"],
    ["-1.01", "-1.01%", "-1.005", "100"],
    [
      `${"9".repeat(64)}${"0".repeat(64)}.00`,
      `${`${"9".repeat(64)}${"0".repeat(64)}`.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}.00%`,
      "9".repeat(64),
      `0.${"0".repeat(61)}1`,
    ],
  ])(
    "retains the cash-flow-to-income percentage %s without Number conversion",
    async (value, display, operatingCashFlow, netIncome) => {
      api.screenPersonalFinancials.mockResolvedValueOnce(
        cashIncomeResponse(value, operatingCashFlow, netIncome),
      );
      await mount();
      submit(render());
      await flush();
      const cell = inspectCell(
        render(),
        "Operating cash flow / net income (%)",
      );
      expect(
        elements(cell).find((element) => element.type === "button")?.props[
          "aria-label"
        ],
      ).toBe(
        `ONE Operating cash flow / net income (%): ${display}. Show source details`,
      );
      expect(text(cell)).toContain(`Exact value: ${value} percent`);
      expect(text(cell)).toContain(`Reported: ${operatingCashFlow} USD`);
      expect(text(cell)).toContain(`Reported: ${netIncome} USD`);
    },
  );

  it.each([
    ["period_mismatch", "100", "Compare every source date below"],
    ["filing_mismatch", "100", "avoid mixing filing versions"],
    ["nonpositive_net_income", "0", "Reported net income is zero or negative"],
    [
      "nonpositive_net_income",
      "-100",
      "A positive net income denominator is required",
    ],
    [
      "missing",
      "100",
      "Reported net income or operating cash flow is unresolved",
    ],
    ["source_unavailable", "100", "retained source references are shown below"],
  ] as const)(
    "explains cash-flow-to-income %s with denominator %s and retains available operands",
    async (reason, netIncome, explanation) => {
      const result = cashIncomeResponse("150.00", "150", netIncome);
      const row = result.rows[0]!;
      const sources = row.metrics.operatingCashFlowToNetIncome.sources
        .map((source, index) => ({
          ...source,
          ...(reason === "period_mismatch" && index === 1
            ? { startDate: "2024-02-01" }
            : {}),
          ...(reason === "filing_mismatch" && index === 1
            ? { accessionNumber: "0000000001-25-000002" }
            : {}),
        }))
        .filter((source) =>
          reason === "missing"
            ? source.concept !== "NetIncomeLoss"
            : reason === "source_unavailable"
              ? source.concept !== "NetCashProvidedByUsedInOperatingActivities"
              : true,
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
                    netIncome: {
                      status: "unavailable" as const,
                      unit: "USD" as const,
                      reason,
                      sources: [],
                    },
                  }
                : {}),
              ...(reason === "source_unavailable"
                ? {
                    operatingCashFlow: {
                      status: "unavailable" as const,
                      unit: "USD" as const,
                      reason,
                      sources: [],
                    },
                  }
                : {}),
              operatingCashFlowToNetIncome: {
                status: "unavailable",
                unit: "percent",
                reason,
                sources,
              },
            },
          },
        ],
      });
      await mount();
      submit(render());
      await flush();
      const cell = inspectCell(
        render(),
        "Operating cash flow / net income (%)",
      );
      expect(text(cell)).toContain(
        `Unavailable: ${reason.replaceAll("_", " ")}.`,
      );
      expect(text(cell)).toContain(explanation);
      expect(text(cell)).not.toContain("Revenue denominator:");
      expect(text(cell)).not.toContain("nonpositive revenue");
      if (reason !== "missing") {
        expect(text(cell)).toContain("Net income denominator NetIncomeLoss");
        expect(text(cell)).toContain(`Reported: ${netIncome} USD`);
      }
      if (reason !== "source_unavailable") {
        expect(text(cell)).toContain("Operating cash flow numerator");
        expect(text(cell)).toContain("Reported: 150 USD");
      }
      expect(
        elements(cell).find((element) => element.type === "button")?.props[
          "aria-label"
        ],
      ).toBe(
        "ONE Operating cash flow / net income (%): Unknown. Show source details",
      );
    },
  );

  it("requires an explicit run, defaults to the last completed year, and explains annual scope", async () => {
    const view = await mount();
    expect(input(view, "Financial calendar year").props.value).toBe(
      new Date().getUTCFullYear() - 1,
    );
    expect(input(view, "Revenue basis").props.value).toBe("agreement");
    expect(text(view)).toContain("annual SEC flows and Q4 balance-sheet facts");
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
    inspectCell(render(), "Operating cash flow");
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
    inspectCell(render());
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
    const details = inspectCell(render());
    expect(text(details)).toContain("Exact value: 30.00 percent");
    expect(text(details)).toContain(
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
    change(render(), "Saved financial view", legacy.id);
    click(render(), "Load financial view");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    change(render(), "Revenue basis", "Revenues");
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...response(),
      revenueBasis: "Revenues",
    });
    submit(render());
    await flush();
    change(render(), "Financial view name", "Broad revenue");
    click(render(), "Save financial view as new");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.views[0]).toEqual({ ...legacy, display: null });
    expect(payload.views[0]?.criteria).not.toHaveProperty("revenueBasis");
    expect(payload.views[1]?.criteria.revenueBasis).toBe("Revenues");
    click(render(), "Reset financial criteria");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    click(render(), "Load financial view");
    expect(input(render(), "Revenue basis").props.value).toBe("Revenues");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    change(render(), "Saved financial view", legacy.id);
    click(render(), "Load financial view");
    expect(input(render(), "Revenue basis").props.value).toBe("agreement");
    submit(render());
    await flush();
    const legacyRequest = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[0] as PersonalFinancialScreenRequestDto;
    expect(legacyRequest.criteria).not.toHaveProperty("revenueBasis");
  });

  it.each([
    "agreement",
    "SalesRevenueNet",
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
  ] as const)(
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
      inspectCell(render(), "Revenue");
      const rendered = text(render());
      expect(rendered).toContain(`Unavailable: ${reason}`);
      for (const label of [
        "Net margin",
        "Operating margin",
        "Operating cash flow margin",
      ])
        expect(text(inspectCell(render(), label))).toContain(
          "This margin remains unknown because revenue is unresolved.",
        );
      expect(text(inspectCell(render()))).toContain(
        "This ratio remains unknown because selected revenue is unresolved.",
      );
      const cashCell = inspectCell(
        render(),
        "Operating cash flow / net income (%)",
      );
      expect(text(cashCell)).toContain("Exact value: -823045260.80 percent");
      expect(text(cashCell)).toContain("Net income denominator NetIncomeLoss");
      expect(text(cashCell)).not.toContain("Revenue denominator:");
      expect(text(cashCell)).not.toContain("Unavailable:");
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
      ).toHaveLength(15);
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
    expect(text(inspectCell(render(), "Net margin"))).toContain(
      "Unavailable: period mismatch",
    );
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
    change(render(), "Financial view name", "Large revenue");
    click(render(), "Save financial view");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]?.[1] as PersonalFinancialSavedViewsPayloadDto;
    expect(Object.keys(payload).sort()).toEqual(["schemaVersion", "views"]);
    expect(Object.keys(payload.views[0] ?? {}).sort()).toEqual([
      "createdAgainstCatalogSnapshotSha256",
      "createdAgainstFinancialSnapshotSha256",
      "criteria",
      "display",
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
    click(render(), "Load financial view");
    view = render();
    expect(input(view, "Financial threshold 1").props.value).toBe(
      "1000000000.0001",
    );
    expect(input(view, "Financial sort field").props.value).toBe("revenue");
    expect(text(view)).not.toContain("Open ONE");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(1);
    submit(view);
    await flush();
    change(render(), "Financial view name", "Renamed revenue");
    click(render(), "Save financial view");
    await flush();
    expect(api.savePersonalFinancialSavedViews.mock.calls.at(-1)?.[0]).toBe(1);
    expect(
      (
        api.savePersonalFinancialSavedViews.mock.calls.at(
          -1,
        )?.[1] as PersonalFinancialSavedViewsPayloadDto
      ).views,
    ).toHaveLength(1);
    click(render(), "Delete financial view");
    await flush();
    expect(api.savePersonalFinancialSavedViews.mock.calls.at(-1)?.[1]).toEqual({
      schemaVersion: 2,
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
    expect(text(render())).toContain("SEC source coverage is partial");
    expect(text(render())).not.toContain("All concept requests failed");
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      sources: result.sources.map((source) => ({
        ...source,
        status: "upstream_unavailable",
      })),
      priorRevenueSources: result.priorRevenueSources.map((source) => ({
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
    expect(button(render(), "Save financial view as new").props.disabled).toBe(
      true,
    );
    change(render(), "Financial view name", "New screen");
    click(render(), "Save financial view");
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(text(render())).toContain("Up to 20 financial views");
    change(render(), "Saved financial view", "screen-1");
    change(render(), "Financial view name", "SCREEN 0");
    click(render(), "Save financial view");
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(text(render())).toContain("Use a unique view name");
  });

  it("requires saved-view reconciliation after a conflicting write", async () => {
    await mount();
    submit(render());
    await flush();
    change(render(), "Financial view name", "Profitable");
    api.savePersonalFinancialSavedViews.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("conflict"),
    );
    click(render(), "Save financial view");
    await flush();
    expect(text(render())).toContain("changed elsewhere");
    expect(button(render(), "Save financial view").props.disabled).toBe(true);
    click(render(), "Reload saved views");
    await flush();
    expect(button(render(), "Save financial view").props.disabled).toBe(false);
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
    inspectCell(render(), "Operating cash flow / net income (%)");
    expect(cashIncomeCell(render())).toBeDefined();
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    submit(render());
    const screenSignal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    api.fetchPersonalFinancialSavedViews.mockRejectedValueOnce(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    click(render(), "Reload saved views");
    await flush();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    expect(screenSignal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).not.toContain("Private saved criteria");
    expect(cashIncomeCell(render())).toBeUndefined();
    expect(text(render())).not.toContain("Open ONE");
    expect(input(render(), "Financial view name").props.value).toBe("");
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
    change(render(), "Financial view name", "Pending");
    const pending = deferred<{
      version: number;
      payload: PersonalFinancialSavedViewsPayloadDto;
    }>();
    api.savePersonalFinancialSavedViews.mockReturnValueOnce(pending.promise);
    click(render(), "Save financial view");
    const signal = api.savePersonalFinancialSavedViews.mock.calls.at(
      -1,
    )?.[2] as AbortSignal;
    harness.unmount();
    expect(signal.aborted).toBe(true);
    pending.resolve({ version: 1, payload: { schemaVersion: 1, views: [] } });
    await flush();
    expect(text(render())).not.toContain(
      "Financial view criteria and columns saved",
    );
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
    change(render(), "Financial column view", "all");
    expect(ratioCell(render())).toBeDefined();
    expect(cashIncomeCell(render())).toBeDefined();
    props = { ...props, disabled: true };
    render();
    expect(text(render())).not.toContain("Open ONE");
    expect(ratioCell(render())).toBeUndefined();
    expect(cashIncomeCell(render())).toBeUndefined();
  });
  it("bounds the comparison shortlist to three distinct issuers and keeps selection read-only", async () => {
    const result = comparisonResponse(0, 4);
    const alternate = {
      ...result.rows[0]!,
      identity: {
        ...result.rows[0]!.identity,
        listingId: "listing-alternate",
        securityId: "security-alternate",
        shareClassId: "class-alternate",
        symbol: "ALT",
      },
    };
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      rows: [...result.rows, alternate],
    });
    await mount();
    submit(render());
    await flush();
    const requests = api.screenPersonalFinancials.mock.calls.length;
    const savedReads = api.fetchPersonalFinancialSavedViews.mock.calls.length;
    const activity = activityStart.mock.calls.length;
    const staleFirst = button(render(), "Select CMP0 for comparison");
    const staleAlternate = button(render(), "Select ALT for comparison");
    const staleFourth = button(render(), "Select CMP3 for comparison");
    click(render(), "Select CMP0 for comparison");
    staleFirst.props.onClick?.();
    staleAlternate.props.onClick?.();
    expect(text(render())).toContain("1 of 3 companies selected");
    expect(button(render(), "Compare companies").props.disabled).toBe(true);
    expect(button(render(), "Select ALT for comparison").props.disabled).toBe(
      true,
    );
    click(render(), "Select ALT for comparison");
    expect(text(render())).toContain("1 of 3 companies selected");
    expect(text(render())).toContain(
      "Another listing of this issuer is selected.",
    );
    click(render(), "Select CMP1 for comparison");
    click(render(), "Select CMP2 for comparison");
    staleFourth.props.onClick?.();
    expect(text(render())).toContain("3 of 3 companies selected");
    expect(button(render(), "Select CMP3 for comparison").props.disabled).toBe(
      true,
    );
    click(render(), "Select CMP3 for comparison");
    expect(text(render())).toContain("3 of 3 companies selected");
    expect(button(render(), "Compare companies").props.disabled).toBe(false);
    click(render(), "Compare companies");
    expect(text(comparisonPanel(render()))).toContain("CMP0");
    expect(text(comparisonPanel(render()))).toContain("CMP1");
    expect(text(comparisonPanel(render()))).toContain("CMP2");
    expect(text(comparisonPanel(render()))).not.toContain("CMP3");
    click(render(), "Remove CMP1 from comparison");
    expect(text(render())).toContain("2 of 3 companies selected");
    click(render(), "Select CMP3 for comparison");
    expect(text(render())).toContain("3 of 3 companies selected");
    click(render(), "Clear comparison");
    expect(text(render())).toContain("0 of 3 companies selected");
    expect(comparisonPanel(render())).toBeUndefined();
    click(render(), "Select ALT for comparison");
    expect(text(render())).toContain("1 of 3 companies selected");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(requests);
    expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledTimes(
      savedReads,
    );
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(activityStart).toHaveBeenCalledTimes(activity);
    expect(props.onOpenResearch).not.toHaveBeenCalled();
    expect(props.onAddToWatchlist).not.toHaveBeenCalled();
  });

  it("compares the new exact percentage across pages, retaining three-operand details through display changes", async () => {
    const first = comparisonResponse(0, 26);
    const negativeMetrics = cashPpeMarginResponse(
      "-1.01",
      "1.00001",
      "2.00501",
      "100",
      true,
    ).rows[0]!.metrics;
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...first,
      rows: first.rows.map((row, index) =>
        index === 0 ? { ...row, metrics: negativeMetrics } : row,
      ),
    });
    await mount();
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    const next = comparisonResponse(25, 26);
    const positiveMetrics = cashPpeMarginResponse("150.00", "200", "50", "100")
      .rows[0]!.metrics;
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...next,
      rows: next.rows.map((row) => ({ ...row, metrics: positiveMetrics })),
    });
    click(render(), "Next financial page");
    await flush();
    click(render(), "Select CMP25 for comparison");
    change(render(), "Financial column view", "cashFlow");
    click(render(), "Compare companies");
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(6);
    const negative = ratioCell(
      comparisonPanel(render()),
      cashPpeMarginLabel,
      "CMP0",
    )!;
    expect(negative.props["aria-label"]).toBe(
      `CMP0 ${cashPpeMarginLabel}: -1.01%. Show source details`,
    );
    expect(
      ratioCell(comparisonPanel(render()), cashPpeMarginLabel, "CMP25")?.props[
        "aria-label"
      ],
    ).toBe(`CMP25 ${cashPpeMarginLabel}: 150.00%. Show source details`);
    (negative.props.onClick as (event: unknown) => void)({
      currentTarget: null,
    });
    expect(text(inspector(render()))).toContain("Exact value: -1.01 percent");
    expect(text(inspector(render()))).toContain("Reported: 1.00001 USD");
    expect(text(inspector(render()))).toContain("Reported: 2.00501 USD");
    expect(text(inspector(render()))).toContain("Reported: 100 USD");
    expect(
      elements(inspector(render())).filter(
        (item) => item.props.className === "financial-screen-source-card",
      ),
    ).toHaveLength(4);
    toggleColumn(render(), cashPpeMarginLabel, false);
    expect(inspector(render())).toBeUndefined();
    expect(
      ratioCell(comparisonPanel(render()), cashPpeMarginLabel, "CMP0"),
    ).toBeUndefined();
    expect(text(render())).toContain("2 of 3 companies selected");
    toggleColumn(render(), cashPpeMarginLabel, true);
    expect(
      ratioCell(comparisonPanel(render()), cashPpeMarginLabel, "CMP0"),
    ).toBeDefined();
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(6);
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(props.onAddToWatchlist).not.toHaveBeenCalled();
    change(render(), "Revenue basis", "Revenues");
    expect(comparisonPanel(render())).toBeUndefined();
    expect(inspector(render())).toBeUndefined();
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
  });

  it("compares retained rows across pinned pages and rejects stale page actions while preserving display-only changes", async () => {
    const first = comparisonResponse(0, 26);
    api.screenPersonalFinancials.mockResolvedValueOnce(first);
    await mount();
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    click(render(), "Select CMP1 for comparison");
    const staleSelection = button(render(), "Select CMP2 for comparison");
    const staleCompare = button(render(), "Compare companies");
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    click(render(), "Next financial page");
    staleSelection.props.onClick?.();
    staleCompare.props.onClick?.();
    expect(comparisonPanel(render())).toBeUndefined();
    expect(
      elements(render()).some(
        (item) =>
          item.type === "button" && text(item) === "Select CMP2 for comparison",
      ),
    ).toBe(false);
    pending.resolve(comparisonResponse(25, 26));
    await flush();
    staleSelection.props.onClick?.();
    staleCompare.props.onClick?.();
    expect(text(render())).toContain("2 of 3 companies selected");
    expect(comparisonPanel(render())).toBeUndefined();
    click(render(), "Select CMP25 for comparison");
    click(render(), "Compare companies");
    let panel = comparisonPanel(render());
    for (const symbol of ["CMP0", "CMP1", "CMP25"])
      expect(text(panel)).toContain(symbol);
    expect(text(panel)).not.toContain("CMP2 ");
    expect(comparisonMetricRows(panel)).toHaveLength(5);
    change(render(), "Financial column view", "q4Balances");
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(6);
    change(render(), "Financial column view", "all");
    expect(comparisonMetricRows(comparisonPanel(render()))).toHaveLength(20);
    toggleColumn(render(), "Revenue", false);
    panel = comparisonPanel(render());
    expect(comparisonMetricRows(panel)).toHaveLength(19);
    expect(text(render())).toContain("3 of 3 companies selected");
    const balance = ratioCell(
      panel,
      "Current assets less current liabilities (USD)",
      "CMP0",
    )!;
    (balance.props.onClick as (event: unknown) => void)({
      currentTarget: null,
    });
    expect(text(inspector(render()))).toContain("CMP0");
    expect(text(inspector(render()))).toContain("Exact value: 20 USD");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(api.screenPersonalFinancials.mock.calls.at(-1)?.[0]).toMatchObject({
      financialSnapshotSha256: first.financialSnapshotSha256,
      page: { offset: 25, limit: 25 },
    });
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(props.onAddToWatchlist).not.toHaveBeenCalled();
    expect(props.onOpenResearch).not.toHaveBeenCalled();
  });

  it("opens the exact decoded compared company even when its result is on another page without changing financial state", async () => {
    const first = comparisonResponse(0, 26);
    const next = comparisonResponse(25, 26);
    api.screenPersonalFinancials.mockResolvedValueOnce(first);
    await mount();
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    api.screenPersonalFinancials.mockResolvedValueOnce(next);
    click(render(), "Next financial page");
    await flush();
    click(render(), "Select CMP25 for comparison");
    click(render(), "Compare companies");
    change(render(), "Financial column view", "cashFlow");
    const before = render();
    const beforeText = text(before);
    expect(text(before)).not.toContain("Open CMP0");
    click(comparisonPanel(before), "Research CMP0");
    click(comparisonPanel(render()), "Research CMP25");
    expect(props.onOpenResearch).toHaveBeenNthCalledWith(
      1,
      first.rows[0]!.identity,
    );
    expect(props.onOpenResearch).toHaveBeenNthCalledWith(
      2,
      next.rows[0]!.identity,
    );
    expect(vi.mocked(props.onOpenResearch).mock.calls[0]![0]).toBe(
      first.rows[0]!.identity,
    );
    expect(vi.mocked(props.onOpenResearch).mock.calls[1]![0]).toBe(
      next.rows[0]!.identity,
    );
    expect(text(render())).toBe(beforeText);
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(props.onAddToWatchlist).not.toHaveBeenCalled();
  });

  it("preserves watchlist selection, criteria, columns and comparison when researching a selected company", async () => {
    configureWatchlist(3);
    api.screenPersonalFinancials.mockImplementation(
      (request: PersonalFinancialScreenRequestDto) =>
        Promise.resolve(watchlistResponse(request)),
    );
    await mount();
    change(render(), "Financial screen scope", "watchlist");
    click(render(), "Select all for financials");
    click(render(), "Add financial filter");
    change(render(), "Financial threshold 1", "0");
    submit(render());
    await flush();
    click(render(), "Select CMP0 for comparison");
    click(render(), "Select CMP1 for comparison");
    click(render(), "Compare companies");
    change(render(), "Financial column view", "q4Balances");
    const before = render();
    const beforeText = text(before);
    click(comparisonPanel(before), "Research CMP1");
    expect(props.onOpenResearch).toHaveBeenCalledExactlyOnceWith(
      comparisonResponse(1, 2).rows[0]!.identity,
    );
    const after = render();
    expect(text(after)).toBe(beforeText);
    expect(input(after, "Financial threshold 1").props.value).toBe("0");
    expect(input(after, "Financial column view").props.value).toBe(
      "q4Balances",
    );
    expect(input(after, "Financial screen scope").props.value).toBe(
      "watchlist",
    );
    expect(financialListing(after, "CMP0").props.checked).toBe(true);
    expect(financialListing(after, "CMP1").props.checked).toBe(true);
    expect(financialListing(after, "CMP2").props.checked).toBe(true);
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(api.fetchPersonalFinancialSavedViews).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    expect(props.onAddToWatchlist).not.toHaveBeenCalled();
  });

  it("rejects old page research callbacks during and after a pinned page load while preserving current off-page research", async () => {
    await mountComparison(26);
    const staleResearch = button(comparisonPanel(render()), "Research CMP0");
    const staleOpen = button(render(), "Open CMP0");
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    click(render(), "Next financial page");
    staleResearch.props.onClick?.();
    staleOpen.props.onClick?.();
    expect(props.onOpenResearch).not.toHaveBeenCalled();
    pending.resolve(comparisonResponse(25, 26));
    await flush();
    staleResearch.props.onClick?.();
    staleOpen.props.onClick?.();
    expect(props.onOpenResearch).not.toHaveBeenCalled();
    click(comparisonPanel(render()), "Research CMP0");
    expect(props.onOpenResearch).toHaveBeenCalledExactlyOnceWith(
      comparisonResponse(0, 26).rows[0]!.identity,
    );
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it.each([
    "Remove CMP0 from comparison",
    "Clear comparison",
    "Close comparison",
  ] as const)(
    "rejects a retained company research action after %s",
    async (action) => {
      await mountComparison();
      const staleResearch = button(comparisonPanel(render()), "Research CMP0");
      click(render(), action);
      staleResearch.props.onClick?.();
      render();
      staleResearch.props.onClick?.();
      expect(props.onOpenResearch).not.toHaveBeenCalled();
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it.each([
    "scope",
    "selection",
    "version",
    "membership",
    "availability",
    "catalog",
    "disabled",
    "workspace",
  ] as const)(
    "rejects completed watchlist research callbacks immediately after a %s change",
    async (boundary) => {
      configureWatchlist(3);
      api.screenPersonalFinancials.mockImplementation(
        (request: PersonalFinancialScreenRequestDto) =>
          Promise.resolve(watchlistResponse(request)),
      );
      await mount();
      change(render(), "Financial screen scope", "watchlist");
      click(render(), "Select all for financials");
      submit(render());
      await flush();
      click(render(), "Select CMP0 for comparison");
      click(render(), "Select CMP1 for comparison");
      click(render(), "Compare companies");
      const staleResearch = button(comparisonPanel(render()), "Research CMP0");
      const staleOpen = button(render(), "Open CMP0");
      if (boundary === "scope")
        change(render(), "Financial screen scope", "catalog");
      else if (boundary === "selection")
        selectFinancialListing(render(), "CMP2", false);
      else if (boundary === "version")
        props = { ...props, watchlistVersion: 8 };
      else if (boundary === "membership")
        props = {
          ...props,
          watchlistMemberships: props.watchlistMemberships!.slice(1),
        };
      else if (boundary === "availability")
        props = { ...props, watchlistAvailable: false };
      else if (boundary === "catalog")
        props = {
          ...props,
          snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
        };
      else if (boundary === "disabled") props = { ...props, disabled: true };
      else props = { ...props, workspaceReady: false };
      render(() => {
        staleResearch.props.onClick?.();
        staleOpen.props.onClick?.();
        expect(props.onOpenResearch).not.toHaveBeenCalled();
      });
      staleResearch.props.onClick?.();
      staleOpen.props.onClick?.();
      expect(props.onOpenResearch).not.toHaveBeenCalled();
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it("preserves every decoded metric and source reference, signed balances, unknown operands and actual dates in comparison", async () => {
    const result = comparisonResponse(0, 3);
    const negative = currentBalanceDifferenceResponse(
      "158104000000",
      "162367000000",
      "-4263000000",
    ).rows[0]!;
    const zero = currentBalanceDifferenceResponse("100", "0", "100").rows[0]!;
    const unknown = result.rows[2]!;
    const unknownSources =
      unknown.metrics.currentAssetsLessCurrentLiabilities.sources.map(
        (source) => ({
          ...source,
          asOfDate:
            source.concept === "AssetsCurrent" ? "2025-12-31" : "2026-01-31",
        }),
      );
    const rows = [
      { ...result.rows[0]!, metrics: negative.metrics },
      { ...result.rows[1]!, metrics: zero.metrics },
      {
        ...unknown,
        metrics: {
          ...unknown.metrics,
          currentAssetsLessCurrentLiabilities: {
            status: "unavailable" as const,
            unit: "USD" as const,
            reason: "balance_date_mismatch" as const,
            sources: unknownSources,
          },
        },
      },
    ];
    api.screenPersonalFinancials.mockResolvedValueOnce({
      ...result,
      revenueBasis: "Revenues",
      rows,
    });
    await mount();
    change(render(), "Revenue basis", "Revenues");
    change(render(), "Financial column view", "all");
    submit(render());
    await flush();
    for (const symbol of ["CMP0", "CMP1", "CMP2"])
      click(render(), `Select ${symbol} for comparison`);
    click(render(), "Compare companies");
    const panel = comparisonPanel(render());
    const rendered = text(panel);
    expect(rendered).toContain("-$4.26B");
    expect(rendered).toContain("Revenues");
    expect(rendered).toContain(result.fetchedAt);
    expect(rendered).toContain(result.expiresAt);
    expect(rendered).toContain(result.catalogSnapshotSha256);
    expect(rendered).toContain(result.financialSnapshotSha256);
    expect(rendered).toContain(result.formulaVersion);
    expect(comparisonMetricRows(panel)).toHaveLength(20);
    const cells = elements(panel).filter(
      (item) =>
        typeof item.type === "function" && item.type.name === "FinancialCell",
    );
    expect(cells).toHaveLength(60);
    for (const row of rows) {
      const companyCells = cells.filter(
        (item) => item.props.symbol === row.identity.symbol,
      );
      expect(companyCells.map((item) => item.props.metric)).toEqual(
        PERSONAL_FINANCIAL_SCREEN_METRICS,
      );
      for (const cell of companyCells) {
        const metric = cell.props.metric as keyof typeof row.metrics;
        expect(cell.props.cell).toBe(row.metrics[metric]);
      }
    }
    for (const [symbol, label, expected] of [
      [
        "CMP0",
        "Current assets less current liabilities (USD)",
        ["-4263000000", "158104000000", "162367000000"],
      ],
      [
        "CMP1",
        "Current assets / current liabilities (×)",
        ["Unavailable: nonpositive current liabilities", "Reported: 0 USD"],
      ],
      [
        "CMP2",
        "Current assets less current liabilities (USD)",
        ["Unavailable: balance date mismatch", "2025-12-31", "2026-01-31"],
      ],
      ["CMP0", "Revenue", ["Unavailable: conflicting"]],
      [
        "CMP2",
        "Net income",
        ["2024-01-01", "2024-12-31", "0000000001-25-000001"],
      ],
    ] as const) {
      const cell = ratioCell(comparisonPanel(render()), label, symbol)!;
      (cell.props.onClick as (event: unknown) => void)({ currentTarget: null });
      for (const value of expected)
        expect(text(inspector(render()))).toContain(value);
      click(render(), "Close details");
    }
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it.each(["run", "refresh"] as const)(
    "clears comparison before a new %s even when the completed response reuses the same snapshot",
    async (action) => {
      await mountComparison();
      const staleSelect = button(render(), "Select CMP2 for comparison");
      const staleCompare = button(render(), "Compare companies");
      const staleResearch = button(comparisonPanel(render()), "Research CMP0");
      const staleOpen = button(render(), "Open CMP0");
      const pending = deferred<PersonalFinancialScreenResponseDto>();
      api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
      if (action === "run") submit(render());
      else click(render(), "Refresh SEC data");
      staleSelect.props.onClick?.();
      staleCompare.props.onClick?.();
      staleResearch.props.onClick?.();
      staleOpen.props.onClick?.();
      expect(comparisonPanel(render())).toBeUndefined();
      pending.resolve(comparisonResponse(0, 4));
      await flush();
      staleSelect.props.onClick?.();
      staleCompare.props.onClick?.();
      staleResearch.props.onClick?.();
      staleOpen.props.onClick?.();
      expect(props.onOpenResearch).not.toHaveBeenCalled();
      expect(text(render())).toContain("0 of 3 companies selected");
      expect(comparisonPanel(render())).toBeUndefined();
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it.each([
    "year",
    "basis",
    "company",
    "sort",
    "direction",
    "clause",
    "reset",
    "starter",
    "load",
  ] as const)(
    "invalidates the comparison on %s criteria changes and ignores retained controls",
    async (action) => {
      await mountComparison();
      if (action === "load") {
        change(render(), "Financial view name", "Comparison criteria");
        click(render(), "Save financial view");
        await flush();
      }
      const staleSelect = button(render(), "Select CMP2 for comparison");
      const staleCompare = button(render(), "Compare companies");
      const staleResearch = button(comparisonPanel(render()), "Research CMP0");
      const staleOpen = button(render(), "Open CMP0");
      const beforeWrites =
        api.savePersonalFinancialSavedViews.mock.calls.length;
      if (action === "year")
        change(render(), "Financial calendar year", "2024");
      else if (action === "basis")
        change(render(), "Revenue basis", "Revenues");
      else if (action === "company")
        change(render(), "Financial company filter", "Different");
      else if (action === "sort")
        change(render(), "Financial sort field", "currentRatio");
      else if (action === "direction")
        change(render(), "Financial sort direction", "desc");
      else if (action === "clause") {
        click(render(), "Add financial filter");
        change(render(), "Financial threshold 1", "0");
      } else if (action === "reset")
        click(render(), "Reset financial criteria");
      else if (action === "starter")
        click(render(), "Apply Q4 liquidity cover");
      else click(render(), "Load financial view");
      staleSelect.props.onClick?.();
      staleCompare.props.onClick?.();
      staleResearch.props.onClick?.();
      staleOpen.props.onClick?.();
      expect(comparisonPanel(render())).toBeUndefined();
      expect(text(render())).not.toContain("2 of 3 companies selected");
      api.screenPersonalFinancials.mockImplementationOnce(
        (request: PersonalFinancialScreenRequestDto) =>
          Promise.resolve({
            ...comparisonResponse(0, 4),
            calendarYear: request.criteria.calendarYear,
            priorCalendarYear: request.criteria.calendarYear - 1,
            revenueBasis: request.criteria.revenueBasis ?? "agreement",
          }),
      );
      submit(render());
      await flush();
      staleSelect.props.onClick?.();
      staleCompare.props.onClick?.();
      staleResearch.props.onClick?.();
      staleOpen.props.onClick?.();
      expect(props.onOpenResearch).not.toHaveBeenCalled();
      expect(text(render())).toContain("0 of 3 companies selected");
      expect(comparisonPanel(render())).toBeUndefined();
      expect(api.savePersonalFinancialSavedViews).toHaveBeenCalledTimes(
        beforeWrites,
      );
    },
  );

  it.each([
    "catalog",
    "financial",
    "year",
    "priorYear",
    "basis",
    "transport",
    "formula",
    "fetched",
    "expires",
  ] as const)(
    "clears retained companies when pagination returns different %s snapshot context",
    async (boundary) => {
      await mountComparison(26);
      const next = comparisonResponse(25, 26);
      const update =
        boundary === "catalog"
          ? { catalogSnapshotSha256: sha("c") }
          : boundary === "financial"
            ? { financialSnapshotSha256: sha("d") }
            : boundary === "year"
              ? { calendarYear: next.calendarYear - 1 }
              : boundary === "priorYear"
                ? { priorCalendarYear: next.priorCalendarYear - 1 }
                : boundary === "basis"
                  ? { revenueBasis: "Revenues" as const }
                  : boundary === "transport"
                    ? { schemaVersion: "8.0.0" as const }
                    : boundary === "formula"
                      ? { formulaVersion: "1.6.0" }
                      : boundary === "fetched"
                        ? { fetchedAt: "2026-09-01T00:01:00.000Z" }
                        : { expiresAt: "2026-09-01T00:31:00.000Z" };
      api.screenPersonalFinancials.mockResolvedValueOnce({
        ...next,
        ...update,
      });
      click(render(), "Next financial page");
      await flush();
      expect(text(render())).toContain("0 of 3 companies selected");
      expect(comparisonPanel(render())).toBeUndefined();
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    },
  );

  it("ignores superseded page controls without dispatching or aborting the newer query", async () => {
    await mountComparison(26);
    const oldNext = button(render(), "Next financial page");
    change(render(), "Financial company filter", "Replacement query");
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    submit(render());
    const signal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    oldNext.props.onClick?.();
    expect(signal.aborted).toBe(false);
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    pending.resolve(comparisonResponse(0, 26));
    await flush();
    oldNext.props.onClick?.();
    expect(signal.aborted).toBe(false);
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("0 of 3 companies selected");
    expect(comparisonPanel(render())).toBeUndefined();
    expect(activityStart).toHaveBeenCalledTimes(2);
  });

  it("ignores an old page completion and clear action after a newer screen has its own shortlist", async () => {
    await mountComparison(26);
    const oldClear = button(render(), "Clear comparison");
    const pending = deferred<PersonalFinancialScreenResponseDto>();
    api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
    click(render(), "Next financial page");
    const oldSignal = api.screenPersonalFinancials.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    const fresh = {
      ...comparisonResponse(0, 4),
      financialSnapshotSha256: sha("e"),
    };
    api.screenPersonalFinancials.mockResolvedValueOnce(fresh);
    submit(render());
    await flush();
    expect(oldSignal.aborted).toBe(true);
    click(render(), "Select CMP2 for comparison");
    click(render(), "Select CMP3 for comparison");
    click(render(), "Compare companies");
    pending.resolve(comparisonResponse(25, 26));
    await flush();
    oldClear.props.onClick?.();
    const panel = comparisonPanel(render());
    expect(text(panel)).toContain("CMP2");
    expect(text(panel)).toContain("CMP3");
    expect(text(panel)).toContain(fresh.financialSnapshotSha256);
    expect(text(panel)).not.toContain("CMP25");
    expect(text(render())).toContain("2 of 3 companies selected");
    expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(3);
    expect(activityCompletion).toHaveBeenCalledTimes(2);
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it("rejects hidden-metric and obsolete detail-close callbacks without closing the current comparison inspector", async () => {
    await mountComparison();
    const hiddenMetric = ratioCell(
      comparisonPanel(render()),
      "Net income",
      "CMP0",
    )!;
    const retainedVisibleMetric = ratioCell(
      comparisonPanel(render()),
      "Current assets / current liabilities (×)",
      "CMP0",
    )!;
    change(render(), "Financial column view", "q4Balances");
    (hiddenMetric.props.onClick as (event: unknown) => void)({
      currentTarget: null,
    });
    expect(inspector(render())).toBeUndefined();
    (retainedVisibleMetric.props.onClick as (event: unknown) => void)({
      currentTarget: null,
    });
    const oldClose = button(render(), "Close details");
    const freshMetric = ratioCell(
      comparisonPanel(render()),
      "Current assets",
      "CMP1",
    )!;
    (freshMetric.props.onClick as (event: unknown) => void)({
      currentTarget: null,
    });
    expect(text(inspector(render()))).toContain("CMP1 · Current assets");
    oldClose.props.onClick?.();
    expect(text(inspector(render()))).toContain("CMP1 · Current assets");
    expect(text(render())).toContain("2 of 3 companies selected");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(activityStart).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it.each(["request_failed", "conflict", "session_unavailable"] as const)(
    "discards comparison on a %s page failure and cannot restore it with retained callbacks",
    async (failure) => {
      await mountComparison(26);
      const staleSelect = button(render(), "Select CMP2 for comparison");
      const staleCompare = button(render(), "Compare companies");
      api.screenPersonalFinancials.mockRejectedValueOnce(
        failure === "request_failed"
          ? new Error("Unavailable")
          : new PersonalWorkspaceApiError(failure),
      );
      click(render(), "Next financial page");
      await flush();
      staleSelect.props.onClick?.();
      staleCompare.props.onClick?.();
      expect(comparisonPanel(render())).toBeUndefined();
      expect(text(render())).not.toContain("2 of 3 companies selected");
      expect(api.screenPersonalFinancials).toHaveBeenCalledTimes(2);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
      expect(props.onSessionUnavailable).toHaveBeenCalledTimes(
        failure === "session_unavailable" ? 1 : 0,
      );
    },
  );

  it.each(["catalog", "disabled", "workspace", "session", "unmount"] as const)(
    "aborts pending pagination and prevents comparison resurrection across the %s lifetime boundary",
    async (boundary) => {
      await mountComparison(26);
      const staleCompare = button(render(), "Compare companies");
      const pending = deferred<PersonalFinancialScreenResponseDto>();
      api.screenPersonalFinancials.mockReturnValueOnce(pending.promise);
      click(render(), "Next financial page");
      const signal = api.screenPersonalFinancials.mock.calls.at(
        -1,
      )?.[1] as AbortSignal;
      if (boundary === "catalog")
        props = {
          ...props,
          snapshot: { ...props.snapshot, snapshotSha256: sha("c") },
        };
      else if (boundary === "disabled") props = { ...props, disabled: true };
      else if (boundary === "workspace")
        props = { ...props, workspaceReady: false };
      else if (boundary === "session") {
        api.fetchPersonalFinancialSavedViews.mockRejectedValueOnce(
          new PersonalWorkspaceApiError("session_unavailable"),
        );
        click(render(), "Reload saved views");
        await flush();
      } else harness.unmount();
      if (boundary !== "unmount") render();
      expect(signal.aborted).toBe(true);
      pending.resolve(comparisonResponse(25, 26));
      await flush();
      staleCompare.props.onClick?.();
      expect(comparisonPanel(render())).toBeUndefined();
      expect(text(render())).not.toContain("2 of 3 companies selected");
      expect(activityCompletion).toHaveBeenCalledTimes(1);
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it.each(["Close comparison", "Escape"] as const)(
    "focuses the named comparison, permits links and commits dismissal before %s restores focus",
    async (action) => {
      api.screenPersonalFinancials.mockResolvedValueOnce(comparisonResponse());
      await mount();
      submit(render());
      await flush();
      click(render(), "Select CMP0 for comparison");
      click(render(), "Select CMP1 for comparison");
      let committedView: unknown;
      const headingFocus = vi.fn();
      const headingScroll = vi.fn();
      const triggerFocus = vi.fn(() => {
        expect(comparisonPanel(committedView)).toBeUndefined();
      });
      const triggerScroll = vi.fn(() => {
        expect(comparisonPanel(committedView)).toBeUndefined();
      });
      const compareButton = elements(render()).find(
        (item) => item.type === "button" && text(item) === "Compare companies",
      )!;
      (
        compareButton.props.ref as React.RefObject<HTMLButtonElement | null>
      ).current = {
        isConnected: true,
        focus: triggerFocus,
        scrollIntoView: triggerScroll,
      } as unknown as HTMLButtonElement;
      click(render(), "Compare companies");
      committedView = render((view) => {
        attachHeading(view, "financial-screen-comparison-title", {
          focus: headingFocus,
          scrollIntoView: headingScroll,
        } as unknown as HTMLHeadingElement);
      });
      expect(headingFocus).toHaveBeenCalledExactlyOnceWith({
        preventScroll: true,
      });
      expect(headingScroll).toHaveBeenCalledExactlyOnceWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      expect(headingFocus.mock.invocationCallOrder[0]).toBeLessThan(
        headingScroll.mock.invocationCallOrder[0]!,
      );
      // Reopening an already open comparison must still move focus into it,
      // without relying on a changed open-state effect or CSS smooth scrolling.
      click(render(), "Compare companies");
      committedView = render();
      expect(headingFocus).toHaveBeenCalledTimes(2);
      expect(headingFocus).toHaveBeenLastCalledWith({ preventScroll: true });
      expect(headingScroll).toHaveBeenCalledTimes(2);
      expect(headingScroll).toHaveBeenLastCalledWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      const panel = comparisonPanel(committedView)!;
      expect(panel.props["aria-labelledby"]).toBe(
        "financial-screen-comparison-title",
      );
      expect(panel.props["aria-modal"]).toBeUndefined();
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      (panel.props.onKeyDown as (event: unknown) => void)({
        key: "Tab",
        preventDefault,
        stopPropagation,
      });
      expect(preventDefault).not.toHaveBeenCalled();
      harness.onCommit(() => {
        committedView = render();
      });
      if (action === "Close comparison") click(committedView, action);
      else {
        (panel.props.onKeyDown as (event: unknown) => void)({
          key: "Escape",
          preventDefault,
          stopPropagation,
        });
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(stopPropagation).toHaveBeenCalledOnce();
      }
      expect(comparisonPanel(committedView)).toBeUndefined();
      expect(triggerFocus).toHaveBeenCalledExactlyOnceWith({
        preventScroll: true,
      });
      expect(triggerScroll).toHaveBeenCalledExactlyOnceWith({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      expect(triggerFocus.mock.invocationCallOrder[0]).toBeLessThan(
        triggerScroll.mock.invocationCallOrder[0]!,
      );
      expect(text(render())).toContain("2 of 3 companies selected");
      expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
      expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
    },
  );

  it("commits removal before focusing the shortlist and prevents removed sources or stale controls from reviving it", async () => {
    await mountComparison();
    click(render(), "Select CMP2 for comparison");
    const oldRemove = button(render(), "Remove CMP0 from comparison");
    const source = ratioCell(comparisonPanel(render()), "Net income", "CMP0")!;
    (source.props.onClick as (event: unknown) => void)({ currentTarget: null });
    expect(inspector(render())).toBeDefined();
    let committedView: unknown = render();
    const headingFocus = vi.fn(() => {
      expect(text(comparisonPanel(committedView))).not.toContain("CMP0");
      expect(inspector(committedView)).toBeUndefined();
    });
    const headingScroll = vi.fn(() => {
      expect(text(comparisonPanel(committedView))).not.toContain("CMP0");
      expect(inspector(committedView)).toBeUndefined();
    });
    render((view) =>
      attachHeading(view, "financial-screen-shortlist-title", {
        focus: headingFocus,
        scrollIntoView: headingScroll,
      } as unknown as HTMLHeadingElement),
    );
    harness.onCommit(() => {
      committedView = render();
    });
    click(render(), "Remove CMP0 from comparison");
    expect(headingFocus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
    expect(headingScroll).toHaveBeenCalledExactlyOnceWith({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
    expect(headingFocus.mock.invocationCallOrder[0]).toBeLessThan(
      headingScroll.mock.invocationCallOrder[0]!,
    );
    expect(text(render())).toContain("2 of 3 companies selected");
    expect(comparisonPanel(render())).toBeDefined();
    (source.props.onClick as (event: unknown) => void)({ currentTarget: null });
    expect(inspector(render())).toBeUndefined();
    click(render(), "Select CMP0 for comparison");
    oldRemove.props.onClick?.();
    expect(text(render())).toContain("3 of 3 companies selected");
    click(render(), "Remove CMP0 from comparison");
    click(render(), "Remove CMP1 from comparison");
    expect(comparisonPanel(render())).toBeUndefined();
    expect(text(render())).toContain("1 of 3 companies selected");
    expect(button(render(), "Compare companies").props.disabled).toBe(true);
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
    expect(api.savePersonalFinancialSavedViews).not.toHaveBeenCalled();
  });

  it("keeps selected rows out of saved criteria and preserves ordinary company and watchlist actions", async () => {
    await mountComparison();
    const view = render();
    click(view, "Open CMP0");
    click(view, "Add CMP1");
    expect(props.onOpenResearch).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "CMP0" }),
    );
    expect(props.onAddToWatchlist).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "CMP1" }),
    );
    change(render(), "Financial view name", "Same ordinary saved criteria");
    click(render(), "Save financial view");
    await flush();
    const payload = api.savePersonalFinancialSavedViews.mock
      .calls[0]![1] as PersonalFinancialSavedViewsPayloadDto;
    expect(payload.schemaVersion).toBe(2);
    expect(Object.keys(payload.views[0]!.criteria).sort()).toEqual([
      "calendarYear",
      "clauses",
      "identityText",
      "sort",
    ]);
    expect(JSON.stringify(payload)).not.toContain("CMP");
    expect(JSON.stringify(payload)).not.toContain("listing-");
    expect(JSON.stringify(payload)).not.toContain("comparison");
    expect(text(render())).toContain("2 of 3 companies selected");
    expect(api.screenPersonalFinancials).toHaveBeenCalledOnce();
  });
});

function configureWatchlist(count: number) {
  const members: PersonalWatchlistMembership[] = Array.from(
    { length: count },
    (_, index) => {
      const { cik, ...identity } = comparisonResponse(index, index + 1).rows[0]!
        .identity;
      void cik;
      return { ...identity, note: "" };
    },
  );
  props = {
    ...props,
    watchlistVersion: 7,
    watchlistMemberships: members,
    watchlistAvailable: true,
  };
}

function watchlistResponse(
  request: PersonalFinancialScreenRequestDto,
): PersonalFinancialScreenResponseDto {
  const scope = request.scope!;
  const result = response(0, scope.listingIds.length);
  return {
    ...result,
    calendarYear: request.criteria.calendarYear,
    priorCalendarYear: request.criteria.calendarYear - 1,
    totalUniverse: scope.listingIds.length,
    scope: {
      ...scope,
      totalWatchlistListings: props.watchlistMemberships!.length,
    },
    rows: scope.listingIds.map((listingId) => {
      const index = props.watchlistMemberships!.findIndex(
        (member) => member.listingId === listingId,
      );
      return comparisonResponse(index, index + 1).rows[0]!;
    }),
  };
}

function financialListing(value: unknown, symbol: string) {
  const checkbox = elements(value).find(
    (item) => item.props["aria-label"] === `Screen financials for ${symbol}`,
  );
  if (!checkbox) throw new Error(`Missing saved listing ${symbol}`);
  return checkbox;
}

function selectFinancialListing(
  value: unknown,
  symbol: string,
  checked: boolean,
) {
  (
    financialListing(value, symbol).props.onChange as (event: {
      target: { checked: boolean };
    }) => void
  )({ target: { checked } });
}

function comparisonPanel(value: unknown) {
  return elements(value).find(
    (item) =>
      item.type === "section" &&
      item.props.id === "financial-screen-comparison",
  );
}
function comparisonMetricRows(value: unknown) {
  return elements(value).filter(
    (item) => item.type === "th" && item.props.scope === "row",
  );
}
async function mountComparison(count = 4) {
  api.screenPersonalFinancials.mockResolvedValueOnce(
    comparisonResponse(0, count),
  );
  await mount();
  submit(render());
  await flush();
  click(render(), "Select CMP0 for comparison");
  click(render(), "Select CMP1 for comparison");
  click(render(), "Compare companies");
  expect(comparisonPanel(render())).toBeDefined();
}
function comparisonResponse(
  offset = 0,
  count = 4,
): PersonalFinancialScreenResponseDto {
  const result = response(offset, count);
  return {
    ...result,
    rows: result.rows.map((row, index) => {
      const id = offset + index;
      return {
        ...row,
        identity: {
          ...row.identity,
          cik: String(id + 1).padStart(10, "0"),
          issuerId: `issuer-${String(id)}`,
          issuerName: `Comparison company ${String(id)}`,
          securityId: `security-${String(id)}`,
          securityName: `Comparison company ${String(id)} common`,
          shareClassId: `class-${String(id)}`,
          symbol: `CMP${String(id)}`,
        },
      };
    }),
  };
}

function savedViewFixture(name: string): PersonalFinancialSavedViewDto {
  return {
    id: `financial-screen-${name}`,
    name,
    criteria: {
      calendarYear: 2024,
      identityText: name,
      clauses: [],
      sort: { field: "symbol", direction: "asc" },
    },
    createdAgainstCatalogSnapshotSha256: sha("a"),
    createdAgainstFinancialSnapshotSha256: sha("c"),
  };
}

function render(beforeEffects?: (view: unknown) => void) {
  harness.begin();
  const view = PersonalFinancialScreener(props);
  beforeEffects?.(view);
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
function toggleColumn(value: unknown, label: string, checked: boolean) {
  const checkbox = elements(value).find(
    (item) => item.props["aria-label"] === `Show ${label} column`,
  );
  if (checkbox === undefined)
    throw new Error(`Missing column checkbox: ${label}`);
  (
    checkbox.props.onChange as (event: { target: { checked: boolean } }) => void
  )({ target: { checked } });
}
function columnHeaders(value: unknown) {
  const table = elements(value).find(
    (item) =>
      item.type === "table" &&
      String(item.props.className).includes("financial-screen-table"),
  );
  return elements(table)
    .filter((item) => item.type === "th" && item.props.scope === "col")
    .map((item) => text(item).trim());
}
function attachHeading(
  value: unknown,
  id: string,
  heading: HTMLHeadingElement,
) {
  const element = elements(value).find(
    (item) => item.type === "h3" && item.props.id === id,
  );
  if (element === undefined) throw new Error(`Missing heading: ${id}`);
  (element.props.ref as React.RefObject<HTMLHeadingElement | null>).current =
    heading;
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
function ratioCell(
  value: unknown,
  label = "Gross profit / selected revenue (%)",
  symbol = "ONE",
) {
  return elements(value).find(
    (element) =>
      element.type === "button" &&
      element.props.className === "financial-screen-value-button" &&
      String(element.props["aria-label"]).startsWith(`${symbol} ${label}:`),
  );
}
function inspector(value: unknown) {
  return elements(value).find(
    (element) =>
      element.type === "section" &&
      element.props.id === "financial-screen-source-inspector",
  );
}
function inspectCell(
  value: unknown,
  label = "Gross profit / selected revenue (%)",
  symbol = "ONE",
  trigger: HTMLButtonElement | null = null,
) {
  let cell = ratioCell(value, label, symbol);
  if (cell === undefined) {
    change(value, "Financial column view", "all");
    cell = ratioCell(render(), label, symbol);
  }
  if (cell === undefined)
    throw new Error(`Missing source button: ${symbol} ${label}`);
  (
    cell.props.onClick as (event: {
      currentTarget: HTMLButtonElement | null;
    }) => void
  )({ currentTarget: trigger });
  const opened = inspector(render());
  if (opened === undefined)
    throw new Error(`Source inspector did not open: ${symbol} ${label}`);
  return [ratioCell(render(), label, symbol), opened];
}
function cashIncomeCell(value: unknown) {
  return ratioCell(value, "Operating cash flow / net income (%)");
}
function cashPpeMarginResponse(
  value = "25.00",
  operatingCashFlow = "30",
  ppePurchases = "5",
  revenue = "100",
  agreeingRevenue = false,
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const operatingSource = {
    ...row.metrics.operatingCashFlow.sources[0]!,
    value: operatingCashFlow,
  };
  const purchaseSource = {
    ...row.metrics.ppePurchases.sources[0]!,
    value: ppePurchases,
  };
  const revenueSources = [
    { ...row.metrics.revenue.sources[0]!, value: revenue },
    ...(agreeingRevenue
      ? [
          {
            ...row.metrics.revenue.sources[0]!,
            concept:
              "RevenueFromContractWithCustomerExcludingAssessedTax" as const,
            value: revenue,
          },
        ]
      : []),
  ];
  return {
    ...result,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          operatingCashFlow: {
            status: "available",
            unit: "USD",
            value: operatingCashFlow,
            sources: [operatingSource],
          },
          ppePurchases: {
            status: "available",
            unit: "USD",
            value: ppePurchases,
            sources: [purchaseSource],
          },
          revenue: {
            status: "available",
            unit: "USD",
            value: revenue,
            sources: revenueSources,
          },
          operatingCashFlowLessPpePurchasesMargin: {
            status: "available",
            unit: "percent",
            value,
            sources: [operatingSource, purchaseSource, ...revenueSources],
          },
        },
      },
    ],
  };
}
function cashIncomeResponse(
  value = "-50.00",
  operatingCashFlow = "-50",
  netIncome = "100",
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const numerator = {
    ...row.metrics.operatingCashFlow.sources[0]!,
    value: operatingCashFlow,
  };
  const denominator = {
    ...row.metrics.netIncome.sources[0]!,
    value: netIncome,
  };
  return {
    ...result,
    rows: [
      {
        ...row,
        metrics: {
          ...row.metrics,
          operatingCashFlow: {
            status: "available",
            unit: "USD",
            value: operatingCashFlow,
            sources: [numerator],
          },
          netIncome: {
            status: "available",
            unit: "USD",
            value: netIncome,
            sources: [denominator],
          },
          operatingCashFlowToNetIncome: {
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
function defaultInstantCells() {
  const operand = (
    concept: PersonalFinancialScreenInstantSourceRefDto["concept"],
    value: string,
  ): PersonalFinancialScreenInstantCellDto => ({
    status: "available",
    unit: "USD",
    value,
    sources: [
      {
        concept,
        accessionNumber: "0000000001-25-000001",
        asOfDate: `${String(new Date().getUTCFullYear() - 1)}-12-27`,
        value,
      },
    ],
  });
  const currentAssets = operand("AssetsCurrent", "100");
  const currentLiabilities = operand("LiabilitiesCurrent", "80");
  const currentRatio: PersonalFinancialScreenInstantCellDto = {
    status: "available",
    unit: "multiple",
    value: "1.25",
    sources: [...currentAssets.sources, ...currentLiabilities.sources],
  };
  const currentAssetsLessCurrentLiabilities: PersonalFinancialScreenInstantCellDto =
    {
      status: "available",
      unit: "USD",
      value: "20",
      sources: [...currentAssets.sources, ...currentLiabilities.sources],
    };
  return {
    currentAssets,
    currentLiabilities,
    currentRatio,
    currentAssetsLessCurrentLiabilities,
    totalAssets: operand("Assets", "1000"),
    totalLiabilities: operand("Liabilities", "600"),
  };
}
function currentBalanceDifferenceResponse(
  assets: string,
  liabilities: string,
  difference: string,
): PersonalFinancialScreenResponseDto {
  const result = response();
  const row = result.rows[0]!;
  const assetSource = {
    ...row.metrics.currentAssets.sources[0]!,
    value: assets,
  };
  const liabilitySource = {
    ...row.metrics.currentLiabilities.sources[0]!,
    value: liabilities,
  };
  const sources = [assetSource, liabilitySource];
  return {
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
          currentAssets: {
            status: "available",
            unit: "USD",
            value: assets,
            sources: [assetSource],
          },
          currentLiabilities: {
            status: "available",
            unit: "USD",
            value: liabilities,
            sources: [liabilitySource],
          },
          currentRatio:
            liabilities === "0"
              ? {
                  status: "unavailable",
                  unit: "multiple",
                  reason: "nonpositive_current_liabilities",
                  sources,
                }
              : {
                  status: "available",
                  unit: "multiple",
                  value: (Number(assets) / Number(liabilities)).toFixed(2),
                  sources,
                },
          currentAssetsLessCurrentLiabilities: {
            status: "available",
            unit: "USD",
            value: difference,
            sources,
          },
        },
      },
    ],
    metricCoverage: {
      ...result.metricCoverage,
      revenue: { known: 0, unknown: 1 },
      currentRatio:
        liabilities === "0"
          ? { known: 0, unknown: 1 }
          : { known: 1, unknown: 0 },
    },
  };
}
function defaultGrowthCell(
  value = "25.00",
  current = "15",
  prior = "12",
): Extract<PersonalFinancialScreenGrowthCellDto, { status: "available" }> {
  const currentYear = new Date().getUTCFullYear() - 1;
  const operand = (amount: string, year: number) => ({
    status: "available" as const,
    unit: "USD" as const,
    value: amount,
    sources: [
      {
        concept: "Revenues" as const,
        accessionNumber:
          year === currentYear
            ? "0000000001-25-000001"
            : "0000000001-24-000002",
        startDate: `${String(year)}-01-01`,
        endDate: `${String(year)}-12-31`,
        value: amount,
      },
    ],
  });
  const currentRevenue = operand(current, currentYear);
  const priorRevenue = operand(prior, currentYear - 1);
  return {
    status: "available",
    unit: "percent",
    value,
    currentRevenue,
    priorRevenue,
    sources: [
      ...currentRevenue.sources.map((source) => ({
        ...source,
        role: "current_revenue" as const,
        calendarYear: currentYear,
      })),
      ...priorRevenue.sources.map((source) => ({
        ...source,
        role: "prior_revenue" as const,
        calendarYear: currentYear - 1,
      })),
    ],
  };
}

function growthResponse(
  cell: PersonalFinancialScreenGrowthCellDto = defaultGrowthCell(),
): PersonalFinancialScreenResponseDto {
  const result = response();
  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      metrics: {
        ...row.metrics,
        revenue: cell.currentRevenue,
        revenueGrowth: cell,
      },
    })),
  };
}

function response(offset = 0, count = 1): PersonalFinancialScreenResponseDto {
  return {
    schemaVersion: "10.0.0",
    catalogSnapshotSha256: sha("a"),
    financialSnapshotSha256: sha("b"),
    calendarYear: new Date().getUTCFullYear() - 1,
    priorCalendarYear: new Date().getUTCFullYear() - 2,
    fetchedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:30:00.000Z",
    formulaVersion: "1.7.0",
    instantQuarter: 4,
    priorRevenueSources: PERSONAL_SEC_REVENUE_CONCEPTS.map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY${String(new Date().getUTCFullYear() - 2)}.json`,
    })),
    sources: [
      ...PERSONAL_SEC_ANNUAL_CONCEPTS,
      ...PERSONAL_SEC_INSTANT_CONCEPTS,
    ].map((concept) => ({
      concept,
      status: "available",
      sourceUrl: `https://data.sec.gov/api/xbrl/frames/us-gaap/${concept}/USD/CY2025${concept === "AssetsCurrent" || concept === "LiabilitiesCurrent" || concept === "Assets" || concept === "Liabilities" ? "Q4I" : ""}.json`,
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
            metric === "revenueGrowth"
              ? defaultGrowthCell()
              : metric === "currentAssets" ||
                  metric === "currentLiabilities" ||
                  metric === "currentRatio" ||
                  metric === "currentAssetsLessCurrentLiabilities" ||
                  metric === "totalAssets" ||
                  metric === "totalLiabilities"
                ? defaultInstantCells()[metric]
                : {
                    status: "available",
                    value:
                      metric === "operatingCashFlow"
                        ? "-123456789.12"
                        : metric === "operatingCashFlowLessPpePurchases"
                          ? "-123456804.12"
                          : metric === "grossMargin"
                            ? "100.00"
                            : metric ===
                                "operatingCashFlowLessPpePurchasesMargin"
                              ? "-823045360.80"
                              : metric === "operatingCashFlowToNetIncome"
                                ? "-823045260.80"
                                : "15",
                    unit:
                      metric.endsWith("Margin") ||
                      metric === "operatingCashFlowToNetIncome"
                        ? "percent"
                        : "USD",
                    sources: (metric ===
                    "operatingCashFlowLessPpePurchasesMargin"
                      ? [
                          "NetCashProvidedByUsedInOperatingActivities",
                          "PaymentsToAcquirePropertyPlantAndEquipment",
                          "Revenues",
                        ]
                      : metric === "operatingCashFlowLessPpePurchases"
                        ? [
                            "NetCashProvidedByUsedInOperatingActivities",
                            "PaymentsToAcquirePropertyPlantAndEquipment",
                          ]
                        : metric === "grossMargin"
                          ? ["GrossProfit", "Revenues"]
                          : metric === "operatingCashFlowToNetIncome"
                            ? [
                                "NetCashProvidedByUsedInOperatingActivities",
                                "NetIncomeLoss",
                              ]
                            : [
                                metric === "grossProfit"
                                  ? "GrossProfit"
                                  : metric === "ppePurchases"
                                    ? "PaymentsToAcquirePropertyPlantAndEquipment"
                                    : metric === "operatingCashFlow"
                                      ? "NetCashProvidedByUsedInOperatingActivities"
                                      : metric === "netIncome"
                                        ? "NetIncomeLoss"
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
