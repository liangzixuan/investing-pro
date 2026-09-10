import type {
  PersonalSecFilingContextCandidateDto,
  PersonalSecFilingContextResponseDto,
  PersonalSecQuarterlyObservationDto,
} from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalSecFilingContext,
  type PersonalSecFilingContextProps,
} from "./PersonalSecFilingContext";

const api = vi.hoisted(() => ({ fetchPersonalSecFilingContext: vi.fn() }));
vi.mock("../../lib/personal-sec-filing-context-api", async (original) => ({
  ...(await original()),
  ...api,
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
let props: PersonalSecFilingContextProps;
beforeEach(() => {
  harness.reset();
  api.fetchPersonalSecFilingContext.mockReset().mockResolvedValue(response());
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
    },
    observation: observation(),
    responseGeneration: 1,
    requestToken: 1,
    enabled: true,
    onSessionUnavailable: vi.fn(),
    onClose: vi.fn(),
  };
});
afterEach(() => harness.unmount());

describe("PersonalSecFilingContext", () => {
  it("dispatches the deliberate inspection once after StrictMode replay and retains exact provenance", async () => {
    render();
    expect(api.fetchPersonalSecFilingContext).not.toHaveBeenCalled();
    harness.strictReplay();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    const view = render();
    expect(text(view)).toContain("Exact value correspondence found");
    expect(text(view)).toContain("12345678901234567890.12");
    expect(text(view)).toContain("Revalidated source observation");
    expect(text(view)).toContain("2026-04-01 to 2026-06-30");
    expect(text(view)).toContain("http://www.sec.gov/CIK");
    expect(text(view)).toContain("/elements/1");
    expect(text(view)).toContain("Raw numeric text");
    expect(text(view)).toContain("TTM remains unavailable");
    expect(text(view)).toContain("does not establish standalone-quarter");
    expect(
      elements(view).some(
        (element) => element.props.dangerouslySetInnerHTML !== undefined,
      ),
    ).toBe(false);
    expect(
      elements(view).find((element) => element.type === "a")?.props,
    ).toMatchObject({
      href: "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/filing.htm",
      target: "_blank",
      rel: "noopener noreferrer",
    });
    render();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it("focuses the inspector heading and cancels before invoking close", async () => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValue(pending.promise);
    const view = render(false);
    const focus = vi.fn();
    const title = elements(view).find((element) => element.type === "h3");
    expect(title?.props.tabIndex).toBe(-1);
    (title?.props.ref as { current: unknown }).current = { focus };
    harness.effects();
    await flush();
    expect(focus).toHaveBeenCalledOnce();
    const signal = api.fetchPersonalSecFilingContext.mock
      .calls[0]?.[1] as AbortSignal;
    click(render(), "Close filing inspection");
    expect(signal.aborted).toBe(true);
    expect(props.onClose).toHaveBeenCalledOnce();
    pending.resolve(response());
    await flush();
    expect(text(render())).not.toContain("Exact value correspondence found");
  });
  it.each(["disabled", "unmatched", "unknown start", "annual form"])(
    "does not acquire an ineligible %s selection",
    async (kind) => {
      if (kind === "disabled") props = { ...props, enabled: false };
      if (kind === "unmatched")
        props = {
          ...props,
          observation: {
            ...observation(),
            filing: { ...observation().filing, status: "metadata_conflict" },
          },
        };
      if (kind === "unknown start")
        props = {
          ...props,
          observation: { ...observation(), startDate: null },
        };
      if (kind === "annual form")
        props = { ...props, observation: { ...observation(), form: "10-K" } };
      render();
      await flush();
      expect(api.fetchPersonalSecFilingContext).not.toHaveBeenCalled();
    },
  );
  it("paginates candidates without requests and keeps selected source fields visible", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      ...candidate(),
      locator: `/elements/${index + 1}`,
    }));
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      inspection: {
        ...base.inspection,
        analysis: {
          ...base.inspection.analysis,
          candidates,
          correspondingCandidateLocators: candidates.map((row) => row.locator),
        },
      },
    });
    render();
    await flush();
    expect(text(render())).toContain("1 – 10 of 12 filing candidates");
    click(render(), "Next filing candidates");
    expect(text(render())).toContain("11 – 12 of 12 filing candidates");
    expect(text(render())).toContain(
      "Selected exact value (USD) 12345678901234567890.12",
    );
    expect(button(render(), "Next filing candidates").props.disabled).toBe(
      true,
    );
    click(render(), "Previous filing candidates");
    expect(text(render())).toContain("1 – 10 of 12 filing candidates");
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
  });
  it.each([
    ["value_differs", "Corresponding filing value differs"],
    ["ambiguous", "Conflicting corresponding values"],
    ["no_corresponding_fact", "No corresponding fact found"],
    ["unsupported", "Correspondence could not be established"],
  ] as const)(
    "explains %s without promoting a usable value",
    async (status, expected) => {
      const base = response();
      if (base.inspection.status !== "available") throw new Error();
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...base,
        inspection: {
          ...base.inspection,
          analysis: {
            status,
            reason: status === "unsupported" ? "unsupported_dimensions" : null,
            candidates: [
              {
                ...candidate(),
                value: "-12.5",
                dimensions: [
                  {
                    kind: "typed",
                    dimension: {
                      raw: "custom:Scope",
                      namespace: "https://example.invalid",
                      localName: "Scope",
                    },
                    member: null,
                    typedText: "<script>never execute</script>",
                  },
                ],
                issues: ["unsupported_dimensions"],
              },
            ],
            correspondingCandidateLocators: [],
          },
        },
      });
      render();
      await flush();
      const view = render();
      expect(text(view)).toContain(expected);
      expect(text(view)).toContain("-12.5");
      expect(text(view)).toContain("unsupported dimensions");
      expect(text(view)).toContain("<script>never execute</script>");
      expect(elements(view).some((element) => element.type === "script")).toBe(
        false,
      );
      if (status === "unsupported")
        expect(text(view)).toContain(
          "a clean candidate cannot establish a match",
        );
    },
  );
  it("shows a global limit without candidate values or zero-valued inference", async () => {
    const base = response();
    if (base.inspection.status !== "available") throw new Error();
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      inspection: {
        ...base.inspection,
        analysis: {
          status: "unsupported",
          reason: "candidate_limit",
          candidates: [],
          correspondingCandidateLocators: [],
        },
      },
    });
    render();
    await flush();
    expect(text(render())).toContain(
      "No partial-prefix candidates are presented",
    );
    expect(text(render())).toContain("Absence is not a zero-valued fact");
    expect(elements(render()).some((element) => element.type === "table")).toBe(
      false,
    );
  });
  it.each([
    "selection_changed_or_not_retained",
    "submission_metadata_conflict",
    "runtime_unavailable",
    "parser_timeout",
  ] as const)(
    "explains source outcome %s and retains requested observation",
    async (reason) => {
      api.fetchPersonalSecFilingContext.mockResolvedValue({
        ...response(),
        inspection: {
          status: "unavailable",
          cik: "0000000001",
          stage: "parser",
          reason,
        },
      });
      render();
      await flush();
      expect(text(render())).toContain("Inspection unavailable");
      expect(text(render())).toContain("Requested source observation");
      expect(text(render())).toContain("12345678901234567890.12");
      expect(text(render())).not.toContain("Revalidated source observation");
    },
  );
  it("clears on refresh, cancels and rejects a late response without automatic retry", async () => {
    render();
    await flush();
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValueOnce(pending.promise);
    click(render(), "Refresh filing inspection");
    expect(text(render())).not.toContain("Exact value correspondence found");
    const signal = api.fetchPersonalSecFilingContext.mock.calls.at(
      -1,
    )?.[1] as AbortSignal;
    click(render(), "Cancel filing inspection");
    expect(signal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).toContain("Filing inspection cancelled");
    expect(text(render())).not.toContain("Exact value correspondence found");
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(2);
  });
  it.each([
    "observation",
    "company",
    "catalog",
    "response generation",
    "session",
    "unmount",
  ])("invalidates pending inspection after %s changes", async (kind) => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValue(pending.promise);
    render();
    await flush();
    const oldView = render();
    const signal = api.fetchPersonalSecFilingContext.mock
      .calls[0]?.[1] as AbortSignal;
    if (kind === "unmount") harness.unmount();
    else {
      if (kind === "observation")
        props = { ...props, observation: { ...observation(), value: "50" } };
      if (kind === "company")
        props = {
          ...props,
          selection: { ...props.selection, listingId: "lst-other" },
        };
      if (kind === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (kind === "response generation")
        props = { ...props, responseGeneration: 2 };
      if (kind === "session") props = { ...props, enabled: false };
      expect(text(render(false))).not.toContain(
        "Revalidated source observation",
      );
      harness.effects();
    }
    click(oldView, "Refresh filing inspection");
    expect(signal.aborted).toBe(true);
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });
  it("accepts a new deliberate request token after a source generation changes", async () => {
    render();
    await flush();
    props = { ...props, responseGeneration: 2 };
    render();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledOnce();
    props = { ...props, requestToken: 2 };
    render();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("Exact value correspondence found");
  });
  it("rejects an old result immediately when a newer deliberate token renders", async () => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValueOnce(pending.promise);
    render();
    await flush();
    props = { ...props, requestToken: 2 };
    render(false);
    pending.resolve(response());
    await flush();
    expect(text(render(false))).not.toContain(
      "Exact value correspondence found",
    );
    harness.effects();
    await flush();
    expect(api.fetchPersonalSecFilingContext).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("Exact value correspondence found");
  });
  it("clears and notifies the latest callback after actual session expiry", async () => {
    const pending = deferred<PersonalSecFilingContextResponseDto>();
    api.fetchPersonalSecFilingContext.mockReturnValue(pending.promise);
    render();
    await flush();
    const latest = vi.fn();
    props = { ...props, onSessionUnavailable: latest };
    render();
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(latest).toHaveBeenCalledOnce();
    expect(text(render())).toContain("owner session expired");
    expect(text(render())).not.toContain("Revalidated source observation");
    expect(text(render())).not.toContain("12345678901234567890.12");
    expect(button(render(), "Refresh filing inspection").props.disabled).toBe(
      true,
    );
  });
  it.each([
    ["not_configured", "SEC contact setup"],
    ["conflict", "selected source observation changed"],
    ["invalid_response", "could not be validated"],
    ["rate_limited", "rate limited"],
  ] as const)(
    "preserves observations on %s inspection failure",
    async (code, expected) => {
      api.fetchPersonalSecFilingContext.mockRejectedValue(
        new PersonalWorkspaceApiError(code),
      );
      render();
      await flush();
      expect(text(render())).toContain(expected);
      expect(props.onSessionUnavailable).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    },
  );
  it("rejects a response with different selected issuer metadata", async () => {
    const base = response();
    api.fetchPersonalSecFilingContext.mockResolvedValue({
      ...base,
      security: { ...base.security, issuerId: "issuer-other" },
    });
    render();
    await flush();
    expect(text(render())).toContain("could not be validated");
    expect(text(render())).not.toContain("Exact value correspondence found");
  });
});
const harness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanup = new Map<number, () => void>();
  const setups = new Map<number, () => (() => void) | void>();
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
      setups.clear();
      pending = [];
    },
    strictReplay() {
      cleanup.forEach((fn) => fn());
      cleanup.clear();
      setups.forEach((setup, index) => {
        const next = setup();
        if (next) cleanup.set(index, next);
      });
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
      setups.clear();
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
      setups.set(index, effect);
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
  const view = PersonalSecFilingContext(props);
  if (runEffects) harness.effects();
  return view;
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

function observation(): PersonalSecQuarterlyObservationDto {
  return {
    id: `sec-fact:${"1".repeat(64)}`,
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
    accessionNumber: "0000000001-26-000001",
    form: "10-Q",
    filedDate: "2026-08-01",
    sourceLocator: "/facts/us-gaap/Revenues/units/USD/0",
    filing: {
      status: "matched",
      form: "10-Q",
      filedDate: "2026-08-01",
      reportDate: "2026-06-30",
      acceptedAt: "2026-08-01T20:00:00Z",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    },
  };
}
function candidate(): PersonalSecFilingContextCandidateDto {
  return {
    locator: "/elements/1",
    factId: "revenue",
    contextId: "duration",
    unitId: "USD",
    concept: {
      raw: "us-gaap:Revenues",
      namespace: "http://fasb.org/us-gaap/2026",
      localName: "Revenues",
    },
    entityIdentifier: "0000000001",
    entityScheme: "http://www.sec.gov/CIK",
    entityCik: "0000000001",
    dimensions: [],
    periodKind: "duration",
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    unit: "USD",
    unitMeasures: [
      {
        raw: "iso4217:USD",
        namespace: "http://www.xbrl.org/2003/iso4217",
        localName: "USD",
      },
    ],
    rawText: "12345678901234567890.12",
    format: null,
    sign: null,
    scale: null,
    decimals: "2",
    precision: null,
    value: "12345678901234567890.12",
    issues: [],
  };
}
function response(): PersonalSecFilingContextResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    security: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha, Inc.",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common Stock",
      symbol: "ZERO",
      cik: "0000000001",
    },
    inspection: {
      status: "available",
      cik: "0000000001",
      observation: observation(),
      companyFacts: {
        sourceUrl:
          "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
        fetchedAt: "2026-09-10T10:00:00.000Z",
      },
      submissions: {
        sourceUrl: "https://data.sec.gov/submissions/CIK0000000001.json",
        fetchedAt: "2026-09-10T10:00:00.000Z",
      },
      document: {
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1/000000000126000001/filing.htm",
        fetchedAt: "2026-09-10T10:00:00.000Z",
        sha256: `sha256:${"d".repeat(64)}`,
        bytes: 1000,
      },
      analysis: {
        status: "matched",
        reason: null,
        candidates: [candidate()],
        correspondingCandidateLocators: ["/elements/1"],
      },
    },
  };
}
