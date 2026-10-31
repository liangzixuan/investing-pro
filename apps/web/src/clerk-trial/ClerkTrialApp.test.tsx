import { browserScreenComparisonReportAdapter } from "./screen-comparison-report-delivery";
import type { ScreenComparisonReportDeliveryAdapter } from "./screen-comparison-report-ports";
import {
  browserFinancialScreenRecipeAdapter,
  type ManagedFinancialScreenRecipeDeliveryAdapter,
} from "./financial-screen-recipe-delivery";
import {
  browserValuationDraftFileAdapter,
  type ManagedValuationDraftFileDeliveryAdapter,
} from "./valuation-draft-file-delivery";
import {
  browserFollowupsDraftFileAdapter,
  type ManagedFollowupsDraftFileDeliveryAdapter,
} from "./followups-draft-file-delivery";
import {
  browserPortfolioDraftFileAdapter,
  type ManagedPortfolioDraftFileDeliveryAdapter,
} from "./portfolio-draft-file-delivery";
import { browserPortfolioReviewReportAdapter } from "./portfolio-review-report-delivery";
import { browserPortfolioComparisonReportAdapter } from "./portfolio-comparison-report-delivery";
import { browserFollowupsReviewReportAdapter } from "./followups-review-report-delivery";
import type { FollowupsReviewReportDeliveryAdapter } from "./followups-review-report-ports";
import type { PortfolioReviewReportDeliveryAdapter } from "./portfolio-review-report-ports";
import type { PortfolioComparisonReportDeliveryAdapter } from "./portfolio-comparison-report-ports";
import { browserCompanyReportAdapter } from "./browser-company-report";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkTrialApp } from "./ClerkTrialApp";
import type { TrialSession } from "./session";
import { browserWatchlistExportAdapter } from "./browser-watchlist-export";
import type { WatchlistExportDeliveryAdapter } from "./watchlist-export-delivery";
import { browserWatchlistDraftFileAdapter } from "./browser-watchlist-draft-file";
import type { ManagedWatchlistDraftFileDeliveryAdapter } from "./managed-watchlist-draft-file-delivery";

