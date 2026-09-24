import type { PersonalSecQuarterAssessmentResponseDto } from "@research-cockpit/contracts";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import {
  PersonalSecQuarterAssessment,
  type PersonalSecQuarterAssessmentProps,
} from "./PersonalSecQuarterAssessment";

const api = vi.hoisted(() => ({ fetchPersonalSecQuarterAssessment: vi.fn() }));
vi.mock("../../lib/personal-sec-quarter-assessment-api", () => api);
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: (initial: unknown) => harness.useState(initial),
  useRef: <T,>(initial: T) => harness.useRef(initial),
  useEffect: (
    effect: () => (() => void) | void,
    deps: readonly unknown[] | undefined,
  ) => harness.useEffect(effect, deps),
}));
let props: PersonalSecQuarterAssessmentProps;
beforeEach(() => {
  harness.reset();
  props = {
    catalogSnapshotSha256: `sha256:${"a".repeat(64)}`,
    selection: {
      country: "US",
      exchangeMic: "XNAS",
      issuerId: "issuer-zero",
      issuerName: "Zero Alpha",
      listingId: "lst-zero",
      securityName: "Zero Alpha Common",
      symbol: "ZERO",
    },
    filing: {
      accessionNumber: "0000000001-26-000001",
      form: "10-Q",
      filedDate: "2026-05-01",
      reportDate: "2026-03-31",
    },
    responseGeneration: 1,
    requestToken: 1,
    enabled: true,
    onClose: vi.fn(),
    onSessionUnavailable: vi.fn(),
  };
  api.fetchPersonalSecQuarterAssessment
    .mockReset()
    .mockResolvedValue(response());
});
afterEach(() => harness.unmount());

