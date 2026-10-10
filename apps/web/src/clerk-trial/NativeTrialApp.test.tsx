import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClerkTrialConfig } from "./config";
import type {
  InvestmentAuthPlugin,
  NativeAuthState,
  NativeTrialSessionStore,
} from "./native-session";
import type { TrialSession } from "./session";
import type { AndroidBackAdapter } from "../mobile/android-back";

// Controlled hook calls inspect composition and cleanup; the real session store runs below.
const hooks = vi.hoisted(() => ({
  state: null as NativeTrialSessionStore | null,
  effects: [] as Array<() => (() => void) | void>,
  register: vi.fn(),
  androidBack: { addListener: vi.fn(), exitApp: vi.fn() },
}));
vi.mock("react", async (original) => ({
  ...(await original()),
  useState: () => [
    hooks.state,
    (value: NativeTrialSessionStore) => {
      hooks.state = value;
    },
  ],
  useEffect: (effect: () => (() => void) | void) => {
    hooks.effects.push(effect);
  },
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) =>
    getSnapshot(),
}));
vi.mock("@capacitor/core", () => ({ registerPlugin: hooks.register }));
vi.mock("@capacitor/app", () => ({ App: hooks.androidBack }));
vi.mock("./ManagedWorkspaceScreen", () => ({
  ManagedSessionScreen: () => <p>Managed workspace fixture</p>,
}));
vi.mock("./TrialScreen", () => ({
  TrialSessionScreen: () => <p>Development trial fixture</p>,
}));
vi.mock("./ThirdPartyNotices", () => ({ ThirdPartyNotices: () => null }));

import { NativeTrialApp } from "./NativeTrialApp";
import { ManagedSessionScreen } from "./ManagedWorkspaceScreen";
import { TrialSessionScreen } from "./TrialScreen";

