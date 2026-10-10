import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkTrialApp } from "./ClerkTrialApp";
import type { TrialSession } from "./session";

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
      renderToStaticMarkup(
        <ClerkTrialApp
          config={{
            environment: "production",
            publishableKey: `pk_live_${Buffer.from("clerk.investingpro.app$").toString("base64")}`,
            apiOrigin: "https://investment-managed-6abac57a.appwrite.network",
            frontendApiOrigin: "https://clerk.investingpro.app",
          }}
        />,
      );
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
    };
    expect(props.apiOrigin).toBe(config.apiOrigin);
    expect(props.warnOnBrowserLeave).toBeUndefined();
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
    expect(html).toContain("Discover companies");
    expect(html).not.toContain("Synthetic data only");
    expect(sdk.managed).toHaveBeenCalledTimes(1);
    expect(sdk.screen).not.toHaveBeenCalled();
    const props = sdk.managed.mock.calls[0]?.[0] as {
      session: TrialSession;
      warnOnBrowserLeave?: boolean;
    };
    expect(props.warnOnBrowserLeave).toBe(true);
    expect(props.session).toMatchObject({
      userId: "user_owner",
      sessionId: "session_owner",
    });
  });

  it.each(["pending", "ended", "revoked"])(
    "keeps an inactive %s session out of both workspaces",
    (status) => {
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
      expect(renderToStaticMarkup(<ClerkTrialApp config={config} />)).toContain(
        "Official sign-in",
      );
      expect(sdk.screen).not.toHaveBeenCalled();
      expect(sdk.managed).not.toHaveBeenCalled();
    },
  );
});
