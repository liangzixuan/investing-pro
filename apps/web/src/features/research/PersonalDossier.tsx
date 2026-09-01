import type { PersonalFilingDossierDto } from "@research-cockpit/contracts";

export function PersonalDossier({
  dossier,
}: {
  readonly dossier: PersonalFilingDossierDto;
}) {
  const factsById = new Map(dossier.facts.map((fact) => [fact.id, fact]));
  const currentFacts = dossier.facts.filter(
    (fact) => fact.version === "current",
  );

  return (
    <div className="personal-dossier" data-personal-dossier="true">
      <section
        className="personal-dossier-hero"
        aria-labelledby="personal-dossier-title"
      >
        <div>
          <p className="eyebrow">Authenticated personal filing snapshot</p>
          <h1 id="personal-dossier-title">Personal filing dossier</h1>
          <p>
            One startup-fixed, owner-authorized snapshot. Values remain in
            memory only and are never combined with the synthetic demo.
          </p>
        </div>
        <div className="personal-dossier-as-of">
          <span>Snapshot known at</span>
          <time dateTime={dossier.asOf}>{dossier.asOf}</time>
        </div>
      </section>

      <section
        className="personal-dossier-section"
        aria-labelledby="personal-facts-title"
      >
        <div className="section-heading split-heading">
          <div>
            <p className="section-number">01 · Observe</p>
            <h2 id="personal-facts-title">Current admitted facts</h2>
          </div>
          <p>
            Every value resolves to one evidence passport in this same response.
          </p>
        </div>
        <dl className="personal-dossier-facts">
          {currentFacts.map((fact) => (
            <div className="personal-dossier-fact" key={fact.id}>
              <dt>{fact.label}</dt>
              <dd>
                <strong>{fact.value}</strong>
                <span>{fact.unit}</span>
              </dd>
              <small>
                {fact.periodStart === null
                  ? `At ${fact.periodEnd}`
                  : `${fact.periodStart} — ${fact.periodEnd}`}
              </small>
              <a href={`#${fact.evidenceId}`}>View evidence</a>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="personal-dossier-section"
        aria-labelledby="personal-chart-title"
      >
        <div className="section-heading split-heading">
          <div>
            <p className="section-number">02 · Compare</p>
            <h2 id="personal-chart-title">Admitted filing chart</h2>
          </div>
          <p>
            Chart points reference the fact registry; values are not copied.
          </p>
        </div>
        {dossier.chart.status === "unsupported" ? (
          <UnsupportedState
            title="Chart unavailable"
            reason="No owner-approved chart facts are in this release."
          />
        ) : (
          <div
            className="personal-chart"
            role="img"
            aria-label="Personal filing fact versions"
          >
            {dossier.chart.series.map((series) => (
              <article className="personal-chart-series" key={series.key}>
                <header>
                  <h3>{series.label}</h3>
                  <span>{series.unit}</span>
                </header>
                <ol>
                  {series.points.map(({ factId }) => {
                    const fact = factsById.get(factId);
                    if (fact === undefined) return null;
                    return (
                      <li key={fact.id}>
                        <span aria-hidden="true" />
                        <div>
                          <strong>{fact.value}</strong>
                          <small>
                            {fact.version === "current"
                              ? "Current"
                              : "Superseded"}
                            {` · known ${fact.knownFrom}`}
                          </small>
                          <a href={`#${fact.evidenceId}`}>Evidence</a>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="personal-dossier-section personal-composition-grid"
        aria-label="Lineage and valuation inputs"
      >
        <article className="personal-lineage-card">
          <p className="section-number">03 · Trace</p>
          <h2>Restatement lineage</h2>
          <p className="personal-state-label">
            {dossier.lineage.status === "amendment_supersession_observed"
              ? "Amendment supersession observed"
              : "Root filing only in the admitted manifest"}
          </p>
          {dossier.lineage.events.length === 0 ? (
            <p>No in-corpus amendment edge is present.</p>
          ) : (
            <ol className="personal-lineage-list">
              {dossier.lineage.events.map((event) => {
                const predecessor = factsById.get(event.predecessorFactId);
                const successor = factsById.get(event.successorFactId);
                if (predecessor === undefined || successor === undefined) {
                  return null;
                }
                return (
                  <li key={`${event.key}:${event.effectiveAt}`}>
                    <time dateTime={event.effectiveAt}>
                      {event.effectiveAt}
                    </time>
                    <strong>{successor.label}</strong>
                    <span>
                      {predecessor.value} → {successor.value} {successor.unit}
                    </span>
                    <span>
                      <a href={`#${predecessor.evidenceId}`}>Prior evidence</a>
                      {" · "}
                      <a href={`#${successor.evidenceId}`}>Current evidence</a>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </article>

        <article className="personal-valuation-card">
          <p className="section-number">04 · Value</p>
          <h2>Valuation inputs</h2>
          {dossier.valuationInputs.status === "unsupported" ? (
            <UnsupportedState
              title="Valuation unavailable"
              reason={
                dossier.valuationInputs.reasonCode ===
                "REQUIRED_FACTS_NOT_RELEASED"
                  ? "Required facts are outside this owner-approved release."
                  : "One or more admitted inputs are outside the model domain."
              }
            />
          ) : (
            <dl className="personal-valuation-inputs">
              {(
                [
                  ["Base revenue", dossier.valuationInputs.baseRevenueFactId],
                  ["Cash", dossier.valuationInputs.cashFactId],
                  ["Debt", dossier.valuationInputs.debtFactId],
                  [
                    "Diluted shares",
                    dossier.valuationInputs.dilutedSharesFactId,
                  ],
                ] as const
              ).map(([label, factId]) => {
                const fact = factsById.get(factId);
                if (fact === undefined) return null;
                return (
                  <div key={factId}>
                    <dt>{label}</dt>
                    <dd>
                      {fact.value} {fact.unit}
                    </dd>
                    <a href={`#${fact.evidenceId}`}>Evidence</a>
                  </div>
                );
              })}
            </dl>
          )}
        </article>
      </section>

      <section
        className="personal-dossier-section personal-omissions"
        aria-labelledby="personal-omissions-title"
      >
        <p className="section-number">05 · Scope</p>
        <h2 id="personal-omissions-title">Omissions and unsupported scope</h2>
        <strong>
          {dossier.omissions.hasOmissions
            ? "The owner-fixed scope has omissions."
            : "No omission is declared for the owner-fixed scope."}
        </strong>
        <p>{dossier.omissions.explanation}</p>
        <small>Exact hidden counts are not disclosed.</small>
      </section>

      <section
        className="personal-dossier-section"
        aria-labelledby="personal-evidence-title"
      >
        <div className="section-heading split-heading">
          <div>
            <p className="section-number">06 · Verify</p>
            <h2 id="personal-evidence-title">Evidence passports</h2>
          </div>
          <p>
            Private provenance is available only inside this authenticated,
            noncacheable response.
          </p>
        </div>
        <div className="personal-evidence-grid">
          {dossier.evidence.map((evidence) => {
            const fact = factsById.get(evidence.factId);
            if (fact === undefined) return null;
            return (
              <article
                className="personal-evidence-passport"
                id={evidence.id}
                key={evidence.id}
              >
                <header>
                  <div>
                    <span className="eyebrow">SEC filing evidence</span>
                    <h3>{fact.label}</h3>
                  </div>
                  <span>{fact.version}</span>
                </header>
                <dl>
                  <EvidenceField
                    label="Accession"
                    value={evidence.sourceAccession}
                  />
                  <EvidenceField
                    label="Concept"
                    value={evidence.sourceConcept ?? "Derived"}
                  />
                  <EvidenceField label="Taxonomy" value={evidence.taxonomy} />
                  <EvidenceField
                    label="Accepted"
                    value={evidence.sourceAcceptedAt}
                  />
                  <EvidenceField
                    label="Available"
                    value={evidence.sourceAvailableAt}
                  />
                  <EvidenceField
                    label="Known to"
                    value={fact.knownToExclusive ?? "Current in admitted scope"}
                  />
                  <EvidenceField
                    label="Content digest"
                    value={evidence.sourceContentSha256}
                  />
                  <EvidenceField
                    label="Document digest"
                    value={evidence.sourceDocumentSha256}
                  />
                  {evidence.derivationFormula === null ? null : (
                    <>
                      <EvidenceField
                        label="Derivation"
                        value={evidence.derivationFormula}
                      />
                      {evidence.derivationOperands.map((operand) => (
                        <EvidenceField
                          key={operand.role}
                          label={
                            operand.role === "minuend"
                              ? "Minuend operand"
                              : "Subtrahend operand"
                          }
                          value={`${operand.concept} · ${operand.value} ${operand.unit}`}
                        />
                      ))}
                    </>
                  )}
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EvidenceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function UnsupportedState({
  title,
  reason,
}: {
  title: string;
  reason: string;
}) {
  return (
    <div className="personal-unsupported" role="note">
      <strong>{title}</strong>
      <p>{reason}</p>
    </div>
  );
}
