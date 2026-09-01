import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => {
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let stateIndex = 0;
  let refIndex = 0;
  let effects: Array<() => (() => void) | void> = [];
  let cleanups: Array<() => void> = [];

  return {
    beginRender() {
      stateIndex = 0;
      refIndex = 0;
      effects = [];
    },
    reset() {
      for (const cleanup of cleanups.splice(0)) cleanup();
      states.splice(0);
      refs.splice(0);
      stateIndex = 0;
      refIndex = 0;
      effects = [];
    },
    cleanupEffects() {
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
    runEffects() {
      const created = effects.map((effect) => effect()).filter(isCleanup);
      cleanups = [...cleanups, ...created];
      return created;
    },
    stateAt(index: number) {
      return states[index];
    },
    useEffect: (effect: () => (() => void) | void) => {
      effects.push(effect);
    },
    useRef: (initial: unknown) => {
      const index = refIndex;
      refIndex += 1;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
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
  bootstrapOwnerSession: vi.fn(),
  fetchOwnerSession: vi.fn(),
  logoutOwnerSession: vi.fn(),
  revokeOwnerSession: vi.fn(),
  rotateOwnerSession: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  useEffect: hookHarness.useEffect,
  useRef: hookHarness.useRef,
  useState: hookHarness.useState,
}));

vi.mock("@/lib/api", () => apiMocks);

import {
  OWNER_SESSION_BROADCAST_CHANNEL,
  OWNER_SESSION_INVALIDATE_MESSAGE,
  OWNER_SESSION_REFRESH_MESSAGE,
  OwnerSessionPanel,
  type OwnerSessionPanelProps,
} from "./OwnerSessionPanel";

class TestBroadcastChannel {
  static instances: TestBroadcastChannel[] = [];
  static failConstruction = false;

  failPost = false;
  readonly messages: unknown[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly name: string;

  constructor(name: string) {
    if (TestBroadcastChannel.failConstruction) {
      throw new Error("BroadcastChannel construction failed.");
    }
    this.name = name;
    TestBroadcastChannel.instances.push(this);
  }

  close() {
    // No resources are retained by the deterministic test double.
  }

  emit(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent<unknown>);
  }

  postMessage(message: unknown) {
    if (this.failPost) throw new Error("BroadcastChannel publish failed.");
    this.messages.push(message);
  }
}

function installBrowserHarness(
  options: {
    failConstruction?: boolean;
    initialVisibility?: "hidden" | "visible";
  } = {},
) {
  const windowListeners = new Map<string, Set<() => void>>();
  const documentListeners = new Map<string, Set<() => void>>();
  TestBroadcastChannel.instances = [];
  TestBroadcastChannel.failConstruction = options.failConstruction ?? false;
  const browserWindow = {
    BroadcastChannel: TestBroadcastChannel,
    addEventListener(type: string, listener: () => void) {
      const current = windowListeners.get(type) ?? new Set<() => void>();
      current.add(listener);
      windowListeners.set(type, current);
    },
    removeEventListener(type: string, listener: () => void) {
      windowListeners.get(type)?.delete(listener);
    },
  };
  const browserDocument = {
    visibilityState: options.initialVisibility ?? "visible",
    addEventListener(type: string, listener: () => void) {
      const current = documentListeners.get(type) ?? new Set<() => void>();
      current.add(listener);
      documentListeners.set(type, current);
    },
    removeEventListener(type: string, listener: () => void) {
      documentListeners.get(type)?.delete(listener);
    },
  };
  vi.stubGlobal("window", browserWindow);
  vi.stubGlobal("document", browserDocument);

  return {
    channel() {
      const channel = TestBroadcastChannel.instances[0];
      if (channel === undefined) {
        throw new Error("Owner-session channel was not created.");
      }
      expect(channel.name).toBe(OWNER_SESSION_BROADCAST_CHANNEL);
      return channel;
    },
    dispatch(type: "focus" | "pagehide" | "pageshow") {
      for (const listener of windowListeners.get(type) ?? []) listener();
    },
    setVisibility(state: "hidden" | "visible") {
      browserDocument.visibilityState = state;
      for (const listener of documentListeners.get("visibilitychange") ?? []) {
        listener();
      }
    },
  };
}

beforeEach(() => {
  hookHarness.reset();
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  apiMocks.fetchOwnerSession.mockResolvedValue(false);
  apiMocks.bootstrapOwnerSession.mockResolvedValue(false);
  apiMocks.logoutOwnerSession.mockResolvedValue(false);
  apiMocks.revokeOwnerSession.mockResolvedValue(false);
  apiMocks.rotateOwnerSession.mockResolvedValue(false);
});

afterEach(() => {
  hookHarness.reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("OwnerSessionPanel", () => {
  it("checks the existing credentialed session and exposes all active controls", async () => {
    installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);

    const rendered = await renderAfterSessionCheck(onSessionChange);
    const text = textContent(rendered);

    expect(apiMocks.fetchOwnerSession).toHaveBeenCalledOnce();
    expect(onSessionChange).toHaveBeenCalledWith(true, expect.any(AbortSignal));
    expect(text).toContain("Owner session");
    expect(text).toContain("Active");
    expect(text).toContain("Rotate session");
    expect(text).toContain("Log out");
    expect(text).toContain("Revoke authority");
    expect(findAll(rendered, "input")).toHaveLength(0);
  });

  it("revalidates after an effect cleanup and visible remount", async () => {
    installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValue(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();

    hookHarness.cleanupEffects();
    hookHarness.runEffects();
    await flushPromises();

    expect(apiMocks.fetchOwnerSession).toHaveBeenCalledTimes(2);
    expect(onSessionChange).toHaveBeenLastCalledWith(
      true,
      expect.any(AbortSignal),
    );
    expect(textContent(rerender(onSessionChange))).toContain("Active");
  });

  it.each([
    ["unavailable", false],
    ["construction failure", true],
  ] as const)(
    "fails closed before revalidation when BroadcastChannel is %s",
    async (_label, failConstruction) => {
      if (failConstruction) installBrowserHarness({ failConstruction: true });
      const onSessionChange = vi
        .fn<OwnerSessionPanelProps["onSessionChange"]>()
        .mockResolvedValue(false);

      const rendered = await renderAfterSessionCheck(onSessionChange);

      expect(apiMocks.fetchOwnerSession).not.toHaveBeenCalled();
      expect(onSessionChange).toHaveBeenCalledWith(
        false,
        expect.any(AbortSignal),
      );
      expect(textContent(rendered)).toContain("Unavailable");
      expect(textContent(rendered)).toContain(
        "Personal access requires working cross-tab session coordination",
      );
      expect(findAll(rendered, "input")).toHaveLength(0);
    },
  );

  it("holds the bootstrap only in password state and clears it before awaiting", async () => {
    const browser = installBrowserHarness();
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    let stateWhenRequested: unknown;
    apiMocks.bootstrapOwnerSession.mockImplementationOnce(() => {
      stateWhenRequested = hookHarness.stateAt(1);
      return Promise.resolve(true);
    });
    let rendered: React.ReactElement =
      await renderAfterSessionCheck(onSessionChange);
    browser.channel().messages.splice(0);
    const input = requiredElement(rendered, "input");
    const inputProps = input.props as {
      autoComplete: string;
      onChange: (event: { target: { value: string } }) => void;
      spellCheck: boolean;
      type: string;
    };
    const bootstrapSecret = "a".repeat(64);

    expect(inputProps).toMatchObject({
      autoComplete: "off",
      spellCheck: false,
      type: "password",
    });
    inputProps.onChange({ target: { value: bootstrapSecret } });
    rendered = rerender(onSessionChange);
    const form = requiredElement(rendered, "form");
    const formProps = form.props as {
      onSubmit: (event: { preventDefault: () => void }) => void;
    };
    const preventDefault = vi.fn();
    formProps.onSubmit({ preventDefault });
    await flushPromises();

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(apiMocks.bootstrapOwnerSession).toHaveBeenCalledWith(
      bootstrapSecret,
      expect.any(AbortSignal),
    );
    expect(stateWhenRequested).toBe("");
    expect(onSessionChange).toHaveBeenLastCalledWith(
      true,
      expect.any(AbortSignal),
    );
    expect(browser.channel().messages).toEqual([OWNER_SESSION_REFRESH_MESSAGE]);
    rendered = rerender(onSessionChange);
    expect(textContent(rendered)).toContain("Local owner session established.");
    expect(textContent(rendered)).not.toContain(bootstrapSecret);
  });

  it.each([
    ["Rotate session", "rotateOwnerSession", true],
    ["Log out", "logoutOwnerSession", false],
    ["Revoke authority", "revokeOwnerSession", false],
  ] as const)(
    "%s invokes its body-free client and refreshes or clears private state",
    async (label, mockName, expectedActive) => {
      const browser = installBrowserHarness();
      apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
      apiMocks[mockName].mockResolvedValueOnce(true);
      const onSessionChange = vi
        .fn<OwnerSessionPanelProps["onSessionChange"]>()
        .mockResolvedValue(true);
      const rendered = await renderAfterSessionCheck(onSessionChange);
      onSessionChange.mockClear();

      const buttonProps = requiredButton(rendered, label).props as {
        onClick: () => void;
      };
      buttonProps.onClick();
      await flushPromises();

      expect(apiMocks[mockName]).toHaveBeenCalledWith(expect.any(AbortSignal));
      expect(onSessionChange).toHaveBeenCalledWith(
        expectedActive,
        expect.any(AbortSignal),
      );
      expect(browser.channel().messages).toEqual([
        expectedActive
          ? OWNER_SESSION_REFRESH_MESSAGE
          : OWNER_SESSION_INVALIDATE_MESSAGE,
      ]);
    },
  );

  it.each([
    ["Log out", "logoutOwnerSession"],
    ["Revoke authority", "revokeOwnerSession"],
  ] as const)(
    "%s clears sibling tabs even when the server does not confirm it",
    async (label, mockName) => {
      const browser = installBrowserHarness();
      apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
      apiMocks[mockName].mockResolvedValueOnce(false);
      const onSessionChange = vi
        .fn<OwnerSessionPanelProps["onSessionChange"]>()
        .mockResolvedValue(true);
      const rendered = await renderAfterSessionCheck(onSessionChange);
      onSessionChange.mockClear();

      const buttonProps = requiredButton(rendered, label).props as {
        onClick: () => void;
      };
      buttonProps.onClick();

      expect(onSessionChange).toHaveBeenCalledWith(
        false,
        expect.any(AbortSignal),
      );
      expect(browser.channel().messages).toEqual([
        OWNER_SESSION_INVALIDATE_MESSAGE,
      ]);
      await flushPromises();
      expect(textContent(rerender(onSessionChange))).toContain("Locked");
    },
  );

  it("clears immediately for cross-tab invalidation", async () => {
    const browser = installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();

    browser.channel().emit(OWNER_SESSION_INVALIDATE_MESSAGE);

    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(textContent(rerender(onSessionChange))).toContain("Locked");
    expect(browser.channel().messages).toEqual([]);
  });

  it("clears and revalidates after a cross-tab session replacement", async () => {
    const browser = installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();
    const revalidation = deferred<boolean>();
    apiMocks.fetchOwnerSession.mockReturnValueOnce(revalidation.promise);

    browser.channel().emit(OWNER_SESSION_REFRESH_MESSAGE);

    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(apiMocks.fetchOwnerSession).toHaveBeenCalledTimes(2);
    revalidation.resolve(true);
    await flushPromises();
    expect(onSessionChange).toHaveBeenLastCalledWith(
      true,
      expect.any(AbortSignal),
    );
  });

  it.each(["focus", "pageshow"] as const)(
    "clears before %s revalidation and broadcasts a failed check",
    async (eventType) => {
      const browser = installBrowserHarness();
      apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
      const onSessionChange = vi
        .fn<OwnerSessionPanelProps["onSessionChange"]>()
        .mockResolvedValue(true);
      await renderAfterSessionCheck(onSessionChange);
      onSessionChange.mockClear();
      const revalidation = deferred<boolean>();
      apiMocks.fetchOwnerSession.mockReturnValueOnce(revalidation.promise);

      browser.dispatch(eventType);

      expect(onSessionChange).toHaveBeenCalledWith(
        false,
        expect.any(AbortSignal),
      );
      expect(apiMocks.fetchOwnerSession).toHaveBeenCalledTimes(2);
      expect(browser.channel().messages).toEqual([]);
      revalidation.resolve(false);
      await flushPromises();
      expect(browser.channel().messages).toEqual([
        OWNER_SESSION_INVALIDATE_MESSAGE,
      ]);
      expect(textContent(rerender(onSessionChange))).toContain("Locked");
    },
  );

  it("clears on focus during a delayed rotation and revalidates only after it settles", async () => {
    const browser = installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    const rendered = await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();
    browser.channel().messages.splice(0);
    const rotation = deferred<boolean>();
    const revalidation = deferred<boolean>();
    apiMocks.rotateOwnerSession.mockReturnValueOnce(rotation.promise);
    apiMocks.fetchOwnerSession.mockReturnValueOnce(revalidation.promise);

    const buttonProps = requiredButton(rendered, "Rotate session").props as {
      onClick: () => void;
    };
    buttonProps.onClick();
    browser.dispatch("focus");

    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);
    expect(apiMocks.fetchOwnerSession).toHaveBeenCalledOnce();

    rotation.resolve(true);
    await flushPromises();

    expect(browser.channel().messages).toEqual([OWNER_SESSION_REFRESH_MESSAGE]);
    expect(apiMocks.fetchOwnerSession).toHaveBeenCalledTimes(2);
    expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);

    revalidation.resolve(true);
    await flushPromises();

    expect(onSessionChange).toHaveBeenLastCalledWith(
      true,
      expect.any(AbortSignal),
    );
    expect(textContent(rerender(onSessionChange))).toContain("Active");
  });

  it.each(["pagehide", "visibilitychange"] as const)(
    "clears immediately on %s and restores only after successful revalidation",
    async (hideEvent) => {
      const browser = installBrowserHarness();
      apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
      const onSessionChange = vi
        .fn<OwnerSessionPanelProps["onSessionChange"]>()
        .mockResolvedValue(true);
      await renderAfterSessionCheck(onSessionChange);
      onSessionChange.mockClear();
      browser.channel().messages.splice(0);
      const revalidation = deferred<boolean>();
      apiMocks.fetchOwnerSession.mockReturnValueOnce(revalidation.promise);

      if (hideEvent === "pagehide") browser.dispatch("pagehide");
      else browser.setVisibility("hidden");

      expect(onSessionChange).toHaveBeenCalledWith(
        false,
        expect.any(AbortSignal),
      );
      expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);
      expect(textContent(rerender(onSessionChange))).toContain("Locked");
      expect(browser.channel().messages).toEqual([]);

      browser.channel().emit(OWNER_SESSION_REFRESH_MESSAGE);
      await flushPromises();
      expect(apiMocks.fetchOwnerSession).toHaveBeenCalledOnce();
      expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);

      if (hideEvent === "pagehide") browser.dispatch("pageshow");
      else browser.setVisibility("visible");

      expect(apiMocks.fetchOwnerSession).toHaveBeenCalledTimes(2);
      expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);
      expect(browser.channel().messages).toEqual([]);

      revalidation.resolve(true);
      await flushPromises();
      expect(onSessionChange).toHaveBeenLastCalledWith(
        true,
        expect.any(AbortSignal),
      );
      expect(textContent(rerender(onSessionChange))).toContain("Active");
    },
  );

  it("does not revalidate or render private state while initially hidden", async () => {
    const browser = installBrowserHarness({ initialVisibility: "hidden" });
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    const revalidation = deferred<boolean>();
    apiMocks.fetchOwnerSession.mockReturnValueOnce(revalidation.promise);

    const hidden = await renderAfterSessionCheck(onSessionChange);

    expect(apiMocks.fetchOwnerSession).not.toHaveBeenCalled();
    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);
    expect(textContent(hidden)).toContain("Locked");

    browser.dispatch("pageshow");
    await flushPromises();
    expect(apiMocks.fetchOwnerSession).not.toHaveBeenCalled();
    expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);

    browser.setVisibility("visible");
    expect(apiMocks.fetchOwnerSession).toHaveBeenCalledOnce();
    expect(onSessionChange.mock.calls.some(([active]) => active)).toBe(false);

    revalidation.resolve(true);
    await flushPromises();
    expect(onSessionChange).toHaveBeenLastCalledWith(
      true,
      expect.any(AbortSignal),
    );
  });

  it("clears and broadcasts when the conservative observed lease expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    const browser = installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();

    vi.advanceTimersByTime(10 * 60 * 1_000);

    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(browser.channel().messages).toEqual([
      OWNER_SESSION_INVALIDATE_MESSAGE,
    ]);
    expect(textContent(rerender(onSessionChange))).toContain("Locked");
  });

  it("clears rendered private data when the session panel unmounts", async () => {
    installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();

    hookHarness.cleanupEffects();

    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
  });

  it("locks the initiating tab when a refresh broadcast cannot be published", async () => {
    const browser = installBrowserHarness();
    apiMocks.fetchOwnerSession.mockResolvedValueOnce(true);
    apiMocks.rotateOwnerSession.mockResolvedValueOnce(true);
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    const rendered = await renderAfterSessionCheck(onSessionChange);
    onSessionChange.mockClear();
    browser.channel().failPost = true;

    const buttonProps = requiredButton(rendered, "Rotate session").props as {
      onClick: () => void;
    };
    buttonProps.onClick();
    await flushPromises();

    expect(apiMocks.rotateOwnerSession).toHaveBeenCalledOnce();
    expect(apiMocks.revokeOwnerSession).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
    expect(onSessionChange).toHaveBeenLastCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(onSessionChange.mock.calls.map(([active]) => active)).toEqual([
      false,
    ]);
    const afterFailure = rerender(onSessionChange);
    expect(textContent(afterFailure)).toContain("Unavailable");
    expect(textContent(afterFailure)).toContain(
      "Cross-tab session coordination failed",
    );
    expect(findAll(afterFailure, "input")).toHaveLength(0);
  });

  it("anchors a fresh absolute deadline before a delayed bootstrap response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
    const browser = installBrowserHarness();
    const onSessionChange = vi
      .fn<OwnerSessionPanelProps["onSessionChange"]>()
      .mockResolvedValue(true);
    let rendered = await renderAfterSessionCheck(onSessionChange);
    browser.channel().messages.splice(0);
    const bootstrapResponse = deferred<boolean>();
    apiMocks.bootstrapOwnerSession.mockReturnValueOnce(
      bootstrapResponse.promise,
    );
    apiMocks.fetchOwnerSession.mockResolvedValue(true);

    const inputProps = requiredElement(rendered, "input").props as {
      onChange: (event: { target: { value: string } }) => void;
    };
    inputProps.onChange({ target: { value: "a".repeat(64) } });
    rendered = rerender(onSessionChange);
    const formProps = requiredElement(rendered, "form").props as {
      onSubmit: (event: { preventDefault: () => void }) => void;
    };
    formProps.onSubmit({ preventDefault: vi.fn() });

    vi.advanceTimersByTime(5 * 60 * 1_000);
    bootstrapResponse.resolve(true);
    await flushPromises();

    for (let index = 0; index < 6; index += 1) {
      vi.advanceTimersByTime(9 * 60 * 1_000);
      browser.dispatch("focus");
      await flushPromises();
    }
    browser.dispatch("pagehide");
    browser.dispatch("pageshow");
    await flushPromises();
    onSessionChange.mockClear();
    vi.advanceTimersByTime(60 * 1_000);

    expect(onSessionChange).toHaveBeenCalledWith(
      false,
      expect.any(AbortSignal),
    );
    expect(browser.channel().messages).toContain(
      OWNER_SESSION_INVALIDATE_MESSAGE,
    );
    expect(textContent(rerender(onSessionChange))).toContain("Locked");
  });
});

