import type {
  PersonalSecQuarterlyEvidenceResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalSecQuarterlyEvidence,
  type PersonalSecQuarterlyEvidenceProps,
} from "./PersonalSecQuarterlyEvidence";

const api = vi.hoisted(() => ({ fetchPersonalSecQuarterlyEvidence: vi.fn() }));
vi.mock("../../lib/personal-sec-quarterly-evidence-api", () => api);
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));

let props: PersonalSecQuarterlyEvidenceProps;
beforeEach(() => {
  harness.reset();
  api.fetchPersonalSecQuarterlyEvidence
    .mockReset()
    .mockResolvedValue(response());
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    selection: selection(),
    enabled: true,
    onSessionUnavailable: vi.fn(),
  };
});
afterEach(() => harness.unmount());

describe("PersonalSecQuarterlyEvidence", () => {
  it("waits for an explicit load, binds the exact selection and retains exact dated values", async () => {
    await mount();
    expect(api.fetchPersonalSecQuarterlyEvidence).not.toHaveBeenCalled();
    const view = render();
    click(view, "Load SEC quarterly evidence");
    click(view, "Load SEC quarterly evidence");
    expect(
      api.fetchPersonalSecQuarterlyEvidence,
    ).toHaveBeenCalledExactlyOnceWith(
      {
        schemaVersion: "1.0.0",
        catalogSnapshotSha256: props.catalogSnapshotSha256,
        listingId: "lst-zero",
        symbol: "ZERO",
      },
      expect.any(AbortSignal),
    );
    await flush();
    const loaded = render();
    expect(text(loaded)).toContain("$12,345,678,901,234,567,890.12");
    expect(text(loaded)).toContain(
      "2026-04-01 to 2026-06-30 91 calendar days Period basis unresolved",
    );
    expect(text(loaded)).toContain(
      "Filing focus, not the fact quarter FY 2026 · Q2",
    );
    expect(text(loaded)).toContain("TTM unavailable");
    expect(text(loaded)).toContain("No values are combined into a total");
    const links = elements(loaded).filter((element) => element.type === "a");
    expect(links).toHaveLength(1);
    expect(links[0]?.props).toMatchObject({
      href: observation().filing.sourceUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(
      elements(loaded).some(
        (element) =>
          element.props.role === "region" && element.props.tabIndex === 0,
      ),
    ).toBe(true);
  });

  it.each(["disabled", "no selection"])(
    "does not fetch with %s",
    async (kind) => {
      props = {
        ...props,
        enabled: kind !== "disabled",
        selection: kind === "no selection" ? null : selection(),
      };
      const view = await mount();
      expect(elements(view).some((element) => element.type === "button")).toBe(
        false,
      );
      expect(api.fetchPersonalSecQuarterlyEvidence).not.toHaveBeenCalled();
    },
  );

  it("paginates and filters loaded observations without additional requests", async () => {
    api.fetchPersonalSecQuarterlyEvidence.mockResolvedValue(response(27));
    await mount();
    click(render(), "Load SEC quarterly evidence");
    await flush();
    let view = render();
    expect(text(view)).toContain("1 – 25 of 27 loaded observations");
    click(view, "Next observations");
    view = render();
    expect(text(view)).toContain("26 – 27 of 27 loaded observations");
    change(view, "SEC observation metric", "net_income");
    view = render();
    expect(text(view)).toContain("1 – 1 of 1 loaded observations");
    expect(text(view)).toContain("−$12.5");
    expect(api.fetchPersonalSecQuarterlyEvidence).toHaveBeenCalledOnce();
  });

  it("keeps aliases, revisions, comparative dates and distinct durations inspectable", async () => {
    const base = response(3);
    api.fetchPersonalSecQuarterlyEvidence.mockResolvedValue({
      ...base,
      evidence: {
        ...base.evidence,
        observations: [
          {
            ...observation(0),
            startDate: "2025-04-01",
            endDate: "2025-06-30",
            filingFocusYear: 2026,
            filingFocusPeriod: "Q2",
          },
          {
            ...observation(1),
            startDate: "2026-01-01",
            durationDays: 181,
            concept: "SalesRevenueNet",
          },
          { ...observation(2), startDate: null, durationDays: null },
        ],
      },
    });
    await mount();
    click(render(), "Load SEC quarterly evidence");
    await flush();
    const view = render();
    expect(text(view)).toContain("2025-04-01 to 2025-06-30");
    expect(text(view)).toContain("181 calendar days");
    expect(text(view)).toContain("Start date not supplied");
    expect(text(view)).toContain("Duration unknown");
    expect(text(view)).toContain("SalesRevenueNet");
    expect(
      elements(view).filter(
        (element) =>
          element.type === "summary" && text(element) === "Inspect observation",
      ),
    ).toHaveLength(3);
  });

  it.each([
    "metadata_conflict",
    "not_in_current_submissions",
    "submissions_unavailable",
  ] as const)(
    "preserves observations but withholds filing links for %s",
    async (status) => {
      const base = response();
      api.fetchPersonalSecQuarterlyEvidence.mockResolvedValue({
        ...base,
        evidence: {
          ...base.evidence,
          observations: [
            { ...observation(), filing: { ...observation().filing, status } },
          ],
        },
      });
      await mount();
      click(render(), "Load SEC quarterly evidence");
      await flush();
      const view = render();
      expect(text(view)).toContain("$12,345,678,901,234,567,890.12");
      expect(elements(view).some((element) => element.type === "a")).toBe(
        false,
      );
    },
  );

  it("explains source failures, truncation, excluded rows and older metadata without extra loads", async () => {
    const base = response();
    api.fetchPersonalSecQuarterlyEvidence.mockResolvedValue({
      ...base,
      evidence: {
        ...base.evidence,
        olderHistoryAvailable: true,
        coverage: {
          ...base.evidence.coverage,
          availableObservations: 130,
          truncated: true,
          invalidRows: 3,
          duplicateRows: 2,
          conceptsWithoutUsd: ["SalesRevenueNet"],
        },
        sources: {
          ...base.evidence.sources,
          submissions: {
            ...base.evidence.sources.submissions,
            status: "rate_limited",
          },
        },
      },
    });
    await mount();
    click(render(), "Load SEC quarterly evidence");
    await flush();
    const view = render();
    expect(text(view)).toContain("Rate limited");
    expect(text(view)).toContain("up to 100 observations per metric");
    expect(text(view)).toContain("3 invalid source rows were excluded");
    expect(text(view)).toContain("2 identical source rows were deduplicated");
    expect(text(view)).toContain(
      "No USD observations supplied for: SalesRevenueNet",
    );
    expect(text(view)).toContain("Older filing metadata exists");
    expect(api.fetchPersonalSecQuarterlyEvidence).toHaveBeenCalledOnce();
  });

  it.each([
    "response_too_large",
    "candidate_limit",
    "not_covered",
    "invalid_response",
    "upstream_unavailable",
  ] as const)(
    "renders an empty %s source outcome without assuming zero-valued facts",
    async (status) => {
      const base = response(0);
      api.fetchPersonalSecQuarterlyEvidence.mockResolvedValue({
        ...base,
        evidence: {
          ...base.evidence,
          sources: {
            ...base.evidence.sources,
            companyFacts: { ...base.evidence.sources.companyFacts, status },
          },
        },
      });
      await mount();
      click(render(), "Load SEC quarterly evidence");
      await flush();
      const view = render();
      expect(text(view)).toContain("No dated USD observations are available");
      expect(text(view)).not.toContain("$0");
    },
  );

  it("clears old observations on refresh and ignores a cancelled late response", async () => {
    await mount();
    click(render(), "Load SEC quarterly evidence");
    await flush();
    const pending = deferred<PersonalSecQuarterlyEvidenceResponseDto>();
    api.fetchPersonalSecQuarterlyEvidence.mockReturnValueOnce(pending.promise);
    click(render(), "Refresh SEC quarterly evidence");
    expect(text(render())).not.toContain("$12,345");
    const operationSignal = api.fetchPersonalSecQuarterlyEvidence.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    click(render(), "Cancel SEC evidence load");
    expect(operationSignal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).toContain("SEC evidence load cancelled");
    expect(text(render())).not.toContain("$12,345");
  });

  it.each([
    "listing",
    "issuer metadata",
    "catalog",
    "session",
    "closed selection",
    "unmount",
  ])("clears and aborts old data after %s changes", async (kind) => {
    await mount();
    click(render(), "Load SEC quarterly evidence");
    await flush();
    const pending = deferred<PersonalSecQuarterlyEvidenceResponseDto>();
    api.fetchPersonalSecQuarterlyEvidence.mockReturnValueOnce(pending.promise);
    click(render(), "Refresh SEC quarterly evidence");
    const operationSignal = api.fetchPersonalSecQuarterlyEvidence.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    if (kind === "unmount") harness.unmount();
    else {
      if (kind === "listing")
        props = {
          ...props,
          selection: { ...selection(), listingId: "lst-other" },
        };
      if (kind === "issuer metadata")
        props = {
          ...props,
          selection: { ...selection(), issuerName: "Different company" },
        };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (kind === "session") props = { ...props, enabled: false };
      if (kind === "closed selection") props = { ...props, selection: null };
      expect(text(render(false))).not.toContain("$12,345");
      harness.effects();
    }
    expect(operationSignal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    if (kind !== "unmount") expect(text(render())).not.toContain("$12,345");
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });

  it("rejects a retained load callback after the selection context changes", async () => {
    const oldView = await mount();
    props = { ...props, selection: { ...selection(), listingId: "lst-other" } };
    render(false);
    click(oldView, "Load SEC quarterly evidence");
    expect(api.fetchPersonalSecQuarterlyEvidence).not.toHaveBeenCalled();
  });

  it("ignores an obsolete session error after a new context is selected", async () => {
    const pending = deferred<PersonalSecQuarterlyEvidenceResponseDto>();
    api.fetchPersonalSecQuarterlyEvidence.mockReturnValueOnce(pending.promise);
    await mount();
    click(render(), "Load SEC quarterly evidence");
    props = { ...props, selection: { ...selection(), listingId: "lst-other" } };
    render();
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });

  it("clears observations and notifies the current callback when the session expires", async () => {
    await mount();
    click(render(), "Load SEC quarterly evidence");
    await flush();
    const pending = deferred<PersonalSecQuarterlyEvidenceResponseDto>();
    api.fetchPersonalSecQuarterlyEvidence.mockReturnValueOnce(pending.promise);
    click(render(), "Refresh SEC quarterly evidence");
    const latest = vi.fn();
    props = { ...props, onSessionUnavailable: latest };
    render();
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(latest).toHaveBeenCalledOnce();
    expect(text(render())).not.toContain("$12,345");
    expect(text(render())).toContain("owner session expired");
  });

  it.each([
    ["not_configured", "SEC contact setup is required"],
    ["conflict", "The catalog changed"],
    ["not_covered", "No supported SEC issuer binding"],
    ["rate_limited", "SEC requests are rate limited"],
    ["provider_unavailable", "SEC evidence could not be loaded"],
  ] as const)(
    "shows actionable %s errors without treating them as session loss",
    async (code, expected) => {
      api.fetchPersonalSecQuarterlyEvidence.mockRejectedValueOnce(
        new PersonalWorkspaceApiError(code),
      );
      await mount();
      click(render(), "Load SEC quarterly evidence");
      await flush();
      expect(text(render())).toContain(expected);
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
    },
  );

  it.each([
    "issuerId",
    "issuerName",
    "securityName",
    "exchangeMic",
    "listingId",
    "symbol",
    "country",
  ] as const)(
    "rejects returned %s that differs from the full selected identity",
    async (field) => {
      const base = response();
      api.fetchPersonalSecQuarterlyEvidence.mockResolvedValue({
        ...base,
        security: { ...base.security, [field]: "different" },
      });
      await mount();
      click(render(), "Load SEC quarterly evidence");
      await flush();
      expect(text(render())).toContain(
        "could not be validated for this company",
      );
      expect(text(render())).not.toContain("$12,345");
    },
  );
});

function selection(): NonNullable<
  PersonalSecQuarterlyEvidenceProps["selection"]
> {
  return {
    country: "US",
    exchangeMic: "XNAS",
    issuerId: "issuer-zero",
    issuerName: "Zero Alpha, Inc.",
    listingId: "lst-zero",
    securityName: "Zero Alpha Common Stock",
    symbol: "ZERO",
  };
}
function response(count = 1): PersonalSecQuarterlyEvidenceResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    security: { ...selection(), cik: "0000000001" },
    evidence: {
      cik: "0000000001",
      fetchedAt: "2026-09-10T10:00:00.000Z",
      sources: {
        companyFacts: {
          status: "available",
          sourceUrl:
            "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
        },
        submissions: {
          status: "available",
          sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        },
      },
      olderHistoryAvailable: false,
      coverage: {
        inspectedRows: count,
        invalidRows: 0,
        duplicateRows: 0,
        availableObservations: count,
        returnedObservations: count,
        truncated: false,
        conceptsWithoutUsd: [],
      },
      observations: Array.from({ length: count }, (_, index) => ({
        ...observation(index),
        ...(count > 1 && index === count - 1
          ? ({
              metric: "net_income",
              concept: "NetIncomeLoss",
              value: "-12.5",
            } as const)
          : {}),
      })),
      ttm: {
        status: "unavailable",
        reason: "period_and_revision_not_admitted",
      },
    },
  };
}
function observation(index = 0): PersonalSecQuarterlyObservationDto {
  const accessionNumber = `0000000001-26-${String(index + 1).padStart(6, "0")}`;
  return {
    id: `sec-fact:${String(index + 1).padStart(64, "0")}`,
    metric: "revenue",
    taxonomy: "us-gaap",
    concept: "Revenues",
    unit: "USD",
    value: "12345678901234567890.12",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    durationDays: 91,
    periodBasis: "unresolved",
    filingFocusYear: 2026,
    filingFocusPeriod: "Q2",
    frame: "CY2026Q2",
    accessionNumber,
    form: "10-Q",
    filedDate: "2026-08-01",
    sourceLocator: `/facts/us-gaap/Revenues/units/USD/${index}`,
    filing: {
      status: "matched",
      form: "10-Q",
      filedDate: "2026-08-01",
      reportDate: "2026-06-30",
      acceptedAt: "2026-08-01T20:00:00Z",
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${accessionNumber}-index.htm`,
    },
  };
}

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
function render(runEffects = true) {
  harness.begin();
  const view = PersonalSecQuarterlyEvidence(props);
  if (runEffects) harness.effects();
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
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
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
function change(value: unknown, label: string, next: string) {
  const input = elements(value).find(
    (element) => element.props["aria-label"] === label,
  ) as
    | React.ReactElement<{
        onChange: (event: { target: { value: string } }) => void;
      }>
    | undefined;
  if (!input) throw new Error(`Missing input: ${label}`);
  input.props.onChange({ target: { value: next } });
}
