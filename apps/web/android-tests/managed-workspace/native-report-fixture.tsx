import { registerPlugin } from "@capacitor/core";
import { useSyncExternalStore } from "react";
import {
  createNativeCompanyReportAdapter,
  type InvestmentCompanyReportPlugin,
  type InvestmentCompanyReportHtmlPlugin,
} from "../../src/clerk-trial/native-company-report";
import {
  COMPANY_REPORT_DOCUMENT_MAX_BYTES,
  isCompanyReportDocument,
  type CompanyReportDocument,
} from "../../src/clerk-trial/managed-company-report-document";
import type { ManagedWorkspace } from "../../src/clerk-trial/managed-workspace";

export type ReportProbeKind =
  "maximum" | "oversize" | "unicode" | "purpose" | "filename";

/** Invented handoff-boundary input, not a model-admitted financial report. */
export function reportProbeDocument(
  kind: ReportProbeKind,
): CompanyReportDocument {
  const prefix =
    '{"purpose":"investment.company-research","schemaVersion":"6.0.0","preparedAt":"2026-10-15T00:00:00.000Z","listing":{"symbol":"ZERO","exchangeMic":"XNAS"},"authoredResearch":{"note":"Café 東京 📈"},"padding":"';
  const suffix = '"}\n';
  const encoder = new TextEncoder();
  let text =
    prefix +
    "x".repeat(
      COMPANY_REPORT_DOCUMENT_MAX_BYTES -
        encoder.encode(prefix + suffix).byteLength,
    ) +
    suffix;
  if (kind === "oversize") text += " ";
  if (kind === "unicode") text = text.replace("📈", "\ud800");
  if (kind === "purpose")
    text = text.replace(
      "investment.company-research",
      "investment.saved-watchlist",
    );
  if (kind === "filename")
    text = text.replace('"symbol":"ZERO"', '"symbol":"BETA"');
  return {
    purpose: "investment.company-research",
    filename: "Investment-research-ZERO-XNAS-20261015T000000000Z.json",
    text,
    byteLength: encoder.encode(text).byteLength,
  };
}

interface ProbeState {
  kind: ReportProbeKind | null;
  phase: "idle" | "preparing" | "choosing" | "writing" | "settled";
  byteLength: number;
  sha256: string | null;
  outcome: "written" | "refused" | "cancelled" | null;
  error: string | null;
}

export function createNativeReportProbe(
  plugin: InvestmentCompanyReportPlugin,
  publish: (state: ProbeState) => void,
) {
  let busy = false;
  return async (kind: ReportProbeKind) => {
    if (busy) return;
    busy = true;
    const operationId = crypto.randomUUID();
    let state: ProbeState = {
      kind,
      phase: "preparing",
      byteLength: 0,
      sha256: null,
      outcome: null,
      error: null,
    };
    const update = (change: Partial<ProbeState>) => {
      state = { ...state, ...change };
      publish(state);
    };
    publish(state);
    try {
      const document = reportProbeDocument(kind);
      const bytes = new TextEncoder().encode(document.text);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      if (kind === "maximum" && !isCompanyReportDocument(document))
        throw new Error();
      update({ phase: "choosing", byteLength: bytes.length, sha256 });
      const choice = await plugin.choose({
        operationId,
        purpose: document.purpose,
        filename: document.filename,
      });
      if (choice.status !== "chosen") {
        update({ outcome: "cancelled" });
        return;
      }
      update({ phase: "writing" });
      try {
        const result = await plugin.write({
          operationId,
          handle: choice.handle,
          text: document.text,
        });
        if (result.status !== "written") throw new Error();
        update({
          outcome: "written",
          error: kind === "maximum" ? null : "invalid_write_succeeded",
        });
      } catch (error) {
        const code =
          error instanceof Object && "code" in error ? error.code : null;
        const expected =
          kind !== "maximum" &&
          (code === "invalid_input" || code === "write_failed");
        update({
          outcome: "refused",
          error: expected ? null : "unexpected_write_refusal",
        });
      }
    } catch {
      update({ error: "probe_failed" });
    } finally {
      try {
        await plugin.cancel({ operationId });
      } catch {
        update({ error: "cleanup_failed" });
      }
      busy = false;
      update({ phase: "settled" });
    }
  };
}

