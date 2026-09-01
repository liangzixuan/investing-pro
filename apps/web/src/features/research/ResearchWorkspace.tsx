"use client";

import type {
  DossierDto,
  PersonalFilingSelectedFactsDto,
} from "@research-cockpit/contracts";
import {
  DEFAULT_KNOWN_AT,
  PRE_RESTATEMENT_KNOWN_AT,
} from "@research-cockpit/research-core";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDossier,
  fetchPersonalFilingReadiness,
  fetchPersonalFilingSelectedFacts,
} from "@/lib/api";

import { AnalyticalChart } from "./AnalyticalChart";
import type { EvidenceSelection } from "./evidence-selection";
import { EvidenceDialog } from "./EvidenceDialog";
import { MetricGrid } from "./MetricGrid";
import { OwnerSessionPanel } from "./OwnerSessionPanel";
import { PersonalFilingFacts } from "./PersonalFilingFacts";
import { ThesisMonitor } from "./ThesisMonitor";
import { ValuationWorkbench } from "./ValuationWorkbench";

export function ResearchWorkspace({
  symbol,
  initialKnownAt,
  personalMode = false,
}: {
  symbol: string;
  initialKnownAt: string;
  personalMode?: boolean;
}) {
  const [dossier, setDossier] = useState<DossierDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [personalQualityReady, setPersonalQualityReady] = useState(false);
  const [personalFacts, setPersonalFacts] =
    useState<PersonalFilingSelectedFactsDto | null>(null);
  const personalRequestEpoch = useRef(0);
  const closeEvidence = useCallback(() => setSelection(null), []);
  const handleOwnerSessionChange = useCallback(
    async (active: boolean, signal: AbortSignal) => {
      const requestEpoch = ++personalRequestEpoch.current;
      setPersonalQualityReady(false);
      setPersonalFacts(null);
      if (!active) return false;

      const [ready, release] = await Promise.all([
        fetchPersonalFilingReadiness(signal),
        fetchPersonalFilingSelectedFacts(signal),
      ]).catch(() => [false, null] as const);
      if (signal.aborted || requestEpoch !== personalRequestEpoch.current) {
        return false;
      }
      setPersonalQualityReady(ready);
      setPersonalFacts(release);
      return ready || release !== null;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    setDossier(null);
    setError(null);
    fetchDossier(symbol, initialKnownAt, controller.signal)
      .then(setDossier)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The dossier could not be loaded.",
          );
        }
      });
    return () => controller.abort();
  }, [initialKnownAt, retryToken, symbol]);

  if (error) {
    return (
      <main className="state-shell">
        <span className="error-mark" aria-hidden="true">
          !
        </span>
        <p className="eyebrow">Demo API unavailable</p>
        <h1>We could not assemble the dossier.</h1>
        <p>{error}</p>
        <button
          className="primary-action"
          type="button"
          onClick={() => setRetryToken((value) => value + 1)}
        >
          Try again
        </button>
        <Link href="/">Return home</Link>
      </main>
    );
  }

  if (!dossier) {
    return (
      <main className="state-shell" aria-busy="true" aria-live="polite">
        <span className="loading-orbit" aria-hidden="true" />
        <p className="eyebrow">Assembling evidence</p>
        <h1>Loading the synthetic dossier…</h1>
      </main>
    );
  }

  const restatementVisible = dossier.timeline.some(
    (event) => event.kind === "restatement",
  );

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to research
      </a>
      <header className="app-header">
        <Link className="wordmark" href="/">
          <span>RC</span> Research Cockpit
        </Link>
        <nav aria-label="Research workflow">
          <a href="#observe">Observe</a>
          <a href="#value">Value</a>
          <a href="#commit">Commit</a>
          <a href="#monitor">Monitor</a>
        </nav>
        <div className="mode-chips" aria-label="Data modes">
          <span className="demo-chip">Synthetic demo</span>
          {personalFacts !== null ? (
            <span className="personal-facts-chip">
              Personal facts · read only
            </span>
          ) : personalQualityReady ? (
            <span className="personal-readiness-chip">
              Personal quality ready · data off
            </span>
          ) : null}
        </div>
      </header>

      <div className="demo-disclosure" role="note">
        <strong>
          {personalFacts === null
            ? "Fictional dataset."
            : "Fictional dossier below."}
        </strong>{" "}
        {dossier.demoDisclosure}
      </div>

      <main className="research-shell" id="main-content">
        {personalMode ? (
          <OwnerSessionPanel onSessionChange={handleOwnerSessionChange} />
        ) : null}
        {personalFacts === null ? null : (
          <PersonalFilingFacts release={personalFacts} />
        )}
        <section className="dossier-hero" aria-labelledby="company-title">
          <div className="company-identity">
            <span className="ticker-mark" aria-hidden="true">
              N
            </span>
            <div>
              <div className="identity-line">
                <span>{dossier.instrument.symbol}</span>
                <span>{dossier.instrument.exchangeLabel}</span>
                <span>{dossier.instrument.currency}</span>
              </div>
              <h1 id="company-title">{dossier.instrument.name}</h1>
              <p>{dossier.instrument.description}</p>
            </div>
          </div>
          <div className="identity-meta">
            <span>{dossier.instrument.sector}</span>
            <span>{dossier.instrument.industry}</span>
            <span>{dossier.instrument.country}</span>
          </div>
        </section>

        <section className="known-time-bar" aria-labelledby="known-time-title">
          <div>
            <span className="eyebrow" id="known-time-title">
              Information known at
            </span>
            <strong>{formatKnownAt(dossier.requestedKnownAt)}</strong>
          </div>
          <div
            className="time-switch"
            aria-label="Historical information views"
          >
            <Link
              className={!restatementVisible ? "active" : ""}
              href={`/research/${encodeURIComponent(symbol)}?knownAt=${encodeURIComponent(PRE_RESTATEMENT_KNOWN_AT)}`}
            >
              Before restatement
            </Link>
            <Link
              className={restatementVisible ? "active" : ""}
              href={`/research/${encodeURIComponent(symbol)}?knownAt=${encodeURIComponent(DEFAULT_KNOWN_AT)}`}
            >
              Current fixture
            </Link>
          </div>
          <p>
            {restatementVisible
              ? "The May 2026 synthetic restatement is included."
              : "Only information available before the synthetic restatement is included."}
          </p>
        </section>

        <section
          className="workspace-section"
          id="observe"
          aria-labelledby="observe-title"
        >
          <div className="section-heading split-heading">
            <div>
              <p className="section-number">01 · Observe</p>
              <h2 id="observe-title">Start with the record, not the story.</h2>
            </div>
            <p>
              Open any metric to see its definition, formula, evidence locator,
              known time, and rights policy.
            </p>
          </div>
          <MetricGrid metrics={dossier.metrics} onInspect={setSelection} />

          <div className="analysis-layout">
            <article className="analysis-card chart-card">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">Operating record</span>
                  <h3>Revenue and adjusted EBITDA</h3>
                </div>
                <span className="unit-label">USD millions</span>
              </div>
              <AnalyticalChart
                history={dossier.history}
                onInspect={setSelection}
              />
            </article>

            <aside className="timeline-card" aria-labelledby="timeline-title">
              <div className="card-heading">
                <div>
                  <span className="eyebrow">As-known timeline</span>
                  <h3 id="timeline-title">What entered the record</h3>
                </div>
              </div>
              <ol className="event-list">
                {dossier.timeline.map((event) => (
                  <li
                    key={event.id}
                    className={
                      event.kind === "restatement" ? "restatement-event" : ""
                    }
                  >
                    <time dateTime={event.occurredAt}>
                      {formatShortDate(event.occurredAt)}
                    </time>
                    <h4>{event.title}</h4>
                    <p>{event.summary}</p>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() =>
                        setSelection({
                          title: event.title,
                          formula:
                            "Timeline event backed by a display-authorized synthetic record",
                          formulaInputs: [],
                          evidenceIds: event.evidenceIds,
                        })
                      }
                    >
                      Inspect record
                    </button>
                  </li>
                ))}
              </ol>
              <div className="rights-summary">
                <span>Server-side rights filter</span>
                <strong>{formatOmissionSummary(dossier.omissions)}</strong>
                <p>{dossier.omissions.explanation}</p>
              </div>
            </aside>
          </div>
        </section>

        <ValuationWorkbench dossier={dossier} onInspect={setSelection} />
        <ThesisMonitor dossier={dossier} />
      </main>

      <footer className="app-footer">
        <span>Research Cockpit · internal working name</span>
        <span>Deterministic synthetic fixtures · not investment advice</span>
        <code>schema {dossier.schemaVersion}</code>
      </footer>
      <EvidenceDialog
        selection={selection}
        evidence={dossier.evidence}
        onClose={closeEvidence}
      />
    </>
  );
}

function formatOmissionSummary(omissions: DossierDto["omissions"]): string {
  if (!omissions.hasOmissions) return "No eligible fields withheld";
  if (omissions.count === null)
    return "Fields withheld · exact count unavailable";
  return `${omissions.count} field${omissions.count === 1 ? "" : "s"} withheld`;
}

function formatKnownAt(value: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
  return `${formatted} UTC`;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