describe("quarter assessment interaction", () => {
  it.each([
    ["supported", "$100,000,000", "−$20,000,000"],
    ["zero", "$0", "−$20,000,000"],
    [
      "large",
      "$123,456,789,012,345,678,901,234,567,890,000,000",
      "−$20,000,000",
    ],
  ])(
    "renders exact %s amounts from a complete source assessment",
    async (kind, revenue, income) => {
      useCompleteFixture(kind);
      render();
      await flush();
      const visible = text(render());
      expect(visible).toContain("Both values supported as filed");
      expect(visible).toContain(revenue);
      expect(visible).toContain(income);
      expect(visible).toContain("2025-01-01 to 2025-03-31");
    },
  );
  it("shows supported revenue and an unavailable income without replacing the held value with zero", async () => {
    useCompleteFixture("partial");
    render();
    await flush();
    const visible = text(render());
    expect(visible).toContain("$100,000,000");
    expect(visible).toContain("Quarter evidence remains unresolved");
    expect(visible).toContain("Unavailable");
    expect(visible).not.toContain("−$20,000,000");
    expect(visible).not.toContain("$0");
    expect(visible).toContain("TTM remains unavailable");
  });
  it("dispatches one deliberate selection under StrictMode and sends no amount", async () => {
    render();
    harness.strictReplay();
    await flush();
    expect(api.fetchPersonalSecQuarterAssessment).toHaveBeenCalledOnce();
    expect(api.fetchPersonalSecQuarterAssessment.mock.calls[0]?.[0]).toEqual({
      schemaVersion: "1.0.0",
      catalogSnapshotSha256: props.catalogSnapshotSha256,
      listingId: "lst-zero",
      symbol: "ZERO",
      selection: props.filing,
    });
    expect(text(render())).toContain("The SEC source is unavailable");
    expect(text(render())).toContain("TTM remains unavailable");
  });

  it("does not dispatch when disabled", async () => {
    props = { ...props, enabled: false };
    render();
    await flush();
    expect(api.fetchPersonalSecQuarterAssessment).not.toHaveBeenCalled();
  });

  it.each(["company", "filing", "catalog", "generation", "enabled"] as const)(
    "retires a pending result when %s changes",
    async (change) => {
      const pending = deferred<PersonalSecQuarterAssessmentResponseDto>();
      api.fetchPersonalSecQuarterAssessment.mockReturnValue(pending.promise);
      const originalResponse = response();
      render();
      await flush();
      const original = render();
      const signal = api.fetchPersonalSecQuarterAssessment.mock
        .calls[0]?.[1] as AbortSignal;
      if (change === "company")
        props = {
          ...props,
          selection: { ...props.selection, issuerName: "Another issuer" },
        };
      if (change === "filing")
        props = {
          ...props,
          filing: { ...props.filing, reportDate: "2026-06-30" },
        };
      if (change === "catalog")
        props = { ...props, catalogSnapshotSha256: `sha256:${"b".repeat(64)}` };
      if (change === "generation") props = { ...props, responseGeneration: 2 };
      if (change === "enabled") props = { ...props, enabled: false };
      render(false);
      click(original, "Close assessment");
      expect(props.onClose).not.toHaveBeenCalled();
      pending.resolve(originalResponse);
      await flush();
      expect(text(render(false))).not.toContain(
        "The SEC source is unavailable",
      );
      harness.effects();
      await flush();
      expect(signal.aborted).toBe(true);
      expect(api.fetchPersonalSecQuarterAssessment).toHaveBeenCalledOnce();
    },
  );

  it("cancels and ignores a late success, then accepts an explicit retry", async () => {
    const pending = deferred<PersonalSecQuarterAssessmentResponseDto>();
    api.fetchPersonalSecQuarterAssessment.mockReturnValueOnce(pending.promise);
    render();
    await flush();
    const signal = api.fetchPersonalSecQuarterAssessment.mock
      .calls[0]?.[1] as AbortSignal;
    click(render(), "Cancel assessment");
    expect(signal.aborted).toBe(true);
    pending.resolve(response());
    await flush();
    expect(text(render())).toContain("Assessment cancelled");
    expect(text(render())).not.toContain("The SEC source is unavailable");
    click(render(), "Retry assessment");
    await flush();
    expect(api.fetchPersonalSecQuarterAssessment).toHaveBeenCalledTimes(2);
    expect(text(render())).toContain("The SEC source is unavailable");
  });

  it("withholds mismatched company fields even if the listing and symbol agree", async () => {
    api.fetchPersonalSecQuarterAssessment.mockResolvedValue({
      ...response(),
      security: { ...response().security, issuerName: "Another issuer" },
    });
    render();
    await flush();
    expect(text(render())).toContain(
      "could not be validated for this company and filing",
    );
    expect(text(render())).not.toContain("The SEC source is unavailable");
  });

  it("reports session loss once and rejects retry from the retired control", async () => {
    api.fetchPersonalSecQuarterAssessment.mockRejectedValue(
      new PersonalWorkspaceApiError("session_unavailable"),
    );
    render();
    await flush();
    expect(props.onSessionUnavailable).toHaveBeenCalledOnce();
    click(render(), "Retry assessment");
    await flush();
    expect(api.fetchPersonalSecQuarterAssessment).toHaveBeenCalledOnce();
  });

  it("aborts on unmount and does not report a late session failure", async () => {
    const pending = deferred<PersonalSecQuarterAssessmentResponseDto>();
    api.fetchPersonalSecQuarterAssessment.mockReturnValue(pending.promise);
    render();
    await flush();
    const signal = api.fetchPersonalSecQuarterAssessment.mock
      .calls[0]?.[1] as AbortSignal;
    harness.unmount();
    pending.reject(new PersonalWorkspaceApiError("session_unavailable"));
    await flush();
    expect(signal.aborted).toBe(true);
    expect(props.onSessionUnavailable).not.toHaveBeenCalled();
  });
});

function useCompleteFixture(kind: string): void {
  const complete = JSON.parse(
    readFileSync(
      new URL(
        `../../../../../fixtures/synthetic/sec-quarter-assessment/${kind}-response.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as PersonalSecQuarterAssessmentResponseDto;
  const {
    country,
    exchangeMic,
    issuerId,
    issuerName,
    listingId,
    securityName,
    symbol,
  } = complete.security;
  const selection = {
    country,
    exchangeMic,
    issuerId,
    issuerName,
    listingId,
    securityName,
    symbol,
  };
  props = {
    ...props,
    selection,
    catalogSnapshotSha256: complete.catalogSnapshotSha256,
    filing: complete.assessment.selection,
  };
  api.fetchPersonalSecQuarterAssessment.mockResolvedValue(complete);
}

function response(): PersonalSecQuarterAssessmentResponseDto {
  return {
    schemaVersion: "1.0.0",
    catalogSnapshotSha256: props.catalogSnapshotSha256,
    security: { ...props.selection, cik: "0000000001" },
    assessment: {
      status: "unavailable",
      cik: "0000000001",
      selection: props.filing,
      stage: "submissions",
      reason: "upstream_unavailable",
      sources: [],
    },
  };
}

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
  const view = PersonalSecQuarterAssessment(props);
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
import { readFileSync } from "node:fs";
