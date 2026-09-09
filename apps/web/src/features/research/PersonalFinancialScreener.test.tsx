import {
  PERSONAL_FINANCIAL_SCREEN_METRICS,
  PERSONAL_SEC_ANNUAL_CONCEPTS,
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

const sha = (letter: string): `sha256:${string}` =>
  `sha256:${letter.repeat(64)}`;
let props: PersonalFinancialScreenerProps;
beforeEach(() => {
  harness.reset();
  Object.values(api).forEach((mock) => mock.mockReset());
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
  it("requires an explicit run, defaults to the last completed year, and explains annual scope", async () => {
    const view = await mount();
    expect(input(view, "Financial calendar year").props.value).toBe(
      new Date().getUTCFullYear() - 1,
    );
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
    expect(text(view)).toContain("All available aliases must agree");
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
  });

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
    props = { ...props, workspaceReady: true };
    render();
    await flush();
    submit(render());
    await flush();
    expect(text(render())).toContain("Open ONE");
    props = { ...props, disabled: true };
    render();
    expect(text(render())).not.toContain("Open ONE");
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
function response(offset = 0, count = 1): PersonalFinancialScreenResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: sha("a"),
    financialSnapshotSha256: sha("b"),
    calendarYear: new Date().getUTCFullYear() - 1,
    fetchedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:30:00.000Z",
    formulaVersion: "1.0.0",
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
              value: metric === "operatingCashFlow" ? "-123456789.12" : "15",
              unit: metric.endsWith("Margin") ? "percent" : "USD",
              sources: [
                {
                  concept: "Revenues",
                  accessionNumber: "0000000001-25-000001",
                  startDate: "2024-01-01",
                  endDate: "2024-12-31",
                  value: "2000000000",
                },
              ],
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
