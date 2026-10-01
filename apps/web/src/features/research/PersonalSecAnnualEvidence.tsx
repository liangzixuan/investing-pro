"use client";

import type { PersonalSecAnnualEvidenceResponseDto } from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

import { fetchPersonalSecAnnualEvidence } from "../../lib/personal-sec-annual-evidence-api";
import { PersonalWorkspaceApiError } from "../../lib/personal-workspace-api";
import type { PersonalMarketSelection } from "./PersonalMarketOverview";
import { SecAnnualEvidenceResult } from "./SecAnnualEvidenceResult";

export interface PersonalSecAnnualEvidenceProps {
  readonly catalogSnapshotSha256: `sha256:${string}`;
  readonly selection: PersonalMarketSelection | null;
  readonly enabled: boolean;
  readonly onSessionUnavailable: () => void;
}

const initialMessage =
  "Load the observed annual report explicitly to inspect its SEC inputs.";

export function PersonalSecAnnualEvidence({
  catalogSnapshotSha256,
  selection,
  enabled,
  onSessionUnavailable,
}: PersonalSecAnnualEvidenceProps) {
  const key = JSON.stringify([catalogSnapshotSha256, selection, enabled]);
  const context = useRef({ key, version: 0 });
  if (context.current.key !== key) {
    context.current = { key, version: context.current.version + 1 };
  }
  const version = context.current.version;
  const [state, setState] = useState<{
    version: number;
    response: PersonalSecAnnualEvidenceResponseDto | null;
    running: boolean;
    message: string;
    error: boolean;
  }>({
    version,
    response: null,
    running: false,
    message: initialMessage,
    error: false,
  });
  const epoch = useRef(0);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sessionCallback = useRef(onSessionUnavailable);
  sessionCallback.current = onSessionUnavailable;
  const loadButton = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<{
    version: number;
    epoch: number;
    origin: HTMLButtonElement;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    epoch.current += 1;
    controller.current?.abort();
    controller.current = null;
    pendingFocus.current = null;
    setState({
      version,
      response: null,
      running: false,
      message: initialMessage,
      error: false,
    });
    return () => {
      mounted.current = false;
      epoch.current += 1;
      controller.current?.abort();
      controller.current = null;
      pendingFocus.current = null;
    };
  }, [version]);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null || state.running) return;
    pendingFocus.current = null;
    const button = loadButton.current;
    if (
      mounted.current &&
      enabled &&
      selection !== null &&
      pending.version === context.current.version &&
      pending.epoch === epoch.current &&
      button?.isConnected &&
      !button.closest("[hidden]") &&
      (document.activeElement === pending.origin ||
        document.activeElement === document.body)
    ) {
      button.focus();
    }
  }, [state, enabled, selection]);

  const currentContext =
    enabled && selection !== null && state.version === version;
  const current = currentContext ? state.response : null;
  const running = currentContext && state.running;
  const renderEpoch = epoch.current;
  const isCurrentRender = () =>
    mounted.current &&
    enabled &&
    selection !== null &&
    context.current.version === version &&
    epoch.current === renderEpoch;

  async function load() {
    if (
      !isCurrentRender() ||
      selection === null ||
      controller.current !== null ||
      state.version !== version
    )
      return;
    pendingFocus.current = null;
    const operation = ++epoch.current;
    const abort = new AbortController();
    controller.current = abort;
    setState({
      version,
      response: null,
      running: true,
      message: `Loading the observed annual report for ${selection.symbol}…`,
      error: false,
    });
    const valid = () =>
      mounted.current &&
      context.current.version === version &&
      operation === epoch.current &&
      !abort.signal.aborted;
    try {
      const response = await fetchPersonalSecAnnualEvidence(
        {
          schemaVersion: "1.0.0",
          catalogSnapshotSha256,
          listingId: selection.listingId,
          symbol: selection.symbol,
        },
        abort.signal,
      );
      if (!valid()) return;
      if (
        response.catalogSnapshotSha256 !== catalogSnapshotSha256 ||
        !sameSelection(response.security, selection)
      )
        throw new PersonalWorkspaceApiError("invalid_response");
      setState({
        version,
        response,
        running: false,
        message: `Annual SEC response loaded for ${selection.symbol}. Refresh explicitly to check again.`,
        error: false,
      });
    } catch (caught) {
      if (!valid()) return;
      const code =
        caught instanceof PersonalWorkspaceApiError
          ? caught.code
          : "unavailable";
      setState({
        version,
        response: null,
        running: false,
        error: true,
        message: errorMessage(code),
      });
      if (code === "session_unavailable") sessionCallback.current();
    } finally {
      if (valid()) controller.current = null;
    }
  }

  function cancel(origin: HTMLButtonElement) {
    if (!isCurrentRender() || !running || controller.current === null) return;
    epoch.current += 1;
    controller.current.abort();
    controller.current = null;
    pendingFocus.current =
      document.activeElement === origin
        ? { version, epoch: epoch.current, origin }
        : null;
    setState({
      version,
      response: null,
      running: false,
      message: "Annual report load cancelled. Load again when ready.",
      error: false,
    });
  }

  return (
    <section
      className="personal-financials-panel personal-sec-quarterly-evidence"
      aria-labelledby="sec-annual-evidence-title"
      aria-busy={running}
    >
      <div className="discovery-section-heading personal-financials-heading">
        <div>
          <p className="eyebrow">Selected-company SEC research</p>
          <h2 id="sec-annual-evidence-title">Observed annual SEC report</h2>
        </div>
        <span>Revenue · Net income · Net margin · USD</span>
      </div>
      <p className="market-scope-note">
        Uses the annual report observed in current SEC submissions, not complete
        filing history or point-in-time evidence. Revenue concepts remain
        separate. Loading makes no change to saved research.
      </p>
      {!enabled ? (
        <p className="discovery-warning">
          Revalidate the owner session to load an annual SEC report.
        </p>
      ) : selection === null ? (
        <p className="discovery-empty-state">
          Choose a company to inspect its observed annual report.
        </p>
      ) : (
        <>
          <div className="sec-quarterly-actions">
            <button
              ref={loadButton}
              className="primary-action compact-action"
              type="button"
              disabled={running || state.version !== version}
              onClick={() => void load()}
            >
              {running
                ? "Loading annual report…"
                : current === null
                  ? "Load observed annual report"
                  : "Refresh annual report"}
            </button>
            {running ? (
              <button
                type="button"
                onClick={(event) => cancel(event.currentTarget)}
              >
                Cancel annual report
              </button>
            ) : null}
          </div>
          <p
            className={
              currentContext && state.error
                ? "market-message market-message-error"
                : "sec-quarterly-message"
            }
            role={currentContext && state.error ? "alert" : "status"}
          >
            {currentContext ? state.message : initialMessage}
          </p>
        </>
      )}
      {current === null ? null : (
        <SecAnnualEvidenceResult
          key={current.evidence.generation.sha256}
          response={current}
        />
      )}
    </section>
  );
}

function sameSelection(
  security: PersonalSecAnnualEvidenceResponseDto["security"],
  selection: PersonalMarketSelection,
) {
  return (
    security.country === selection.country &&
    security.exchangeMic === selection.exchangeMic &&
    security.issuerId === selection.issuerId &&
    security.issuerName === selection.issuerName &&
    security.listingId === selection.listingId &&
    security.securityName === selection.securityName &&
    security.symbol === selection.symbol
  );
}

function errorMessage(code: string): string {
  if (code === "session_unavailable")
    return "The owner session expired. Revalidate it to load annual SEC evidence.";
  if (code === "not_configured")
    return "SEC contact setup is required in local startup settings before loading.";
  if (code === "conflict")
    return "The catalog changed. Choose the company again before loading.";
  if (code === "not_covered")
    return "No supported SEC issuer binding is available for this company.";
  if (code === "rate_limited")
    return "SEC requests are rate limited. Load again later.";
  if (code === "invalid_response")
    return "The annual SEC response could not be validated. No report or values were retained.";
  return "Annual SEC evidence could not be loaded. Check source availability, then load again.";
}
