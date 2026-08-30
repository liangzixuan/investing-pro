import {
  buildDossier,
  DEFAULT_KNOWN_AT,
} from "@research-cockpit/research-core";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  let stateIndex = 0;
  let effects: Array<() => (() => void) | void> = [];

  return {
    beginRender() {
      stateIndex = 0;
      effects = [];
    },
    reset() {
      states.splice(0);
      stateIndex = 0;
      effects = [];
    },
    runEffects() {
      return effects.map((effect) => effect()).filter(isCleanup);
    },
    useCallback: <T,>(callback: T): T => callback,
    useEffect: (effect: () => (() => void) | void) => {
      effects.push(effect);
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
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: hookHarness.useCallback,
  useEffect: hookHarness.useEffect,
  useState: hookHarness.useState,
}));

vi.mock("@/lib/api", () => apiMocks);
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
});

describe("ResearchWorkspace personal readiness", () => {
  it("keeps the synthetic dossier available when readiness fails", async () => {
    apiMocks.fetchPersonalFilingReadiness.mockRejectedValue(
      new Error("readiness unavailable"),
    );

    const rendered = await renderLoadedWorkspace();
    const text = textContent(rendered);

    expect(text).toContain("Synthetic demo");
    expect(text).toContain("Northwind Robotics");
    expect(text).not.toContain("Personal quality ready · data off");
  });

  it("renders the personal chip only for a true readiness result", async () => {
    apiMocks.fetchPersonalFilingReadiness.mockResolvedValueOnce(false);
    const unavailable = textContent(await renderLoadedWorkspace());

    expect(unavailable).toContain("Synthetic demo");
    expect(unavailable).not.toContain("Personal quality ready · data off");

    hookHarness.reset();
    apiMocks.fetchPersonalFilingReadiness.mockResolvedValueOnce(true);
    const ready = textContent(await renderLoadedWorkspace());

    expect(ready).toContain("Synthetic demo");
    expect(ready).toContain("Personal quality ready · data off");
  });
});

async function renderLoadedWorkspace(): Promise<React.ReactNode> {
  const dossier = buildDossier("SYN1", DEFAULT_KNOWN_AT);
  if (dossier === null) throw new Error("Expected the synthetic dossier.");
  apiMocks.fetchDossier.mockResolvedValueOnce(dossier);

  hookHarness.beginRender();
  ResearchWorkspace({ symbol: "SYN1", initialKnownAt: DEFAULT_KNOWN_AT });
  const cleanups = hookHarness.runEffects();
  await Promise.resolve();
  await Promise.resolve();

  hookHarness.beginRender();
  const rendered = ResearchWorkspace({
    symbol: "SYN1",
    initialKnownAt: DEFAULT_KNOWN_AT,
  });
  for (const cleanup of cleanups) cleanup();
  return rendered;
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
