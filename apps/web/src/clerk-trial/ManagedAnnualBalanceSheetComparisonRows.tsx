import type { PersonalSecAnnualCanonicalView } from "@research-cockpit/personal-financial-analytics";
import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import { SecAnnualBalanceSheetValueContent } from "../features/research/SecAnnualBalanceSheet";

const metrics = [
  ["totalAssets", "Total assets"],
  ["totalLiabilities", "Total liabilities"],
  ["shareholdersEquity", "Shareholders’ equity · parent"],
] as const;

export function ManagedAnnualBalanceSheetComparisonRows({
  responses,
  views,
}: {
  readonly responses: Readonly<
    Record<"left" | "right", PersonalSecAnnualCanonicalResponseDto | null>
  >;
  readonly views: Readonly<
    Record<"left" | "right", PersonalSecAnnualCanonicalView | null>
  >;
}) {
  return (
    <>
      {metrics.map(([metric, label]) => (
        <tr key={metric} data-annual-comparison-balance-sheet={metric}>
          <th scope="row">
            {label}
            <small>Reported · USD</small>
          </th>
          {(["left", "right"] as const).map((side) => {
            const response = responses[side];
            const view = views[side];
            const pairedView =
              response && view?.canonical === response.evidence ? view : null;
            return (
              <td key={side}>
                {pairedView ? (
                  <SecAnnualBalanceSheetValueContent
                    value={pairedView.balanceSheet.resolution[metric]}
                  />
                ) : response ? (
                  "Unavailable. The source and financial results do not match."
                ) : (
                  "Not loaded"
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
