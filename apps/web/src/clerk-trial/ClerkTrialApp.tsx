import { ClerkProvider, SignIn, useAuth, useSession } from "@clerk/react";
import { useState } from "react";
import { validateTrialConfig } from "./config";
import type { ClerkTrialConfig } from "./config";
import { TrialSessionScreen } from "./TrialScreen";
import { ManagedSessionScreen } from "./ManagedWorkspaceScreen";
import { TrialFrame } from "./TrialFrame";
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
    return <p role="status">Checking your session…</p>;
  if (
    !auth.isSignedIn ||
    !current.isSignedIn ||
    current.session.status !== "active"
  ) {
    return (
      <div className="trial-sign-in">
        {managed ? (
          <ManagedSignIn />
        ) : (
          <SignIn routing="hash" fallbackRedirectUrl="/" />
        )}
      </div>
    );
  }
  const session = current.session;
  if (auth.sessionId !== session.id || auth.userId !== session.user.id) {
    return <p role="status">Checking your session…</p>;
  }
  const Screen = managed ? ManagedSessionScreen : TrialSessionScreen;
  return (
    <Screen
      key={`${session.user.id}:${session.id}`}
      apiOrigin={apiOrigin}
      session={{
        userId: session.user.id,
        sessionId: session.id,
        getToken: () => session.getToken(),
        signOut: () => auth.signOut({ sessionId: session.id }),
      }}
    />
  );
}

export function ClerkTrialApp({ config }: { config: ClerkTrialConfig }) {
  const checked = validateTrialConfig(config);
  return (
    <ClerkProvider publishableKey={checked.publishableKey} afterSignOutUrl="/">
      <TrialFrame managed={checked.environment === "production"}>
        <ClerkSession
          apiOrigin={checked.apiOrigin}
          managed={checked.environment === "production"}
        />
      </TrialFrame>
    </ClerkProvider>
  );
}
