export function ManagedAnnualComparisonMethods() {
  return (
    <>
      <p className="managed-annual-comparison-help">
        Fiscal periods and balance dates can differ. Parent equity excludes
        noncontrolling interests.
      </p>
      <details className="managed-annual-comparison-methods">
        <summary>Calculation methods and comparison limits</summary>
        <p className="managed-annual-comparison-help">
          Operating margin divides reported operating income by the selected
          positive revenue for the same filing and exact period, then multiplies
          by 100. It is rounded to two decimal places, half up. Revenue bases
          stay separate; negative operating income is valid. This does not
          establish adjusted earnings, EBIT or EBITDA.
        </p>
        <p className="managed-annual-comparison-help">
          The app calculation subtracts purchases of property, plant and
          equipment from operating cash flow for the same filing and period. It
          does not adjust for leases, acquisitions or other investing cash
          flows. Cash generation relative to revenue divides that exact
          subtraction by each positive reported revenue basis and multiplies by
          100, rounded once to two decimal places, half up. All three inputs
          must have the same filing and exact period within that company. The
          three named bases stay separate from the selected income basis. Each
          company keeps its own fiscal period; these percentages do not rank
          companies or establish like-for-like performance.
        </p>
        <p className="managed-annual-comparison-help">
          Working capital subtracts current liabilities from current assets.
          Current ratio divides current assets by current liabilities and rounds
          to two decimal places, half up. Both calculations require nonnegative
          balances from the same filing and date; the ratio requires positive
          liabilities. Current assets are not all cash.
        </p>
        <p className="managed-annual-comparison-help">
          Balance sheet totals are independent reported amounts at each
          company’s own balance date. Parent equity excludes noncontrolling
          interests. Different fiscal dates and accounting policies can limit
          comparison. No balance equation or cross-company difference is
          inferred.
        </p>
      </details>
    </>
  );
}
