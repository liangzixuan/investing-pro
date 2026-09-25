import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { LegacyLocalStateCleanup } from "@/features/research/LegacyLocalStateCleanup";
import { PersonalWorkspaceRoutes } from "@/features/workspace/PersonalWorkspaceRoutes";
import {
  isPersonalWorkspaceWebMode,
  resolveOwnerAuthMode,
} from "@/lib/web-mode";

import "./globals.css";
import "@/features/workspace/workspace.css";
import "@/features/research/company-overview.css";
import "@/features/research/personal-portfolio.css";
import "@/features/research/personal-portfolio-ledger.css";
import "@/features/research/personal-portfolio-history.css";
import "@/features/research/personal-portfolio-valuation-history.css";

export const metadata: Metadata = {
  title: isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE)
    ? "Research Desk"
    : "Research Cockpit — Synthetic Demo",
  description: isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE)
    ? "Markets, company research and personal watchlists."
    : "Evidence-first synthetic investment research workflow.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LegacyLocalStateCleanup />
        {isPersonalWorkspaceWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE) ? (
          <Suspense
            fallback={
              <main>
                <h1>Opening workspace…</h1>
              </main>
            }
          >
            <PersonalWorkspaceRoutes
              authMode={resolveOwnerAuthMode(
                process.env.RESEARCH_COCKPIT_WEB_AUTH,
              )}
            />
            {children}
          </Suspense>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
