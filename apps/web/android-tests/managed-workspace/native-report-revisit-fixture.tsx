import { registerPlugin } from "@capacitor/core";
import { useState } from "react";
import { createFixture } from "./fixture";
import { reportRevisitDocument } from "./report-revisit-fixture";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
  type InvestmentCompanyReportHtmlPlugin,
} from "../../src/clerk-trial/native-company-report";

/** Instrumentation-only explicit invented archive writer through the existing system picker. */
export function NativeReportRevisitFixture() {
  const [state, setState] = useState({
    phase: "idle",
    filename: "",
    byteLength: 0,
  });
  return (
    <aside aria-label="Invented report revisit file">
      <button
        id="fixture-revisit-save"
        disabled={state.phase !== "idle"}
        onClick={() => {
          setState({ ...state, phase: "preparing" });
          void (async () => {
            const document = await reportRevisitDocument(
              await createFixture("company-snapshot"),
            );
            setState({
              phase: "choosing",
              filename: document.filename,
              byteLength: document.byteLength,
            });
            const adapter = createNativeCompanyReportAdapter(
              registerPlugin<InvestmentCompanyReportPlugin>(
                "InvestmentCompanyReport",
              ),
              registerPlugin<InvestmentCompanyReportHtmlPlugin>(
                "InvestmentCompanyReportHtml",
              ),
            );
            const result = await adapter.deliver(document, {
              isCurrent: () => true,
              signal: new AbortController().signal,
            });
            setState({
              phase: result,
              filename: document.filename,
              byteLength: document.byteLength,
            });
          })().catch(() =>
            setState((previous) => ({ ...previous, phase: "failed" })),
          );
        }}
      >
        Save invented archived report
      </button>
      <pre id="fixture-revisit-file" hidden>
        {JSON.stringify(state)}
      </pre>
    </aside>
  );
}
