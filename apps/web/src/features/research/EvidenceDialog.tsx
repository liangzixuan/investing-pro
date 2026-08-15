"use client";

import type { EvidencePassportDto } from "@research-cockpit/contracts";
import { useEffect, useMemo, useRef } from "react";

import type { EvidenceSelection } from "./evidence-selection";

export function EvidenceDialog({
  selection,
  evidence,
  onClose,
}: {
  selection: EvidenceSelection | null;
  evidence: EvidencePassportDto[];
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const selectedEvidence = useMemo(
    () => evidence.filter((item) => selection?.evidenceIds.includes(item.id)),
    [evidence, selection],
  );

  useEffect(() => {
    if (!selection) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [onClose, selection]);

  if (!selection) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="evidence-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-title"
      >
        <header>
          <div>
            <p className="eyebrow">Evidence passport</p>
            <h2 id="evidence-title">{selection.title}</h2>
          </div>
          <button
            ref={closeButton}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close evidence passport"
          >
            ×
          </button>
        </header>
        <div className="formula-card">
          <span>Definition / formula</span>
          <strong>{selection.formula}</strong>
          {selection.formulaInputs.length > 0 && (
            <code>{selection.formulaInputs.join(" · ")}</code>
          )}
        </div>
        <div className="evidence-stack">
          {selectedEvidence.map((item) => (
            <article className="evidence-record" key={item.id}>
              <div className="record-heading">
                <h3>{item.title}</h3>
                <span>Synthetic</span>
              </div>
              <blockquote>{item.excerpt}</blockquote>
              <dl>
                <div>
                  <dt>Document</dt>
                  <dd>{item.documentId}</dd>
                </div>
                <div>
                  <dt>Locator</dt>
                  <dd>{item.locator}</dd>
                </div>
                <div>
                  <dt>Known from</dt>
                  <dd>{formatDateTime(item.knownFrom)}</dd>
                </div>
                <div>
                  <dt>Known to</dt>
                  <dd>
                    {item.knownTo
                      ? formatDateTime(item.knownTo)
                      : "Current in fixture"}
                  </dd>
                </div>
                <div>
                  <dt>Rights policy</dt>
                  <dd>
                    {item.rightsPolicyId} · {item.rightsPolicyVersion}
                  </dd>
                </div>
                <div>
                  <dt>Content hash</dt>
                  <dd>
                    <code>{item.contentHash}</code>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          {selectedEvidence.length === 0 && (
            <p>No display-authorized evidence is available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: string): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
  return `${formatted} UTC`;
}
