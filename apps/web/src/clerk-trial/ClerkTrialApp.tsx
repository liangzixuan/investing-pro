import { ClerkProvider, SignIn, useAuth, useSession } from "@clerk/react";
import { validateTrialConfig } from "./config";
import type { ClerkTrialConfig } from "./config";
import { TrialSessionScreen } from "./TrialScreen";
import { ManagedSessionScreen } from "./ManagedWorkspaceScreen";
import { TrialFrame } from "./TrialFrame";
export type { ClerkTrialConfig } from "./config";

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
        <SignIn routing="hash" fallbackRedirectUrl="/" />
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
