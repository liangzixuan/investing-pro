"use client";

import type { PersonalFilingDossierDto } from "@research-cockpit/contracts";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { fetchPersonalFilingDossier } from "@/lib/personal-api";

import { OwnerSessionPanel } from "./OwnerSessionPanel";
import { PersonalDossier } from "./PersonalDossier";

export function PersonalResearchWorkspace() {
  const [dossier, setDossier] = useState<PersonalFilingDossierDto | null>(null);
  const requestEpoch = useRef(0);
  const handleOwnerSessionChange = useCallback(
    async (active: boolean, signal: AbortSignal) => {
      const epoch = ++requestEpoch.current;
      setDossier(null);
      if (!active) return false;

      const nextDossier = await fetchPersonalFilingDossier(signal).catch(
        () => null,
      );
      if (signal.aborted || epoch !== requestEpoch.current) return false;
      if (nextDossier === null) return false;
      setDossier(nextDossier);
      return true;
    },
    [],
  );

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to personal research
      </a>
      <header className="app-header personal-app-header">
        <Link className="wordmark" href="/personal">
          <span>RC</span> Research Cockpit
        </Link>
        <div className="mode-chips" aria-label="Data mode">
          <span className="personal-dossier-chip">Personal · local only</span>
        </div>
      </header>
      <div className="personal-disclosure" role="note">
        <strong>Personal filing mode.</strong> The synthetic demo is not loaded
        or used as fallback data in this workspace.
      </div>
      <main className="research-shell" id="main-content">
        <OwnerSessionPanel onSessionChange={handleOwnerSessionChange} />
        {dossier === null ? (
          <section className="personal-locked-state" aria-live="polite">
            <p className="eyebrow">Private dossier locked</p>
            <h1>Start or revalidate the owner session to load the dossier.</h1>
            <p>
              No personal response is cached, persisted, or replaced with demo
              data while access is unavailable.
            </p>
          </section>
        ) : (
          <PersonalDossier dossier={dossier} />
        )}
      </main>
      <footer className="app-footer">
        <span>Research Cockpit · personal single-user local profile</span>
        <span>Read-only · memory-only · not investment advice</span>
        <code>private no-store</code>
      </footer>
    </>
  );
}