const sdk = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  signIn: vi.fn(),
  screen: vi.fn(),
  managed: vi.fn(),
}));
vi.mock("@clerk/react", () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  SignIn: (props: unknown) => {
    sdk.signIn(props);
    return <div>Official sign-in</div>;
  },
  useAuth: sdk.auth,
  useSession: sdk.session,
}));
vi.mock("./TrialScreen", () => ({
  TrialSessionScreen: (props: { session: TrialSession; apiOrigin: string }) => {
    sdk.screen(props);
    return <div>Session watchlist</div>;
  },
}));
vi.mock("./ManagedWorkspaceScreen", () => ({
  ManagedSessionScreen: (props: {
    session: TrialSession;
    apiOrigin: string;
  }) => {
    sdk.managed(props);
    return <div>Managed Discover and watchlist</div>;
  },
}));
const config = {
  environment: "development" as const,
  publishableKey: `pk_test_${Buffer.from("invented-trial-12.clerk.accounts.dev$").toString("base64")}`,
  apiOrigin: "https://investment-clerk-api-6abac57a.appwrite.network",
  frontendApiOrigin: "https://invented-trial-12.clerk.accounts.dev",
};
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("official Clerk browser adapter", () => {
  it.each([
    [
      "/",
      "?company=listing-one&section=price",
      "/?company=listing-one&section=price",
    ],
    [
      "/",
      "?company=listing-one&section=annual",
      "/?company=listing-one&section=annual",
    ],
    [
      "/",
      "?company=listing-one&section=annual&redirect_url=https://example.invalid",
      "/",
    ],
    ["/", "?company=listing-one&company=listing-two&section=price", "/"],
    ["/", "?company=%2F%2Fevil.invalid&section=price", "/"],
    ["/", "?company=listing-one&section=other", "/"],
    ["/company/elsewhere", "?company=listing-one&section=price", "/"],
    ["/", "?redirect_url=https://example.invalid", "/"],
  ])(
    "keeps a managed sign-in return at a validated root URL (%s%s)",
    (pathname, search, destination) => {
      vi.stubGlobal("window", {
        location: { pathname, search, hash: "#/sign-in/factor-one" },
      });
      sdk.auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
      sdk.session.mockReturnValue({ isLoaded: true, isSignedIn: false });
      const html = renderToStaticMarkup(
        <ClerkTrialApp
          config={{
            environment: "production",
            publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
            apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
            frontendApiOrigin: "https://clerk.investingpro.app",
          }}
        />,
      );
      expect(html).toContain("<h1>Your markets and research</h1>");
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html).toContain("Sign in to your workspace</h2>");
      expect(html).toContain('class="managed-sign-in"');
      expect(html).toContain("Official sign-in");
      expect(sdk.signIn).toHaveBeenCalledExactlyOnceWith({
        routing: "hash",
        fallbackRedirectUrl: destination,
        forceRedirectUrl: destination,
      });
      expect(sdk.managed).not.toHaveBeenCalled();
      expect(sdk.screen).not.toHaveBeenCalled();
    },
  );
  it("uses the SDK sign-in component when signed out", () => {
    sdk.auth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    sdk.session.mockReturnValue({ isLoaded: true, isSignedIn: false });
    const html = renderToStaticMarkup(<ClerkTrialApp config={config} />);
    expect(html).toContain("Official sign-in");
    expect(html).not.toContain("managed-entry");
    expect(sdk.signIn).toHaveBeenCalledWith({
      routing: "hash",
      fallbackRedirectUrl: "/",
    });
    expect(sdk.screen).not.toHaveBeenCalled();
  });

  it("binds each token and sign-out to the exact current session resource", async () => {
    const getToken = vi
      .fn<TrialSession["getToken"]>()
      .mockResolvedValue("synthetic-token");
    const signOut = vi
      .fn<(options: { sessionId: string }) => Promise<void>>()
      .mockResolvedValue();
    sdk.auth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      userId: "user_demo",
      sessionId: "session_demo",
      signOut,
    });
    sdk.session.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      session: {
        id: "session_demo",
        user: { id: "user_demo" },
        status: "active",
        getToken,
      },
    });
    renderToStaticMarkup(<ClerkTrialApp config={config} />);
    const props = sdk.screen.mock.calls[0]?.[0] as {
      session: TrialSession;
      apiOrigin: string;
      warnOnBrowserLeave?: boolean;
      exportDelivery?: WatchlistExportDeliveryAdapter;
      draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
      portfolioDraftFileDelivery?: ManagedPortfolioDraftFileDeliveryAdapter;
      portfolioReviewReportDelivery?: PortfolioReviewReportDeliveryAdapter;
      portfolioComparisonReportDelivery?: PortfolioComparisonReportDeliveryAdapter;
      followupsDraftFileDelivery?: ManagedFollowupsDraftFileDeliveryAdapter;
      followupsReviewReportDelivery?: FollowupsReviewReportDeliveryAdapter;
      valuationDraftFileDelivery?: ManagedValuationDraftFileDeliveryAdapter;
      financialScreenRecipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
      screenComparisonReportDelivery?: ScreenComparisonReportDeliveryAdapter;
      reportDelivery?: CompanyReportDeliveryAdapter;
    };
    expect(props.apiOrigin).toBe(config.apiOrigin);
    expect(props.warnOnBrowserLeave).toBeUndefined();
    expect(props.exportDelivery).toBeUndefined();
    expect(props.draftFileDelivery).toBeUndefined();
    expect(props.portfolioDraftFileDelivery).toBeUndefined();
    expect(props.portfolioReviewReportDelivery).toBeUndefined();
    expect(props.portfolioComparisonReportDelivery).toBeUndefined();
    expect(props.followupsDraftFileDelivery).toBeUndefined();
    expect(props.followupsReviewReportDelivery).toBeUndefined();
    expect(props.valuationDraftFileDelivery).toBeUndefined();
    expect(props.financialScreenRecipeDelivery).toBeUndefined();
    expect(props.screenComparisonReportDelivery).toBeUndefined();
    expect(props.reportDelivery).toBeUndefined();
    expect(await props.session.getToken()).toBe("synthetic-token");
    await props.session.signOut();
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledExactlyOnceWith({
      sessionId: "session_demo",
    });
  });

  it("unmounts the shared screen while auth hooks disagree on identity", () => {
    sdk.auth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      userId: "user_new",
      sessionId: "session_new",
    });
    sdk.session.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      session: {
        id: "session_old",
        user: { id: "user_old" },
        status: "active",
      },
    });
    const html = renderToStaticMarkup(<ClerkTrialApp config={config} />);
    expect(html).toContain("Checking your session");
    expect(sdk.screen).not.toHaveBeenCalled();
    expect(sdk.managed).not.toHaveBeenCalled();
  });

  it("selects managed Discover and watchlist only for a matching active production session", () => {
    const production = {
      environment: "production" as const,
      publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
      apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
      frontendApiOrigin: "https://clerk.investingpro.app",
    };
    sdk.auth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      userId: "user_owner",
      sessionId: "session_owner",
      signOut: vi.fn(),
    });
    sdk.session.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      session: {
        id: "session_owner",
        user: { id: "user_owner" },
        status: "active",
        getToken: vi.fn(),
      },
    });
    const html = renderToStaticMarkup(<ClerkTrialApp config={production} />);
    expect(html).toContain("Managed Discover and watchlist");
    expect(html).toContain("<h1>Investment</h1>");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).not.toContain("Discover companies");
    expect(html).not.toContain("Synthetic data only");
    expect(html).not.toContain("managed-entry");
    expect(sdk.signIn).not.toHaveBeenCalled();
    expect(sdk.managed).toHaveBeenCalledTimes(1);
    expect(sdk.screen).not.toHaveBeenCalled();
    const props = sdk.managed.mock.calls[0]?.[0] as {
      session: TrialSession;
      warnOnBrowserLeave?: boolean;
      exportDelivery?: WatchlistExportDeliveryAdapter;
      draftFileDelivery?: ManagedWatchlistDraftFileDeliveryAdapter;
      portfolioDraftFileDelivery?: ManagedPortfolioDraftFileDeliveryAdapter;
      portfolioReviewReportDelivery?: PortfolioReviewReportDeliveryAdapter;
      portfolioComparisonReportDelivery?: PortfolioComparisonReportDeliveryAdapter;
      followupsDraftFileDelivery?: ManagedFollowupsDraftFileDeliveryAdapter;
      followupsReviewReportDelivery?: FollowupsReviewReportDeliveryAdapter;
      valuationDraftFileDelivery?: ManagedValuationDraftFileDeliveryAdapter;
      financialScreenRecipeDelivery?: ManagedFinancialScreenRecipeDeliveryAdapter;
      screenComparisonReportDelivery?: ScreenComparisonReportDeliveryAdapter;
      reportDelivery?: CompanyReportDeliveryAdapter;
    };
    expect(props.warnOnBrowserLeave).toBe(true);
    expect(props.exportDelivery).toBe(browserWatchlistExportAdapter);
    expect(props.draftFileDelivery).toBe(browserWatchlistDraftFileAdapter);
    expect(props.portfolioDraftFileDelivery).toBe(
      browserPortfolioDraftFileAdapter,
    );
    expect(props.portfolioReviewReportDelivery).toBe(
      browserPortfolioReviewReportAdapter,
    );
    expect(props.portfolioComparisonReportDelivery).toBe(
      browserPortfolioComparisonReportAdapter,
    );
    expect(props.followupsDraftFileDelivery).toBe(
      browserFollowupsDraftFileAdapter,
    );
    expect(props.followupsReviewReportDelivery).toBe(
      browserFollowupsReviewReportAdapter,
    );
    expect(props.valuationDraftFileDelivery).toBe(
      browserValuationDraftFileAdapter,
    );
    expect(props.financialScreenRecipeDelivery).toBe(
      browserFinancialScreenRecipeAdapter,
    );
    expect(props.screenComparisonReportDelivery).toBe(
      browserScreenComparisonReportAdapter,
    );
    expect(props.reportDelivery).toBe(browserCompanyReportAdapter);
    expect(props.session).toMatchObject({
      userId: "user_owner",
      sessionId: "session_owner",
    });
  });

  it.each([false, true])(
    "keeps the full managed frame while session hooks are loading or disagree (loaded=%s)",
    (loaded) => {
      sdk.auth.mockReturnValue({
        isLoaded: loaded,
        isSignedIn: true,
        userId: "user_new",
        sessionId: "session_new",
      });
      sdk.session.mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        session: {
          id: "session_old",
          user: { id: "user_old" },
          status: "active",
        },
      });
      const html = renderToStaticMarkup(
        <ClerkTrialApp
          config={{
            environment: "production",
            publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
            apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
            frontendApiOrigin: "https://clerk.investingpro.app",
          }}
        />,
      );
      expect(html).toContain("Checking your session");
      expect(html).toContain("Opening Investment</h2>");
      expect(html).toContain('data-busy="true"');
      expect(html).toContain('<p class="managed-entry-message" role="status">');
      expect(html).toContain("<h1>Your markets and research</h1>");
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(sdk.managed).not.toHaveBeenCalled();
      expect(sdk.screen).not.toHaveBeenCalled();
      expect(sdk.signIn).not.toHaveBeenCalled();
    },
  );

  it.each(
    ["pending", "ended", "revoked"].flatMap((status) =>
      ["development", "production"].map((environment) => [status, environment]),
    ),
  )(
    "keeps an inactive %s session out of the %s workspace",
    (status, environment) => {
      sdk.auth.mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        userId: "user_owner",
        sessionId: "session_owner",
      });
      sdk.session.mockReturnValue({
        isLoaded: true,
        isSignedIn: true,
        session: { id: "session_owner", user: { id: "user_owner" }, status },
      });
      const html = renderToStaticMarkup(
        <ClerkTrialApp
          config={
            environment === "production"
              ? {
                  environment,
                  publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
                  apiOrigin:
                    "https://investment-managed-6abac57a.appwrite.network",
                  frontendApiOrigin: "https://clerk.investingpro.app",
                }
              : config
          }
        />,
      );
      expect(html).toContain("Official sign-in");
      expect(html.includes("Sign in to your workspace</h2>")).toBe(
        environment === "production",
      );
      expect(sdk.screen).not.toHaveBeenCalled();
      expect(sdk.managed).not.toHaveBeenCalled();
    },
  );
});