/** Test APK only: uses the real plugin and chosen provider, with metadata-only diagnostics. */
export function createNativeReportFixture() {
  const plugin = registerPlugin<InvestmentCompanyReportPlugin>(
    "InvestmentCompanyReport",
  );
  const htmlPlugin = registerPlugin<InvestmentCompanyReportHtmlPlugin>(
    "InvestmentCompanyReportHtml",
  );
  const listeners = new Set<() => void>();
  let state = {
    mismatchRefused: 0,
    duplicateRefused: 0,
    replayRefused: 0,
    writesSettled: 0,
    cancelsSettled: 0,
    protocolError: false,
    html: { choicesStarted: 0, writesSettled: 0, cancelsSettled: 0 },
    choice: null as { operationId: string; handle: string } | null,
    probe: {
      kind: null,
      phase: "idle",
      byteLength: 0,
      sha256: null,
      outcome: null,
      error: null,
    } as ProbeState,
  };
  const update = (change: Partial<typeof state>) => {
    state = { ...state, ...change };
    for (const listener of listeners) listener();
  };
  const updateHtml = (change: Partial<typeof state.html>) =>
    update({ html: { ...state.html, ...change } });
  let afterChoice: (() => void) | null = null;
  let lastWrite: Parameters<InvestmentCompanyReportPlugin["write"]>[0] | null =
    null;
  const refused = async (action: () => Promise<unknown>, code: string) => {
    try {
      await action();
      return false;
    } catch (error) {
      return error instanceof Object && "code" in error && error.code === code;
    }
  };
  const delivery = createNativeCompanyReportAdapter(
    {
      choose: async (options) => {
        const choice = await plugin.choose(options);
        if (choice.status === "chosen") {
          const wrongOperation = await refused(
            () =>
              plugin.write({
                operationId: crypto.randomUUID(),
                handle: choice.handle,
                text: "must not write",
              }),
            "invalid_handle",
          );
          const wrongHandle = await refused(
            () =>
              plugin.write({
                operationId: options.operationId,
                handle: crypto.randomUUID(),
                text: "must not write",
              }),
            "invalid_handle",
          );
          const duplicate = await refused(
            () =>
              plugin.choose({ ...options, operationId: crypto.randomUUID() }),
            "busy",
          );
          update({
            mismatchRefused:
              state.mismatchRefused +
              Number(wrongOperation) +
              Number(wrongHandle),
            duplicateRefused: state.duplicateRefused + Number(duplicate),
            protocolError:
              state.protocolError ||
              !wrongOperation ||
              !wrongHandle ||
              !duplicate,
          });
          const callback = afterChoice;
          afterChoice = null;
          callback?.();
        }
        return choice;
      },
      write: async (options) => {
        try {
          const result = await plugin.write(options);
          lastWrite = { ...options };
          return result;
        } finally {
          update({ writesSettled: state.writesSettled + 1 });
        }
      },
      cancel: async (options) => {
        try {
          await plugin.cancel(options);
        } finally {
          update({ cancelsSettled: state.cancelsSettled + 1 });
        }
      },
    },
    {
      choose: async (options) => {
        updateHtml({ choicesStarted: state.html.choicesStarted + 1 });
        const choice = await htmlPlugin.choose(options);
        if (choice.status === "chosen") {
          const callback = afterChoice;
          afterChoice = null;
          callback?.();
        }
        return choice;
      },
      write: async (options) => {
        try {
          return await htmlPlugin.write(options);
        } finally {
          updateHtml({ writesSettled: state.html.writesSettled + 1 });
        }
      },
      cancel: async (options) => {
        try {
          await htmlPlugin.cancel(options);
        } finally {
          updateHtml({ cancelsSettled: state.html.cancelsSettled + 1 });
        }
      },
    },
  );
  const probe = createNativeReportProbe(plugin, (probe) => update({ probe }));
  function Controls({ workspace }: { workspace: ManagedWorkspace }) {
    const current = useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => state,
    );
    return (
      <section aria-label="Native report fixture controls">
        <button
          id="fixture-report-choose-only"
          onClick={() => {
            const operationId = crypto.randomUUID();
            const document = reportProbeDocument("maximum");
            void plugin
              .choose({
                operationId,
                purpose: document.purpose,
                filename: document.filename,
              })
              .then((choice) => {
                if (choice.status === "chosen")
                  update({ choice: { operationId, handle: choice.handle } });
              });
          }}
        >
          Choose report destination without writing
        </button>
        <button
          id="fixture-report-replay"
          onClick={() => {
            const captured = lastWrite;
            if (captured)
              void refused(() => plugin.write(captured), "invalid_handle").then(
                (ok) =>
                  update({
                    replayRefused: state.replayRefused + Number(ok),
                    protocolError: state.protocolError || !ok,
                  }),
              );
          }}
        >
          Probe consumed report handle
        </button>
        <button
          id="fixture-report-edit"
          onClick={() => {
            afterChoice = () =>
              workspace.note("listing-zero", "Changed after report choice");
          }}
        >
          Edit note after report choice
        </button>
        <button
          id="fixture-report-retire"
          onClick={() => {
            afterChoice = () => workspace.coordinator.retire();
          }}
        >
          Retire after report choice
        </button>
        {(
          ["maximum", "oversize", "unicode", "purpose", "filename"] as const
        ).map((kind) => (
          <button
            key={kind}
            id={`fixture-report-${kind}`}
            disabled={
              current.probe.phase !== "idle" &&
              current.probe.phase !== "settled"
            }
            onClick={() => {
              void probe(kind);
            }}
          >
            Probe report {kind}
          </button>
        ))}
        <pre
          id="fixture-report-protocol"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {JSON.stringify(current)}
        </pre>
      </section>
    );
  }
  return { delivery, Controls };
}
