import type { ReactNode } from "react";
import { ThirdPartyNotices } from "./ThirdPartyNotices";

export function TrialFrame({ children }: { children: ReactNode }) {
  return (
    <main className="clerk-trial">
      <header className="trial-header">
        <p className="trial-eyebrow">Investment</p>
        <h1>A shared watchlist, across your devices</h1>
        <p>
          Sign in to the isolated trial and try the same demo watchlist on two
          devices.
        </p>
        <p className="trial-boundary">
          Synthetic data only. Your local research and vault are separate.
        </p>
      </header>
      {children}
      <ThirdPartyNotices />
    </main>
  );
}
