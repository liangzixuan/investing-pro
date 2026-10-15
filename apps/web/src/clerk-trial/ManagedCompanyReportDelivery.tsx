import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PreparedCompanyReport } from "./managed-company-report";
import type { CompanyReportDeliveryAdapter } from "./company-report-delivery";
import { PreparedReportDelivery } from "./prepared-report-delivery";

const idle = { busy: false, message: "" };
const noSubscription = () => () => {};
const idleSnapshot = () => idle;

export function ManagedCompanyReportDelivery({
  report,
  delivery,
  isCurrent,
}: {
  report: PreparedCompanyReport;
  delivery: CompanyReportDeliveryAdapter;
  isCurrent: () => boolean;
}) {
  const latestCurrent = useRef(isCurrent);
  latestCurrent.current = isCurrent;
  const [model, setModel] = useState<PreparedReportDelivery | null>(null);
  useLayoutEffect(() => {
    const mounted = new PreparedReportDelivery(report, delivery, () =>
      latestCurrent.current(),
    );
    setModel(mounted);
    return () => mounted.retire();
  }, [report, delivery]);
  const owned = model?.report === report && model?.delivery === delivery;
  const state = useSyncExternalStore(
    model?.subscribe ?? noSubscription,
    model?.getSnapshot ?? idleSnapshot,
    idleSnapshot,
  );
  const native = delivery.destination === "system_document";
  return (
    <div className="managed-report-delivery">
      <p>
        {native
          ? "Choose a destination for the prepared sources and this company’s exact watchlist note, including unsaved edits. The saved file does not update with later edits."
          : "Download the prepared sources and this company’s exact watchlist note, including unsaved edits. The file stays at the download destination and does not update with later edits."}
      </p>
      <button
        type="button"
        className="trial-secondary"
        disabled={!owned || !isCurrent() || state.busy}
        onClick={() => {
          if (owned) void model.start();
        }}
      >
        {state.busy
          ? native
            ? "Saving report…"
            : "Requesting report download…"
          : native
            ? "Save report (JSON)"
            : "Download report (JSON)"}
      </button>
      {state.message && <p role="status">{state.message}</p>}
    </div>
  );
}
