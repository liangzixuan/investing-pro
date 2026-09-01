import Link from "next/link";
import { redirect } from "next/navigation";

import { isPersonalDossierWebMode } from "@/lib/web-mode";

export const dynamic = "force-dynamic";

export default function HomePage() {
  if (isPersonalDossierWebMode(process.env.RESEARCH_COCKPIT_WEB_MODE)) {
    redirect("/personal");
  }

  return (
    <main className="landing-shell">
      <div className="landing-grid" aria-hidden="true" />
      <header className="landing-header">
        <div className="wordmark">
          <span>RC</span> Research Cockpit
        </div>
        <span className="demo-chip">Synthetic demo</span>
      </header>
      <section className="landing-hero">
        <p className="eyebrow">Evidence before opinion</p>
        <h1>Research a company without losing the trail.</h1>
        <p className="landing-copy">
          Inspect every number, replay a restatement, test a transparent
          valuation, record a thesis, and define a monitoring rule in one quiet
          workspace.
        </p>
        <div className="landing-actions">
          <Link className="primary-action" href="/research/SYN1">
            Open the synthetic dossier <span aria-hidden="true">→</span>
          </Link>
          <span>No account · no market data · no external alerts</span>
        </div>
      </section>
      <section className="principle-grid" aria-label="Product principles">
        <article>
          <b>01</b>
          <h2>Trace</h2>
          <p>
            Every number opens its source, known time, rights policy, and
            formula.
          </p>
        </article>
        <article>
          <b>02</b>
          <h2>Rewind</h2>
          <p>
            See only the information that was available at a selected historical
            instant.
          </p>
        </article>
        <article>
          <b>03</b>
          <h2>Commit</h2>
          <p>
            Turn observations into explicit assumptions, risks, and invalidation
            conditions.
          </p>
        </article>
      </section>
    </main>
  );
}
