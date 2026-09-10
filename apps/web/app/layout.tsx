import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LegacyLocalStateCleanup } from "@/features/research/LegacyLocalStateCleanup";

import "./globals.css";
import "@/features/research/personal-portfolio.css";
import "@/features/research/personal-portfolio-ledger.css";
import "@/features/research/personal-portfolio-history.css";

export const metadata: Metadata = {
  title: "Research Cockpit — Synthetic Demo",
  description: "Evidence-first synthetic investment research workflow.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LegacyLocalStateCleanup />
        {children}
      </body>
    </html>
  );
}
