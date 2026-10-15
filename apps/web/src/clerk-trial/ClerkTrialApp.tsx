import { browserCompanyReportAdapter } from "./browser-company-report";
import { ClerkProvider, SignIn, useAuth, useSession } from "@clerk/react";
import { useState } from "react";
import { validateTrialConfig } from "./config";
import type { ClerkTrialConfig } from "./config";
import { TrialSessionScreen } from "./TrialScreen";
import { ManagedSessionScreen } from "./ManagedWorkspaceScreen";
import { TrialFrame } from "./TrialFrame";
import { ManagedEntry } from "./ManagedEntry";
import { browserWatchlistExportAdapter } from "./browser-watchlist-export";
import {
  managedCompanyHref,
  parseManagedCompanyRoute,
} from "./managed-company-route";
export type { ClerkTrialConfig } from "./config";

function ManagedSignIn() {
  const [destination] = useState(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/")
      return "/";
    const route = parseManagedCompanyRoute(
      new URLSearchParams(window.location.search),
    );
    return route.kind === "company"
      ? managedCompanyHref(route.listingId, route.section)
      : "/";
  });
  return (
    <SignIn
      routing="hash"
      fallbackRedirectUrl={destination}
      forceRedirectUrl={destination}
    />
  );
}

function ClerkSession({
  apiOrigin,
  managed,
}: {
  apiOrigin: string;
  managed: boolean;
}) {
  const auth = useAuth();
  const current = useSession();
  if (!auth.isLoaded || !current.isLoaded)
    return (
      <TrialFrame managed={managed}>
        {managed ? (
          <ManagedEntry
            title="Opening Investment"
            message="Checking your session…"
            busy
          />
        ) : (
          <p role="status">Checking your session…</p>
        )}
      </TrialFrame>
    );
  if (
    !auth.isSignedIn ||
    !current.isSignedIn ||
    current.session.status !== "active"
  ) {
    return (
      <TrialFrame managed={managed}>
        {managed ? (
          <ManagedEntry title="Sign in to your workspace">
            <div className="managed-sign-in">
              <ManagedSignIn />
            </div>
          </ManagedEntry>
        ) : (
          <div className="trial-sign-in">
            <SignIn routing="hash" fallbackRedirectUrl="/" />
          </div>
        )}
      </TrialFrame>
    );
  }
  const session = current.session;
  if (auth.sessionId !== session.id || auth.userId !== session.user.id) {
    return (
      <TrialFrame managed={managed}>
        {managed ? (
          <ManagedEntry
            title="Opening Investment"
            message="Checking your session…"
            busy
          />
        ) : (
          <p role="status">Checking your session…</p>
        )}
      </TrialFrame>
    );
  }
  const Screen = managed ? ManagedSessionScreen : TrialSessionScreen;
  return (
    <TrialFrame managed={managed} compact={managed}>
      <Screen
        key={`${session.user.id}:${session.id}`}
        apiOrigin={apiOrigin}
        {...(managed
          ? {
              warnOnBrowserLeave: true,
              exportDelivery: browserWatchlistExportAdapter,
              reportDelivery: browserCompanyReportAdapter,
            }
          : {})}
        session={{
          userId: session.user.id,
          sessionId: session.id,
          getToken: () => session.getToken(),
          signOut: () => auth.signOut({ sessionId: session.id }),
        }}
      />
    </TrialFrame>
  );
}

export function ClerkTrialApp({ config }: { config: ClerkTrialConfig }) {
  const checked = validateTrialConfig(config);
  return (
    <ClerkProvider publishableKey={checked.publishableKey} afterSignOutUrl="/">
      <ClerkSession
        apiOrigin={checked.apiOrigin}
        managed={checked.environment === "production"}
      />
    </ClerkProvider>
  );
}
