import type { PersonalFilingSelectedFactsDto } from "@research-cockpit/contracts";

const labels: Record<
  PersonalFilingSelectedFactsDto["facts"][number]["key"],
  string
> = {
  assets: "Assets",
  cash: "Cash",
  debt: "Debt",
  diluted_shares: "Diluted shares",
  free_cash_flow: "Free cash flow",
  gross_profit: "Gross profit",
  net_income: "Net income",
  operating_cash_flow: "Operating cash flow",
  operating_income: "Operating income",
  revenue: "Revenue",
};

export function PersonalFilingFacts({
  release,
}: {
  release: PersonalFilingSelectedFactsDto;
}) {
  return (
    <section
      className="personal-facts-panel"
      aria-labelledby="personal-facts-title"
    >
      <div className="personal-facts-heading">
        <div>
          <p className="eyebrow">Owner-approved local filing snapshot</p>
          <h2 id="personal-facts-title">Selected personal filing facts</h2>
        </div>
        <p>
          Read-only and memory-only. These values are kept separate from the
          fictional dossier below.
        </p>
      </div>
      <dl className="personal-facts-grid">
        {release.facts.map((fact) => (
          <div className="personal-fact" key={fact.key}>
            <dt>{labels[fact.key]}</dt>
            <dd>
              <strong>{fact.value}</strong>
              <span>{fact.unit}</span>
            </dd>
            <small>
              {fact.periodStart === null
                ? `At ${fact.periodEnd}`
                : `${fact.periodStart} — ${fact.periodEnd}`}
            </small>
          </div>
        ))}
      </dl>
    </section>
  );
}
