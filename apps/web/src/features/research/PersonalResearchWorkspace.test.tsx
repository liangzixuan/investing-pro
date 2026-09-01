import type { PersonalFilingDossierDto } from "@research-cockpit/contracts";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
    },
    reset() {
      states.splice(0);
      refs.splice(0);
      stateIndex = 0;
      refIndex = 0;
    },
    useCallback: <T,>(callback: T): T => callback,
    useRef: <T,>(initial: T) => {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index] as { current: T };
    },
    useState: (initial: unknown) => {
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

const apiMocks = vi.hoisted(() => ({
  fetchDossier: vi.fn(),
  fetchPersonalFilingDossier: vi.fn(),
  fetchPersonalFilingReadiness: vi.fn(),
  fetchPersonalFilingSelectedFacts: vi.fn(),
}));
const componentMocks = vi.hoisted(() => ({
  Dossier: () => null,
  OwnerSession: () => null,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useCallback: hookHarness.useCallback,
  useRef: hookHarness.useRef,
  useState: hookHarness.useState,
}));
vi.mock("@/lib/personal-api", () => apiMocks);
vi.mock("./OwnerSessionPanel", () => ({
  OwnerSessionPanel: componentMocks.OwnerSession,
}));
vi.mock("./PersonalDossier", () => ({
  PersonalDossier: componentMocks.Dossier,
}));

import { PersonalResearchWorkspace } from "./PersonalResearchWorkspace";
import { buildPersonalDossierFixture } from "./test-personal-dossier-builder";

beforeEach(() => {
  hookHarness.reset();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
});

describe("PersonalResearchWorkspace", () => {
  it("starts locked and makes no data request before session confirmation", () => {
    hookHarness.beginRender();
    const rendered = PersonalResearchWorkspace();
    const text = textContent(rendered);

    expect(text).toContain("Personal filing mode");
    expect(text).toContain("Private dossier locked");
    expect(apiMocks.fetchPersonalFilingDossier).not.toHaveBeenCalled();
    expectNoSyntheticCalls();
    expect(findOwnerSession(rendered)).toBeDefined();
    expect(findElementByHref(rendered, "/personal")).toBeDefined();
  });

  it("loads exactly one complete personal graph after authentication", async () => {
    const dossier = buildPersonalDossierFixture();
    apiMocks.fetchPersonalFilingDossier.mockResolvedValueOnce(dossier);
    let rendered = renderWorkspace();
    const panel = requireOwnerSession(rendered);

    await expect(
      panel.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(true);
    rendered = renderWorkspace();

    expect(apiMocks.fetchPersonalFilingDossier).toHaveBeenCalledOnce();
    expect(findPersonalDossier(rendered)?.props.dossier).toBe(dossier);
    expect(textContent(rendered)).not.toContain("Private dossier locked");
    expectNoSyntheticCalls();
  });

  it("clears the complete graph synchronously on every inactive-session signal", async () => {
    apiMocks.fetchPersonalFilingDossier.mockResolvedValueOnce(
      buildPersonalDossierFixture("PRIVATE_CLEAR_CANARY"),
    );
    let rendered = renderWorkspace();
    const panel = requireOwnerSession(rendered);
    await panel.props.onSessionChange(true, new AbortController().signal);
    rendered = renderWorkspace();
    expect(findPersonalDossier(rendered)).toBeDefined();

    const clear = panel.props.onSessionChange(
      false,
      new AbortController().signal,
    );
    rendered = renderWorkspace();

    expect(findPersonalDossier(rendered)).toBeUndefined();
    expect(textContent(rendered)).toContain("Private dossier locked");
    await expect(clear).resolves.toBe(false);
    expect(apiMocks.fetchPersonalFilingDossier).toHaveBeenCalledOnce();
  });

  it("cannot restore a stale response after logout, revocation, expiry, hiding, or unmount clear", async () => {
    const pending = deferred<PersonalFilingDossierDto | null>();
    apiMocks.fetchPersonalFilingDossier.mockReturnValueOnce(pending.promise);
    let rendered = renderWorkspace();
    const panel = requireOwnerSession(rendered);
    const staleRead = panel.props.onSessionChange(
      true,
      new AbortController().signal,
    );

    await panel.props.onSessionChange(false, new AbortController().signal);
    pending.resolve(buildPersonalDossierFixture("PRIVATE_STALE_CANARY"));
    await expect(staleRead).resolves.toBe(false);
    rendered = renderWorkspace();

    expect(findPersonalDossier(rendered)).toBeUndefined();
    expect(textContent(rendered)).not.toContain("PRIVATE_STALE_CANARY");
  });

  it("clears the prior graph before a rotation replacement settles", async () => {
    apiMocks.fetchPersonalFilingDossier.mockResolvedValueOnce(
      buildPersonalDossierFixture("1111"),
    );
    let rendered = renderWorkspace();
    const panel = requireOwnerSession(rendered);
    await panel.props.onSessionChange(true, new AbortController().signal);
    expect(findPersonalDossier(renderWorkspace())).toBeDefined();

    const replacement = deferred<PersonalFilingDossierDto | null>();
    apiMocks.fetchPersonalFilingDossier.mockReturnValueOnce(
      replacement.promise,
    );
    const rotating = panel.props.onSessionChange(
      true,
      new AbortController().signal,
    );
    rendered = renderWorkspace();
    expect(findPersonalDossier(rendered)).toBeUndefined();

    const next = buildPersonalDossierFixture("2222");
    replacement.resolve(next);
    await expect(rotating).resolves.toBe(true);
    rendered = renderWorkspace();
    expect(findPersonalDossier(rendered)?.props.dossier).toBe(next);
  });

  it("keeps the workspace locked after a malformed, denied, or failed dossier read", async () => {
    apiMocks.fetchPersonalFilingDossier.mockResolvedValueOnce(null);
    const rendered = renderWorkspace();
    const panel = requireOwnerSession(rendered);

    await expect(
      panel.props.onSessionChange(true, new AbortController().signal),
    ).resolves.toBe(false);

    expect(findPersonalDossier(renderWorkspace())).toBeUndefined();
    expectNoSyntheticCalls();
  });
});

function renderWorkspace(): React.ReactNode {
  hookHarness.beginRender();
  return PersonalResearchWorkspace();
}

function requireOwnerSession(value: unknown): React.ReactElement<{
  onSessionChange: (active: boolean, signal: AbortSignal) => Promise<boolean>;
}> {
  const panel = findOwnerSession(value);
  if (panel === undefined) throw new Error("Expected owner-session panel.");
  return panel;
}

function findOwnerSession(value: unknown) {
  return findElement<{
    onSessionChange: (active: boolean, signal: AbortSignal) => Promise<boolean>;
  }>(value, componentMocks.OwnerSession);
}

function findPersonalDossier(value: unknown) {
  return findElement<{ dossier: PersonalFilingDossierDto }>(
    value,
    componentMocks.Dossier,
  );
}

function findElement<Props>(
  value: unknown,
  type: React.ElementType,
): React.ReactElement<Props> | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findElement<Props>(child, type);
      if (match !== undefined) return match;
    }
    return undefined;
  }
  if (!React.isValidElement(value)) return undefined;
  if (value.type === type) return value as React.ReactElement<Props>;
  return findElement<Props>(
    (value.props as { children?: unknown }).children,
    type,
  );
}

function findElementByHref(
  value: unknown,
  href: string,
): React.ReactElement<{ href: string }> | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findElementByHref(child, href);
      if (match !== undefined) return match;
    }
    return undefined;
  }
  if (!React.isValidElement(value)) return undefined;
  const props = value.props as { children?: unknown; href?: unknown };
  if (props.href === href) {
    return value as React.ReactElement<{ href: string }>;
  }
  return findElementByHref(props.children, href);
}

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textContent).join(" ");
  if (!React.isValidElement(value)) return "";
  return textContent((value.props as { children?: unknown }).children);
}

function expectNoSyntheticCalls() {
  expect(apiMocks.fetchDossier).not.toHaveBeenCalled();
  expect(apiMocks.fetchPersonalFilingReadiness).not.toHaveBeenCalled();
  expect(apiMocks.fetchPersonalFilingSelectedFacts).not.toHaveBeenCalled();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
