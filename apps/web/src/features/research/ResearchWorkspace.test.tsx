import {
  buildDossier,
  DEFAULT_KNOWN_AT,
} from "@research-cockpit/research-core";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effects: Array<() => (() => void) | void> = [];

  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
      effects = [];
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      stateIndex = 0;
      refIndex = 0;
      effects = [];
    },
    runEffects() {
      return effects.map((effect) => effect()).filter(isCleanup);
    },
    useCallback: <T,>(callback: T): T => callback,
    useEffect: (effect: () => (() => void) | void) => {
      effects.push(effect);
    },
    useRef: <T,>(initial: T) => {
      const index = refIndex;
      refIndex += 1;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState: (initial: unknown) => {
      const index = stateIndex;
      stateIndex += 1;
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

const apiMocks = vi.hoisted(() => ({
  fetchDossier: vi.fn(),
  fetchPersonalFilingReadiness: vi.fn(),
  fetchPersonalFilingSelectedFacts: vi.fn(),
}));

const ownerSessionMock = vi.hoisted(() => ({
  Component: () => null,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: hookHarness.useCallback,
  useEffect: hookHarness.useEffect,
  useRef: hookHarness.useRef,
  useState: hookHarness.useState,
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("./OwnerSessionPanel", () => ({
  OwnerSessionPanel: ownerSessionMock.Component,
}));
vi.mock("./AnalyticalChart", () => ({ AnalyticalChart: () => null }));
vi.mock("./EvidenceDialog", () => ({ EvidenceDialog: () => null }));
vi.mock("./MetricGrid", () => ({ MetricGrid: () => null }));
vi.mock("./ThesisMonitor", () => ({ ThesisMonitor: () => null }));
vi.mock("./ValuationWorkbench", () => ({ ValuationWorkbench: () => null }));

import { ResearchWorkspace } from "./ResearchWorkspace";

beforeEach(() => {
  hookHarness.reset();
  apiMocks.fetchDossier.mockReset();
  apiMocks.fetchPersonalFilingReadiness.mockReset();
  apiMocks.fetchPersonalFilingSelectedFacts.mockReset();
  apiMocks.fetchPersonalFilingReadiness.mockResolvedValue(false);
  apiMocks.fetchPersonalFilingSelectedFacts.mockResolvedValue(null);
});

describe("ResearchWorkspace personal readiness", () => {
  it("keeps synthetic default rendering free of personal session work", async () => {
    const rendered = await renderLoadedWorkspace();
    const text = textContent(rendered);

    expect(text).toContain("Synthetic demo");
    expect(text).toContain("Northwind Robotics");
    expect(text).not.toContain("Personal quality ready · data off");
    expect(apiMocks.fetchPersonalFilingReadiness).not.toHaveBeenCalled();
    expect(apiMocks.fetchPersonalFilingSelectedFacts).not.toHaveBeenCalled();
    expect(findOwnerSessionPanel(rendered)).toBeUndefined();
  });

  it("renders the personal chip only for a true readiness result", async () => {
    apiMocks.fetchPersonalFilingReadiness.mockResolvedValueOnce(false);
    const unavailableRender = await renderLoadedWorkspace({
      personalMode: true,
      sessionActive: true,
    });
    const unavailable = textContent(unavailableRender);

    expect(unavailable).toContain("Synthetic demo");
    expect(unavailable).not.toContain("Personal quality ready · data off");
    expect(findOwnerSessionPanel(unavailableRender)).toBeDefined();

    hookHarness.reset();
    apiMocks.fetchPersonalFilingReadiness.mockResolvedValueOnce(true);
    const ready = textContent(
      await renderLoadedWorkspace({ personalMode: true, sessionActive: true }),
    );

    expect(ready).toContain("Synthetic demo");
    expect(ready).toContain("Personal quality ready · data off");
  });

  it("keeps private facts unavailable when their request fails", async () => {
    apiMocks.fetchPersonalFilingSelectedFacts.mockRejectedValueOnce(
      new Error("selected facts unavailable"),
    );

    const text = textContent(
      await renderLoadedWorkspace({ personalMode: true, sessionActive: true }),
    );

    expect(text).toContain("Synthetic demo");
    expect(text).toContain("Northwind Robotics");
    expect(text).not.toContain("Personal facts · read only");
  });

  it("shows a distinct read-only mode only after exact facts are returned", async () => {
    apiMocks.fetchPersonalFilingReadiness.mockResolvedValueOnce(true);
    apiMocks.fetchPersonalFilingSelectedFacts.mockResolvedValueOnce({
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "selected_facts_released",
      facts: [
        {
          key: "revenue",
          value: "123",
          unit: "USD",
          periodStart: "2024-01-01",
          periodEnd: "2024-12-31",
        },
      ],
    });

    const text = textContent(
      await renderLoadedWorkspace({ personalMode: true, sessionActive: true }),
    );

    expect(text).toContain("Synthetic demo");
    expect(text).toContain("Personal facts · read only");
    expect(text).toContain("Fictional dossier below.");
    expect(text).not.toContain("Personal quality ready · data off");
  });

  it("clears personal projections as soon as the session becomes inactive", async () => {
    apiMocks.fetchPersonalFilingReadiness.mockResolvedValueOnce(true);
    apiMocks.fetchPersonalFilingSelectedFacts.mockResolvedValueOnce({
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "selected_facts_released",
      facts: [
        {
          key: "revenue",
          value: "123",
          unit: "USD",
          periodStart: "2024-01-01",
          periodEnd: "2024-12-31",
        },
      ],
    });
    let rendered = await renderLoadedWorkspace({
      personalMode: true,
      sessionActive: true,
    });
    expect(textContent(rendered)).toContain("Personal facts · read only");

    const panel = findOwnerSessionPanel(rendered);
    if (panel === undefined) throw new Error("Expected owner session panel.");
    await panel.props.onSessionChange(false, new AbortController().signal);
    hookHarness.beginRender();
    rendered = ResearchWorkspace({
      symbol: "SYN1",
      initialKnownAt: DEFAULT_KNOWN_AT,
      personalMode: true,
    });

    expect(textContent(rendered)).not.toContain("Personal facts · read only");
    expect(textContent(rendered)).not.toContain(
      "Personal quality ready · data off",
    );
  });

  it("does not restore a stale private response after the session is cleared", async () => {
    const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
    if (dossier === null) throw new Error("Expected the synthetic dossier.");
    apiMocks.fetchDossier.mockResolvedValueOnce(dossier);
    const readiness = deferred<boolean>();
    const facts = deferred<{
      schemaVersion: "1.0.0";
      profile: "personal_single_user_local";
      status: "selected_facts_released";
      facts: [];
    }>();
    apiMocks.fetchPersonalFilingReadiness.mockReturnValueOnce(
      readiness.promise,
    );
    apiMocks.fetchPersonalFilingSelectedFacts.mockReturnValueOnce(
      facts.promise,
    );

    hookHarness.beginRender();
    ResearchWorkspace({
      symbol: "SYN1",
      initialKnownAt: DEFAULT_KNOWN_AT,
      personalMode: true,
    });
    hookHarness.runEffects();
    await Promise.resolve();
    hookHarness.beginRender();
    let rendered = ResearchWorkspace({
      symbol: "SYN1",
      initialKnownAt: DEFAULT_KNOWN_AT,
      personalMode: true,
    });
    const panel = findOwnerSessionPanel(rendered);
    if (panel === undefined) throw new Error("Expected owner session panel.");
    const staleRequest = panel.props.onSessionChange(
      true,
      new AbortController().signal,
    );
    await panel.props.onSessionChange(false, new AbortController().signal);
    readiness.resolve(true);
    facts.resolve({
      schemaVersion: "1.0.0",
      profile: "personal_single_user_local",
      status: "selected_facts_released",
      facts: [],
    });
    await staleRequest;

    hookHarness.beginRender();
    rendered = ResearchWorkspace({
      symbol: "SYN1",
      initialKnownAt: DEFAULT_KNOWN_AT,
      personalMode: true,
    });
    expect(textContent(rendered)).not.toContain("Personal facts · read only");
    expect(textContent(rendered)).not.toContain(
      "Personal quality ready · data off",
    );
  });
});

async function renderLoadedWorkspace(
  options: { personalMode?: boolean; sessionActive?: boolean } = {},
): Promise<React.ReactNode> {
  const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
  if (dossier === null) throw new Error("Expected the synthetic dossier.");
  apiMocks.fetchDossier.mockResolvedValueOnce(dossier);

  hookHarness.beginRender();
  ResearchWorkspace({
    symbol: "SYN1",
    initialKnownAt: DEFAULT_KNOWN_AT,
    personalMode: options.personalMode ?? false,
  });
  const cleanups = hookHarness.runEffects();
  await Promise.resolve();
  await Promise.resolve();

  hookHarness.beginRender();
  let rendered = ResearchWorkspace({
    symbol: "SYN1",
    initialKnownAt: DEFAULT_KNOWN_AT,
    personalMode: options.personalMode ?? false,
  });
  if (options.personalMode && options.sessionActive !== undefined) {
    const panel = findOwnerSessionPanel(rendered);
    if (panel === undefined) throw new Error("Expected owner session panel.");
    await panel.props.onSessionChange(
      options.sessionActive,
      new AbortController().signal,
    );
    await Promise.resolve();
    hookHarness.beginRender();
    rendered = ResearchWorkspace({
      symbol: "SYN1",
      initialKnownAt: DEFAULT_KNOWN_AT,
      personalMode: true,
    });
  }
  for (const cleanup of cleanups) cleanup();
  return rendered;
}

function findOwnerSessionPanel(value: unknown):
  | React.ReactElement<{
      onSessionChange: (active: boolean, signal: AbortSignal) => Promise<void>;
    }>
  | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findOwnerSessionPanel(child);
      if (match !== undefined) return match;
    }
    return undefined;
  }
  if (!React.isValidElement(value)) return undefined;
  if (value.type === ownerSessionMock.Component) {
    return value as React.ReactElement<{
      onSessionChange: (active: boolean, signal: AbortSignal) => Promise<void>;
    }>;
  }
  return findOwnerSessionPanel(
    (value.props as { children?: unknown }).children,
  );
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  return textContent((value.props as { children?: unknown }).children);
}

function isCleanup(value: (() => void) | void): value is () => void {
  return typeof value === "function";
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