const production: ClerkTrialConfig = {
  environment: "production",
  publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
  apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
  frontendApiOrigin: "https://clerk.investingpro.app",
};
const development: ClerkTrialConfig = {
  environment: "development",
  publishableKey: `pk_test_${Buffer.from("invented-trial-12.clerk.accounts.dev$").toString("base64")}`,
  apiOrigin: "https://investment-clerk-api-6abac57a.appwrite.network",
  frontendApiOrigin: "https://invented-trial-12.clerk.accounts.dev",
};
const signedIn: NativeAuthState = {
  status: "signedIn",
  generation: 1,
  userId: "synthetic-user",
  sessionId: "synthetic-session",
};
let cleanup: (() => void) | void;
beforeEach(() => {
  hooks.state = null;
  hooks.effects = [];
  hooks.register.mockReset();
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function mount(config: ClerkTrialConfig, state = signedIn) {
  let emit!: (state: NativeAuthState) => void;
  const remove = vi.fn<() => Promise<void>>().mockResolvedValue();
  const plugin: InvestmentAuthPlugin = {
    addListener: vi
      .fn<InvestmentAuthPlugin["addListener"]>()
      .mockImplementation((_name, listener) => {
        emit = listener;
        return Promise.resolve({ remove });
      }),
    getState: vi
      .fn<InvestmentAuthPlugin["getState"]>()
      .mockResolvedValue(state),
    getToken: vi.fn<InvestmentAuthPlugin["getToken"]>().mockResolvedValue({
      token: "synthetic-token",
      generation: 1,
      sessionId: "synthetic-session",
    }),
    signIn: vi.fn<InvestmentAuthPlugin["signIn"]>().mockResolvedValue(signedIn),
    signOut: vi
      .fn<InvestmentAuthPlugin["signOut"]>()
      .mockRejectedValue(new Error("synthetic unavailable")),
  };
  hooks.register.mockReturnValue(plugin);
  const loading = NativeTrialApp({ config });
  expect(renderToStaticMarkup(loading)).toContain(
    "Checking the installed session",
  );
  cleanup = hooks.effects[0]!();
  await Promise.resolve();
  await Promise.resolve();
  function frame() {
    const element = NativeTrialApp({ config });
    const component = element.type as (
      props: unknown,
    ) => ReactElement<{ children: ReactNode }>;
    return component(element.props);
  }
  return {
    frame,
    plugin,
    remove,
    emit: (value: NativeAuthState) => emit(value),
  };
}

function findScreen(node: ReactNode):
  | ReactElement<{
      session: TrialSession;
      apiOrigin: string;
      androidBack?: AndroidBackAdapter;
      warnOnBrowserLeave?: boolean;
    }>
  | undefined {
  const children: ReactNode[] = [];
  Children.forEach(node, (child) => {
    children.push(child);
  });
  for (const child of children) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (
      child.type === ManagedSessionScreen ||
      child.type === TrialSessionScreen
    ) {
      return child as ReactElement<{
        session: TrialSession;
        apiOrigin: string;
        androidBack?: AndroidBackAdapter;
        warnOnBrowserLeave?: boolean;
      }>;
    }
    const found = findScreen(child.props.children);
    if (found) return found;
  }
}

describe("native shared workspace composition", () => {
  it.each([
    [production, ManagedSessionScreen],
    [development, TrialSessionScreen],
  ] as const)(
    "selects the existing screen and owns one listener %#",
    async (config, screenType) => {
      const { frame, plugin, remove } = await mount(config);
      const screen = findScreen(frame());
      expect(screen?.type).toBe(screenType);
      expect(screen?.key).toBe("1");
      expect(screen?.props.apiOrigin).toBe(config.apiOrigin);
      expect(screen?.props.session.userId).toBe(signedIn.userId);
      expect(screen?.props.warnOnBrowserLeave).toBeUndefined();
      expect(screen?.props.androidBack).toBe(
        config.environment === "production" ? hooks.androidBack : undefined,
      );
      expect(hooks.register).toHaveBeenCalledExactlyOnceWith("InvestmentAuth");
      expect(plugin.addListener).toHaveBeenCalledTimes(1);
      expect(plugin.getState).toHaveBeenCalledTimes(1);
      const html = renderToStaticMarkup(frame());
      expect(html.includes("Synthetic data only.")).toBe(
        config.environment === "development",
      );
      cleanup?.();
      cleanup = undefined;
      expect(remove).toHaveBeenCalledTimes(1);
      await expect(screen!.props.session.getToken()).rejects.toMatchObject({
        code: "unauthenticated",
      });
      expect(plugin.getToken).not.toHaveBeenCalled();
    },
  );

  it("changes the workspace key on a new generation even for the same identity", async () => {
    const { frame, emit } = await mount(production);
    const previous = findScreen(frame())!;
    emit({ ...signedIn, generation: 2 });
    const current = findScreen(frame())!;
    expect(current.key).toBe("2");
    expect(current.props.session.userId).toBe(previous.props.session.userId);
    expect(current.props.session.sessionId).toBe(
      previous.props.session.sessionId,
    );
    await expect(previous.props.session.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("removes the managed workspace synchronously during uncertain sign-out", async () => {
    const { frame } = await mount(production);
    const previous = findScreen(frame())!;
    const pending = previous.props.session.signOut();
    expect(findScreen(frame())).toBeUndefined();
    await expect(pending).rejects.toMatchObject({ code: "unauthenticated" });
    const html = renderToStaticMarkup(frame());
    expect(html).toContain("Sign in again");
    expect(html).not.toContain("Managed workspace fixture");
    expect(html).not.toContain("join the trial");
  });

  it("uses production sign-in copy without trial data claims", async () => {
    const { frame } = await mount(production, {
      status: "signedOut",
      userId: null,
      sessionId: null,
      generation: 1,
    });
    const html = renderToStaticMarkup(frame());
    expect(html).toContain("Sign in to open your shared watchlist.");
    expect(html).toContain("Discover companies");
    expect(html).not.toContain("Synthetic data only.");
    expect(findScreen(frame())).toBeUndefined();
  });
});
