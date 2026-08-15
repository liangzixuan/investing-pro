"use client";

import type {
  AlertEvaluationDto,
  AlertOperator,
  DossierDto,
  LocalAlertRuleDto,
  LocalThesisDto,
} from "@research-cockpit/contracts";
import { evaluateLocalAlert } from "@research-cockpit/research-core";
import { useEffect, useMemo, useState } from "react";

import {
  loadAlert,
  loadThesis,
  saveAlert,
  saveThesis,
} from "@/lib/local-state";

export function ThesisMonitor({ dossier }: { dossier: DossierDto }) {
  const [thesis, setThesis] = useState<LocalThesisDto>(() =>
    defaultThesis(dossier),
  );
  const [rule, setRule] = useState<LocalAlertRuleDto>(() =>
    defaultRule(dossier),
  );
  const [evaluation, setEvaluation] = useState<AlertEvaluationDto | null>(null);
  const [saveMessage, setSaveMessage] = useState(
    "Stored only in this browser.",
  );
  const [alertError, setAlertError] = useState<string | null>(null);

  useEffect(() => {
    setThesis(loadThesis(dossier.instrument.id) ?? defaultThesis(dossier));
    setRule(loadAlert(dossier.instrument.id) ?? defaultRule(dossier));
    setEvaluation(null);
    setAlertError(null);
  }, [dossier]);

  const selectedMetric = useMemo(
    () =>
      dossier.metrics.find((metric) => metric.key === rule.metricKey) ??
      dossier.metrics[0],
    [dossier.metrics, rule.metricKey],
  );

  function updateThesis(
    field: "claim" | "evidence" | "risks" | "invalidation",
    value: string,
  ) {
    setThesis((current) => ({ ...current, [field]: value }));
    setSaveMessage("Unsaved changes");
  }

  function persistThesis() {
    const updated = { ...thesis, updatedAt: dossier.generatedAt };
    saveThesis(updated);
    setThesis(updated);
    setSaveMessage("Saved locally in this browser.");
  }

  function evaluateRule() {
    if (!selectedMetric) {
      setAlertError("Choose a metric before evaluating the rule.");
      return;
    }
    try {
      const normalized = {
        ...rule,
        id: ruleId(rule),
        createdAt: dossier.generatedAt,
      };
      saveAlert(normalized);
      setRule(normalized);
      setEvaluation(
        evaluateLocalAlert(
          normalized,
          selectedMetric.value,
          dossier.generatedAt,
        ),
      );
      setAlertError(null);
    } catch {
      setEvaluation(null);
      setAlertError("Enter a valid numeric threshold.");
    }
  }

  return (
    <section
      className="workspace-section"
      id="commit"
      aria-labelledby="thesis-title"
    >
      <div className="section-heading">
        <p className="section-number">03 · Commit</p>
        <h2 id="thesis-title">Write down what would change your mind.</h2>
        <p>
          The thesis and rule below stay in local browser storage. They are
          never sent to the demo API and are not suitable for sensitive
          information.
        </p>
      </div>
      <div className="commit-layout">
        <form
          className="thesis-card"
          onSubmit={(event) => {
            event.preventDefault();
            persistThesis();
          }}
        >
          <div className="card-heading">
            <div>
              <span className="eyebrow">Thesis card</span>
              <h3>Make the claim falsifiable</h3>
            </div>
            <span className="local-badge">Local only</span>
          </div>
          <TextAreaField
            label="Claim"
            value={thesis.claim}
            onChange={(value) => updateThesis("claim", value)}
          />
          <TextAreaField
            label="Supporting evidence"
            value={thesis.evidence}
            onChange={(value) => updateThesis("evidence", value)}
          />
          <TextAreaField
            label="Key risks"
            value={thesis.risks}
            onChange={(value) => updateThesis("risks", value)}
          />
          <TextAreaField
            label="Invalidation condition"
            value={thesis.invalidation}
            onChange={(value) => updateThesis("invalidation", value)}
          />
          <div className="form-footer">
            <button className="primary-action compact-action" type="submit">
              Save thesis locally
            </button>
            <span role="status">{saveMessage}</span>
          </div>
        </form>

        <div className="monitor-card" id="monitor">
          <div className="card-heading">
            <div>
              <span className="eyebrow">04 · Monitor</span>
              <h3>Evaluate one explicit rule</h3>
            </div>
            <span className="local-badge">No delivery</span>
          </div>
          <label className="select-field">
            <span>Metric</span>
            <select
              value={rule.metricKey}
              onChange={(event) => {
                setRule((current) => ({
                  ...current,
                  metricKey: event.target.value,
                }));
                setEvaluation(null);
              }}
            >
              {dossier.metrics.map((metric) => (
                <option value={metric.key} key={metric.key}>
                  {metric.label} ({metric.displayValue})
                </option>
              ))}
            </select>
          </label>
          <div className="rule-row">
            <label className="select-field">
              <span>Trigger when</span>
              <select
                value={rule.operator}
                onChange={(event) =>
                  setRule((current) => ({
                    ...current,
                    operator: event.target.value as AlertOperator,
                  }))
                }
              >
                <option value="below">Falls below</option>
                <option value="above">Rises above</option>
              </select>
            </label>
            <label className="number-field">
              <span>Raw threshold</span>
              <div>
                <input
                  inputMode="decimal"
                  value={rule.threshold}
                  onChange={(event) =>
                    setRule((current) => ({
                      ...current,
                      threshold: event.target.value,
                    }))
                  }
                  aria-describedby="threshold-help"
                />
              </div>
            </label>
          </div>
          <p className="field-note" id="threshold-help">
            Compare against the metric’s raw decimal value. For percentages, use
            values such as 16.0—not 0.16.
          </p>
          <button
            className="secondary-action"
            type="button"
            onClick={evaluateRule}
          >
            Save and evaluate now
          </button>
          {alertError && (
            <p className="inline-error" role="alert">
              {alertError}
            </p>
          )}
          {evaluation && selectedMetric && (
            <div
              className={`evaluation-result ${evaluation.triggered ? "evaluation-triggered" : "evaluation-clear"}`}
              role="status"
            >
              <span>
                {evaluation.triggered ? "Condition met" : "Condition not met"}
              </span>
              <strong>
                {selectedMetric.displayValue} is {evaluation.operator}{" "}
                {evaluation.threshold}
              </strong>
              <code>dedupe · {evaluation.eventId}</code>
              <small>
                Local evaluation only; no email, push, webhook, or background
                polling.
              </small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="textarea-field">
      <span>{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function defaultThesis(dossier: DossierDto): LocalThesisDto {
  return {
    schemaVersion: "1.0.0",
    instrumentId: dossier.instrument.id,
    claim:
      "Northwind can sustain double-digit growth while rebuilding adjusted EBITDA margin.",
    evidence:
      "Revenue grew from the prior synthetic period and the business remained cash generative.",
    risks:
      "Revenue recognition controls, slower automation demand, and margin execution.",
    invalidation:
      "Two consecutive annual periods below 5% revenue growth or EBITDA margin below 15%.",
    updatedAt: dossier.generatedAt,
  };
}

function defaultRule(dossier: DossierDto): LocalAlertRuleDto {
  return {
    schemaVersion: "1.0.0",
    id: `rule-${dossier.instrument.id}-ebitda_margin-below-15`,
    instrumentId: dossier.instrument.id,
    metricKey: "ebitda_margin",
    operator: "below",
    threshold: "15",
    createdAt: dossier.generatedAt,
  };
}

function ruleId(rule: LocalAlertRuleDto): string {
  return `rule-${rule.instrumentId}-${rule.metricKey}-${rule.operator}-${rule.threshold.replaceAll(".", "_")}`;
}
