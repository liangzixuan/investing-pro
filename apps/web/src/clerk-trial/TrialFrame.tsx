import type { ReactNode } from "react";
import { ThirdPartyNotices } from "./ThirdPartyNotices";

export function TrialFrame({
  children,
  managed = false,
  compact = false,
}: {
  children: ReactNode;
  managed?: boolean;
  compact?: boolean;
}) {
  const compactManaged = managed && compact;
  const Container = compactManaged ? "div" : "main";
  return (
    <Container
      className={`clerk-trial${managed ? " managed-frame" : ""}${compactManaged ? " managed-frame-active" : ""}`}
    >
      <header
        className={`trial-header${compactManaged ? " managed-header-compact" : ""}`}
      >
        {!compactManaged && <p className="trial-eyebrow">Investment</p>}
        <h1>
          {compactManaged
            ? "Investment"
            : managed
              ? "Your markets and research"
              : "A shared watchlist, across your devices"}
        </h1>
        {!compactManaged &&
          (managed ? (
            <p>
              Discover companies, inspect dated prices, and keep your research
              across devices.
            </p>
          ) : (
            <>
              <p>
                Sign in to the isolated trial and try the same demo watchlist on
                two devices.
              </p>
              <p className="trial-boundary">
                Synthetic data only. Your local research and vault are separate.
              </p>
            </>
          ))}
      </header>
      {children}
      <ThirdPartyNotices />
    </Container>
  );
}
