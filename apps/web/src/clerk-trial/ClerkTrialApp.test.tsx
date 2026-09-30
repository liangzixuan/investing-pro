import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkTrialApp } from "./ClerkTrialApp";
import type { TrialSession } from "./session";

const sdk = vi.hoisted(() => ({
  auth: vi.fn(),
  session: vi.fn(),
  signIn: vi.fn(),
  screen: vi.fn(),
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
const config = {
  publishableKey: "pk_test_synthetic",
  apiOrigin: "https://api.example.invalid",
  frontendApiOrigin: "https://clerk.example.invalid",
};
beforeEach(() => vi.clearAllMocks());

describe("official Clerk browser adapter", () => {
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
    };
    expect(props.apiOrigin).toBe(config.apiOrigin);
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
  });
});
