import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import type { ManagedFinancialScreenRecipeDeliveryAdapter } from "./financial-screen-recipe-delivery";
import type { ManagedValuationDraftFileDeliveryAdapter } from "./valuation-draft-file-delivery";
import type { ManagedFollowupsDraftFileDeliveryAdapter } from "./followups-draft-file-delivery";
import type { ManagedPortfolioDraftFileDeliveryAdapter } from "./portfolio-draft-file-delivery";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-ports";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
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
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";

// Controlled hook calls inspect composition and cleanup; the real session store runs below.
const hooks = vi.hoisted(() => ({
  state: null as NativeTrialSessionStore | null,
  effects: [] as Array<() => (() => void) | void>,
  register: vi.fn(),
  androidBack: { addListener: vi.fn(), exitApp: vi.fn() },
  memo: [] as Array<{ value: unknown }>,
  memoIndex: 0,
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
  useMemo: (create: () => unknown) => {
    const index = hooks.memoIndex++;
    hooks.memo[index] ??= { value: create() };
    return hooks.memo[index].value;
  },
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
  hooks.memo = [];
  hooks.memoIndex = 0;
  hooks.register.mockReset();
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function mount(
  config: ClerkTrialConfig,
  state = signedIn,
  overrides: Partial<InvestmentAuthPlugin> = {},
) {
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
    ...overrides,
  };
  const exportPlugin = { choose: vi.fn(), write: vi.fn(), cancel: vi.fn() };
  const reportPlugin = { choose: vi.fn(), write: vi.fn(), cancel: vi.fn() };
  const draftFilePlugin = { choose: vi.fn(), write: vi.fn(), cancel: vi.fn() };
  const screenComparisonReportPlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const financialScreenRecipePlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const valuationDraftFilePlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const followupsDraftFilePlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const followupsReviewReportPlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const portfolioReviewReportPlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const portfolioDraftFilePlugin = {
    choose: vi.fn(),
    write: vi.fn(),
    cancel: vi.fn(),
  };
  const plugins = new Map<string, unknown>([
    ["InvestmentAuth", plugin],
    ["InvestmentWatchlistExport", exportPlugin],
    ["InvestmentWatchlistDraftFile", draftFilePlugin],
    ["InvestmentCompanyReport", reportPlugin],
    ["InvestmentCompanyReportHtml", reportPlugin],
    ["InvestmentPortfolioDraftFile", portfolioDraftFilePlugin],
    ["InvestmentPortfolioReviewReport", portfolioReviewReportPlugin],
    ["InvestmentFollowupsReviewReport", followupsReviewReportPlugin],
    ["InvestmentFollowupsDraftFile", followupsDraftFilePlugin],
    ["InvestmentValuationDraftFile", valuationDraftFilePlugin],
    ["InvestmentFinancialScreenRecipe", financialScreenRecipePlugin],
    ["InvestmentScreenComparisonReport", screenComparisonReportPlugin],
  ]);
  hooks.register.mockImplementation((name: string) => plugins.get(name));
  const loading = NativeTrialApp({ config });
  const loadingHtml = renderToStaticMarkup(loading);
  expect(loadingHtml).toContain("Checking the installed session");
  expect(loadingHtml.match(/<h1[ >]/g)).toHaveLength(1);
  if (config.environment === "production") {
    expect(loadingHtml).toContain("<h1>Your markets and research</h1>");
    expect(loadingHtml).toContain("Opening Investment</h2>");
    expect(loadingHtml).toContain('data-busy="true"');
  } else {
    expect(loadingHtml).not.toContain("managed-entry");
  }
  cleanup = hooks.effects[0]!();
  await Promise.resolve();
  await Promise.resolve();
  function frame() {
    const element = NativeTrialApp({ config });
    const component = element.type as (
      props: unknown,
    ) => ReactElement<{ children: ReactNode }>;
    hooks.memoIndex = 0;
    return component(element.props);
  }
  return {
    frame,
    plugin,
    remove,
    exportPlugin,
    reportPlugin,
    draftFilePlugin,
    portfolioDraftFilePlugin,
    portfolioReviewReportPlugin,
    followupsReviewReportPlugin,
    followupsDraftFilePlugin,
    valuationDraftFilePlugin,
    financialScreenRecipePlugin,
    screenComparisonReportPlugin,
    emit: (value: NativeAuthState) => emit(value),
  };
}

function findScreen(node: ReactNode):
  | ReactElement<{
      session: TrialSession;
      apiOrigin: string;
      androidBack?: AndroidBackAdapter;
      warnOnBrowserLeave?: boolean;
      exportDelivery?: WatchlistExportDeliveryAdapter;
      draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
      portfolioDraftFileDelivery?: ManagedPortfolioDraftFileDeliveryAdapter;
      portfolioReviewReportDelivery?: PortfolioReviewReportDeliveryAdapter;
      followupsReviewReportDelivery?: FollowupsReviewReportDeliveryAdapter;
      followupsDraftFileDelivery?: ManagedFollowupsDraftFileDeliveryAdapter;
      valuationDraftFileDelivery?: ManagedValuationDraftFileDeliveryAdapter;
      financialScreenRecipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
      screenComparisonReportDelivery?: ScreenComparisonReportDeliveryAdapter;
      reportDelivery?: CompanyReportDeliveryAdapter;
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
        exportDelivery?: WatchlistExportDeliveryAdapter;
        draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
        portfolioDraftFileDelivery?: ManagedPortfolioDraftFileDeliveryAdapter;
        portfolioReviewReportDelivery?: PortfolioReviewReportDeliveryAdapter;
        followupsReviewReportDelivery?: FollowupsReviewReportDeliveryAdapter;
        followupsDraftFileDelivery?: ManagedFollowupsDraftFileDeliveryAdapter;
        valuationDraftFileDelivery?: ManagedValuationDraftFileDeliveryAdapter;
        financialScreenRecipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
        screenComparisonReportDelivery?: ScreenComparisonReportDeliveryAdapter;
        reportDelivery?: CompanyReportDeliveryAdapter;
      }>;
    }
    const found = findScreen(child.props.children);
    if (found) return found;
  }
}

