import type { ReactNode } from "react";
import { ThirdPartyNotices } from "./ThirdPartyNotices";

export function TrialFrame({
  children,
  managed = false,
}: {
  children: ReactNode;
  managed?: boolean;
}) {
  return (
    <main className={`clerk-trial${managed ? " managed-frame" : ""}`}>
      <header className="trial-header">
        <p className="trial-eyebrow">Investment</p>
        <h1>
          {managed
            ? "Your markets and research"
            : "A shared watchlist, across your devices"}
        </h1>
        {managed ? (
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
        )}
      </header>
      {children}
      <ThirdPartyNotices />
    </main>
  );
}
