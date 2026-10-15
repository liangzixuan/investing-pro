import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { SecAnnualBalanceSheetValueContent } from "../features/research/SecAnnualBalanceSheet";

const metrics = [
  ["totalAssets", "Total assets"],
  ["totalLiabilities", "Total liabilities"],
  ["shareholdersEquity", "Shareholders’ equity · parent"],
] as const;

export function ManagedAnnualBalanceSheetComparisonRows({
  responses,
}: {
  readonly responses: Readonly<
    Record<"left" | "right", PersonalSecAnnualEvidenceResponseDto | null>
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
            return (
              <td key={side}>
                {response ? (
                  <SecAnnualBalanceSheetValueContent
                    value={response.evidence.balanceSheet.resolution[metric]}
                  />
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