function signInButton(
  node: ReactNode,
):
  | ReactElement<{ disabled: boolean; onClick: () => void; children: string }>
  | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === "button")
      return child as ReactElement<{
        disabled: boolean;
        onClick: () => void;
        children: string;
      }>;
    const found = signInButton(child.props.children);
    if (found) return found;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("native shared workspace composition", () => {
  it.each([
    [production, ManagedSessionScreen],
    [development, TrialSessionScreen],
  ] as const)(
    "selects the existing screen and owns one listener %#",
    async (config, screenType) => {
      const {
        frame,
        plugin,
        remove,
        exportPlugin,
        reportPlugin,
        draftFilePlugin,
        portfolioDraftFilePlugin,
        portfolioReviewReportPlugin,
        followupsReviewReportPlugin,
        followupsDraftFilePlugin,
        valuationDraftFilePlugin,
        financialScreenRecipePlugin,
        screenComparisonReportPlugin,
      } = await mount(config);
      const screen = findScreen(frame());
      expect(screen?.type).toBe(screenType);
      expect(screen?.key).toBe("1");
      expect(screen?.props.apiOrigin).toBe(config.apiOrigin);
      expect(screen?.props.session.userId).toBe(signedIn.userId);
      expect(screen?.props.warnOnBrowserLeave).toBeUndefined();
      expect(screen?.props.androidBack).toBe(
        config.environment === "production" ? hooks.androidBack : undefined,
      );
      expect(hooks.register.mock.calls).toEqual(
        config.environment === "production"
          ? [
              ["InvestmentAuth"],
              ["InvestmentWatchlistExport"],
              ["InvestmentCompanyReport"],
              ["InvestmentCompanyReportHtml"],
              ["InvestmentWatchlistDraftFile"],
              ["InvestmentPortfolioDraftFile"],
              ["InvestmentPortfolioReviewReport"],
              ["InvestmentFollowupsReviewReport"],
              ["InvestmentFollowupsDraftFile"],
              ["InvestmentValuationDraftFile"],
              ["InvestmentFinancialScreenRecipe"],
              ["InvestmentScreenComparisonReport"],
            ]
          : [["InvestmentAuth"]],
      );
      expect(screen?.props.reportDelivery?.destination).toBe(
        config.environment === "production" ? "system_document" : undefined,
      );
      expect(findScreen(frame())?.props.reportDelivery).toBe(
        screen?.props.reportDelivery,
      );
      for (const method of Object.values(reportPlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.exportDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.exportDelivery).toBe(
        screen?.props.exportDelivery,
      );
      for (const method of Object.values(exportPlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.draftFileDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.draftFileDelivery).toBe(
        screen?.props.draftFileDelivery,
      );
      for (const method of Object.values(draftFilePlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.portfolioDraftFileDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.portfolioDraftFileDelivery).toBe(
        screen?.props.portfolioDraftFileDelivery,
      );
      for (const method of Object.values(portfolioDraftFilePlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.portfolioReviewReportDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.portfolioReviewReportDelivery).toBe(
        screen?.props.portfolioReviewReportDelivery,
      );
      for (const method of Object.values(portfolioReviewReportPlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.followupsReviewReportDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.followupsReviewReportDelivery).toBe(
        screen?.props.followupsReviewReportDelivery,
      );
      for (const method of Object.values(followupsReviewReportPlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.followupsDraftFileDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.followupsDraftFileDelivery).toBe(
        screen?.props.followupsDraftFileDelivery,
      );
      for (const method of Object.values(followupsDraftFilePlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.valuationDraftFileDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.valuationDraftFileDelivery).toBe(
        screen?.props.valuationDraftFileDelivery,
      );
      for (const method of Object.values(valuationDraftFilePlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.financialScreenRecipeDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.financialScreenRecipeDelivery).toBe(
        screen?.props.financialScreenRecipeDelivery,
      );
      for (const method of Object.values(financialScreenRecipePlugin))
        expect(method).not.toHaveBeenCalled();
      expect(typeof screen?.props.screenComparisonReportDelivery?.deliver).toBe(
        config.environment === "production" ? "function" : "undefined",
      );
      expect(findScreen(frame())?.props.screenComparisonReportDelivery).toBe(
        screen?.props.screenComparisonReportDelivery,
      );
      for (const method of Object.values(screenComparisonReportPlugin))
        expect(method).not.toHaveBeenCalled();
      expect(plugin.addListener).toHaveBeenCalledTimes(1);
      expect(plugin.getState).toHaveBeenCalledTimes(1);
      const html = renderToStaticMarkup(frame());
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      if (config.environment === "production") {
        expect(html).toContain("<h1>Investment</h1>");
        expect(html).not.toContain("Discover companies");
      }
      expect(html).not.toContain("managed-entry");
      expect(html).not.toContain("managed-session-notice");
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
    expect(current.props.screenComparisonReportDelivery).toBe(
      previous.props.screenComparisonReportDelivery,
    );
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
    expect(signInButton(frame())?.props.disabled).toBe(true);
    expect(renderToStaticMarkup(frame())).toContain(
      "Signing out this installed session…",
    );
    await expect(pending).rejects.toMatchObject({ code: "unauthenticated" });
    const html = renderToStaticMarkup(frame());
    expect(html).toContain("Sign in again");
    expect(html).toContain("<h1>Your markets and research</h1>");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).not.toContain("Managed workspace fixture");
    expect(html).not.toContain("join the trial");
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain(
      "Signed out on this phone; server sign-out could not be confirmed. You can start a new sign-in. This will not confirm that the earlier session ended.",
    );
    expect(signInButton(frame())?.props.disabled).toBe(false);
    await expect(previous.props.session.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
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
    expect(html).toContain("<h1>Your markets and research</h1>");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("Discover companies");
    expect(html).not.toContain("Synthetic data only.");
    expect(html).toContain("Sign in on this device</h2>");
    expect(html).toContain('data-tone="neutral"');
    expect(html).toContain('data-busy="false"');
    expect(signInButton(frame())?.props.disabled).toBe(false);
    expect(findScreen(frame())).toBeUndefined();
  });

  it("keeps native entry disabled until the installed session check completes", async () => {
    const request = deferred<NativeAuthState>();
    const { frame, plugin } = await mount(production, signedIn, {
      getState: () => request.promise,
    });
    expect(renderToStaticMarkup(frame())).toContain(
      "Checking the installed session…",
    );
    expect(renderToStaticMarkup(frame())).toContain('data-busy="true"');
    expect(signInButton(frame())?.props.disabled).toBe(true);
    expect(findScreen(frame())).toBeUndefined();
    expect(plugin.signIn).not.toHaveBeenCalled();
    request.resolve({
      status: "signedOut",
      userId: null,
      sessionId: null,
      generation: 1,
    });
    await Promise.resolve();
    expect(renderToStaticMarkup(frame())).toContain(
      "Sign in to open your shared watchlist.",
    );
    expect(signInButton(frame())?.props.disabled).toBe(false);
  });

  it("keeps unavailable and failed sign-in messages visible with one retry control", async () => {
    const request = deferred<NativeAuthState>();
    const { frame, plugin } = await mount(production, signedIn, {
      getState: vi.fn().mockRejectedValue(new Error("synthetic unavailable")),
      signIn: vi.fn().mockReturnValue(request.promise),
    });
    const unavailable = renderToStaticMarkup(frame());
    expect(unavailable).toContain(
      "The installed sign-in service is unavailable.",
    );
    expect(unavailable).toContain('data-tone="warning"');
    expect(unavailable.match(/<button[ >]/g)).toHaveLength(1);
    const control = signInButton(frame())!;
    expect(control.props.disabled).toBe(false);
    control.props.onClick();
    expect(plugin.signIn).toHaveBeenCalledTimes(1);
    expect(signInButton(frame())?.props.disabled).toBe(true);
    expect(renderToStaticMarkup(frame())).toContain("Opening secure sign-in…");
    expect(findScreen(frame())).toBeUndefined();
    request.reject(new Error("synthetic canceled"));
    await Promise.resolve();
    const failed = renderToStaticMarkup(frame());
    expect(failed).toContain("Sign-in did not complete. You can try again.");
    expect(failed).toContain('data-tone="warning"');
    expect(failed).toContain('data-busy="false"');
    expect(signInButton(frame())?.props.disabled).toBe(false);
    expect(findScreen(frame())).toBeUndefined();
  });

  it.each([1, 2])(
    "preserves the earlier sign-out warning after recovery generation %s",
    async (generation) => {
      const { frame, plugin } = await mount(production, signedIn, {
        signIn: vi.fn().mockResolvedValue({ ...signedIn, generation }),
      });
      const previous = findScreen(frame())!;
      await expect(previous.props.session.signOut()).rejects.toMatchObject({
        code: "unauthenticated",
      });
      signInButton(frame())!.props.onClick();
      expect(signInButton(frame())?.props.disabled).toBe(true);
      await Promise.resolve();
      const html = renderToStaticMarkup(frame());
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      if (generation === 1) {
        expect(findScreen(frame())).toBeUndefined();
        expect(html).toContain(
          "No new session was confirmed. The earlier server sign-out remains unconfirmed.",
        );
        expect(html).toContain('data-tone="warning"');
        expect(signInButton(frame())?.props.children).toBe("Sign in again");
      } else {
        expect(findScreen(frame())?.key).toBe("2");
        expect(html).toContain('<div class="managed-session-notice">');
        expect(html).toContain(
          '<p role="status">A new session is active. The earlier server sign-out remains unconfirmed.</p>',
        );
        expect(html).not.toContain("managed-entry");
        expect(signInButton(frame())).toBeUndefined();
      }
      await expect(previous.props.session.getToken()).rejects.toMatchObject({
        code: "unauthenticated",
      });
      expect(plugin.getToken).not.toHaveBeenCalled();
    },
  );

  it("returns to warning entry when a native update cannot be verified", async () => {
    const { frame, emit } = await mount(production);
    const previous = findScreen(frame())!;
    emit({ ...signedIn, userId: "invalid identity", generation: 2 });
    const html = renderToStaticMarkup(frame());
    expect(html).toContain("The installed session could not be verified.");
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain("<h1>Your markets and research</h1>");
    expect(findScreen(frame())).toBeUndefined();
    await expect(previous.props.session.getToken()).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("cannot admit a late sign-in after the native adapter is retired", async () => {
    const request = deferred<NativeAuthState>();
    const { frame, remove } = await mount(
      production,
      { status: "signedOut", userId: null, sessionId: null, generation: 1 },
      { signIn: () => request.promise },
    );
    signInButton(frame())!.props.onClick();
    cleanup?.();
    cleanup = undefined;
    expect(remove).toHaveBeenCalledTimes(1);
    request.resolve({ ...signedIn, generation: 2 });
    await Promise.resolve();
    expect(findScreen(frame())).toBeUndefined();
    expect(renderToStaticMarkup(frame())).not.toContain(
      "Managed workspace fixture",
    );
  });
});
