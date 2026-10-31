import { useSyncExternalStore } from "react";
import type { createNativePortfolioComparisonReportFixture } from "./native-portfolio-comparison-report-fixture";

export function PortfolioComparisonReportFixtureDiagnostics({
  delivery,
}: {
  delivery: ReturnType<typeof createNativePortfolioComparisonReportFixture>;
}) {
  const file = useSyncExternalStore(delivery.subscribe, delivery.getSnapshot);
  return (
    <pre id="fixture-portfolio-comparison-report-file" hidden>
      {JSON.stringify(file)}
    </pre>
  );
}