async function renderAfterSessionCheck(
  onSessionChange: OwnerSessionPanelProps["onSessionChange"],
): Promise<React.ReactElement> {
  hookHarness.beginRender();
  OwnerSessionPanel({ onSessionChange });
  hookHarness.runEffects();
  await flushPromises();
  return rerender(onSessionChange);
}

function rerender(
  onSessionChange: OwnerSessionPanelProps["onSessionChange"],
): React.ReactElement {
  hookHarness.beginRender();
  return OwnerSessionPanel({ onSessionChange });
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function requiredButton(value: unknown, label: string): React.ReactElement {
  const button = findAll(value, "button").find(
    (candidate) => textContent(candidate) === label,
  );
  if (button === undefined) throw new Error(`Missing ${label} button.`);
  return button;
}

function requiredElement(value: unknown, type: string): React.ReactElement {
  const element = findAll(value, type)[0];
  if (element === undefined) throw new Error(`Missing ${type} element.`);
  return element;
}

function findAll(value: unknown, type: string): React.ReactElement[] {
  if (Array.isArray(value)) {
    return value.flatMap((child) => findAll(child, type));
  }
  if (!React.isValidElement(value)) return [];
  const current =
    typeof value.type === "string" && value.type === type ? [value] : [];
  return [
    ...current,
    ...findAll((value.props as { children?: unknown }).children, type),
  ];
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
