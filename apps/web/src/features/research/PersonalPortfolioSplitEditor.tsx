"use client";

import {
  PERSONAL_PORTFOLIO_LEDGER_LIMITS,
  projectPersonalPortfolioLedger,
  type PersonalPortfolioLedgerPayloadV3,
  type PersonalPortfolioLedgerProjection,
  type PersonalPortfolioLedgerSplit,
} from "@research-cockpit/contracts";
import { useEffect, useRef, useState } from "react";

export interface PersonalPortfolioSplitEditorProps {
  readonly ledger: PersonalPortfolioLedgerPayloadV3;
  readonly disabled: boolean;
  readonly editing: PersonalPortfolioLedgerSplit | null;
  readonly onApply: (candidate: PersonalPortfolioLedgerPayloadV3) => boolean;
  readonly onCancelEdit: () => void;
  readonly onPendingEditsChange: (pending: boolean) => void;
}

type Form = Readonly<{
  listingId: string;
  date: string;
  numerator: string;
  denominator: string;
  position: string;
}>;
type Projection = Extract<
  PersonalPortfolioLedgerProjection,
  { status: "valid" }
>;
type Preview = Readonly<{
  candidate: PersonalPortfolioLedgerPayloadV3;
  projection: Projection;
  before: Projection;
  splitId: string;
  context: string;
  epoch: number;
}>;

export function PersonalPortfolioSplitEditor({
  ledger,
  disabled,
  editing,
  onApply,
  onCancelEdit,
  onPendingEditsChange,
}: PersonalPortfolioSplitEditorProps) {
  const [form, setForm] = useState<Form>(initialForm(ledger, editing));
  const [baseline, setBaseline] = useState<Form>(initialForm(ledger, editing));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState(
    "Enter a manually verified split or reverse split, then preview its effect on the whole ledger.",
  );
  const epoch = useRef(0);
  const generatedId = useRef<string | null>(null);
  const pendingCallback = useRef(onPendingEditsChange);
  pendingCallback.current = onPendingEditsChange;
  const context = JSON.stringify([ledger, disabled, editing]);
  const liveContext = useRef(context);
  liveContext.current = context;
  const [loadedContext, setLoadedContext] = useState(context);
  const pending =
    !disabled &&
    (editing !== null ||
      preview !== null ||
      JSON.stringify(form) !== JSON.stringify(baseline));

  useEffect(() => {
    pendingCallback.current(pending);
  }, [pending]);
  useEffect(
    () => () => {
      epoch.current += 1;
      pendingCallback.current(false);
    },
    [],
  );
  useEffect(() => {
    epoch.current += 1;
    generatedId.current = null;
    setPreview(null);
    setForm(initialForm(ledger, editing));
    setBaseline(initialForm(ledger, editing));
    setLoadedContext(context);
    setMessage(
      editing === null
        ? "Enter a manually verified split or reverse split, then preview its effect on the whole ledger."
        : `Editing split ${editing.id}. Its ID is preserved; preview the new ratio and position before applying.`,
    );
  }, [context]);

  function change(next: Form) {
    epoch.current += 1;
    setPreview(null);
    setForm(next);
  }

  function reset() {
    epoch.current += 1;
    generatedId.current = null;
    setPreview(null);
    const next = initialForm(ledger, null);
    setForm(next);
    setBaseline(next);
    onCancelEdit();
    setMessage(
      "Split inputs and preview cleared. No ledger records were changed.",
    );
  }

  function makePreview() {
    if (
      disabled ||
      loadedContext !== context ||
      liveContext.current !== context
    )
      return;
    setPreview(null);
    const remaining = ledger.transactions.filter(
      (entry) => entry.id !== editing?.id,
    );
    if (
      !validRatio(form.numerator) ||
      !validRatio(form.denominator) ||
      form.numerator === form.denominator
    ) {
      setMessage(
        "Enter different positive whole-number share counts from 1 to 1,000,000 for the new:old ratio.",
      );
      return;
    }
    if (!/^\d{1,3}$/u.test(form.position)) {
      setMessage(
        "Choose where this split belongs in the dated ledger, including its order relative to same-day activity.",
      );
      return;
    }
    const position = Number(form.position);
    if (
      position > remaining.length ||
      (remaining[position - 1]?.date ?? ledger.opening.asOfDate) > form.date ||
      (remaining[position]?.date ?? "9999-12-31") < form.date
    ) {
      setMessage(
        "The selected position does not preserve date order. Choose a valid insertion position.",
      );
      return;
    }
    if (
      remaining.some(
        (entry) =>
          entry.type === "split" &&
          entry.listingId === form.listingId &&
          entry.date === form.date &&
          BigInt(entry.ratioNumerator) * BigInt(form.denominator) ===
            BigInt(form.numerator) * BigInt(entry.ratioDenominator),
      )
    ) {
      setMessage(
        "An equivalent split is already recorded for this listing and date. Edit the existing record instead of applying it twice.",
      );
      return;
    }
    generatedId.current ??= crypto.randomUUID();
    const split: PersonalPortfolioLedgerSplit = {
      id: editing?.id ?? generatedId.current,
      date: form.date,
      type: "split",
      listingId: form.listingId,
      ratioNumerator: form.numerator,
      ratioDenominator: form.denominator,
    };
    const candidate: PersonalPortfolioLedgerPayloadV3 = {
      ...ledger,
      transactions: [
        ...remaining.slice(0, position),
        split,
        ...remaining.slice(position),
      ],
    };
    const before = projectPersonalPortfolioLedger(ledger, today());
    const result = projectPersonalPortfolioLedger(candidate, today());
    if (before.status !== "valid" || result.status !== "valid") {
      setMessage(
        result.status === "invalid"
          ? splitError(result.error)
          : "The current ledger could not be projected. Reload it before recording a split.",
      );
      return;
    }
    setPreview({
      candidate,
      projection: result,
      before,
      splitId: split.id,
      context,
      epoch: epoch.current,
    });
    setMessage(
      "Review the share adjustment and all later ledger effects. Apply updates the draft; Save My Portfolio persists it.",
    );
  }

  function applyPreview() {
    if (
      disabled ||
      preview === null ||
      preview.context !== context ||
      liveContext.current !== context ||
      preview.epoch !== epoch.current
    )
      return;
    const result = projectPersonalPortfolioLedger(preview.candidate, today());
    if (result.status !== "valid") {
      setPreview(null);
      setMessage(splitError(result.error));
      return;
    }
    if (onApply(preview.candidate)) {
      reset();
      setMessage(
        "Reviewed split applied to the draft. Save My Portfolio to keep it.",
      );
    }
  }

  const remaining = ledger.transactions.filter(
    (entry) => entry.id !== editing?.id,
  );
  const positions = Array.from(
    { length: remaining.length + 1 },
    (_, index) => index,
  ).filter(
    (index) =>
      (remaining[index - 1]?.date ?? ledger.opening.asOfDate) <= form.date &&
      (remaining[index]?.date ?? "9999-12-31") >= form.date,
  );
  const current = !disabled && loadedContext === context ? preview : null;
  const adjustment = current?.projection.splitAdjustments.find(
    (entry) => entry.transactionId === current.splitId,
  );
  const beforeHolding = current?.before.portfolio.holdings.find(
    (holding) => holding.identity.listingId === form.listingId,
  );
  const afterHolding = current?.projection.portfolio.holdings.find(
    (holding) => holding.identity.listingId === form.listingId,
  );
  const locked = disabled || loadedContext !== context;

  return (
    <div
      className="ledger-section ledger-split-editor"
      aria-labelledby="ledger-split-title"
    >
      <h4 id="ledger-split-title">
        {editing === null
          ? "Record a split or reverse split"
          : "Edit split record"}
      </h4>
      <p className="ledger-help">
        Enter new shares for each old share count: 2:1 doubles shares; 1:10 is a
        reverse split. This manual record adjusts existing lots at the chosen
        position. Cash-in-lieu, fractional-share rounding, mergers, and
        spin-offs are not supported. Source observations do not create ledger
        entries.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div className="ledger-fields">
        <label>
          Registered listing
          <select
            aria-label="Split listing"
            value={form.listingId}
            disabled={locked}
            onChange={(event) =>
              change({ ...form, listingId: event.target.value })
            }
          >
            <option value="">Choose a listing</option>
            {ledger.identities.map((identity) => (
              <option key={identity.listingId} value={identity.listingId}>
                {identity.symbol}
              </option>
            ))}
          </select>
        </label>
        <label>
          Effective date
          <input
            aria-label="Split effective date"
            type="date"
            max={today()}
            value={form.date}
            disabled={locked}
            onChange={(event) =>
              change({ ...form, date: event.target.value, position: "" })
            }
          />
        </label>
        <label>
          New share count
          <input
            aria-label="Split new share count"
            inputMode="numeric"
            maxLength={7}
            value={form.numerator}
            disabled={locked}
            onChange={(event) =>
              change({ ...form, numerator: event.target.value })
            }
          />
        </label>
        <label>
          Old share count
          <input
            aria-label="Split old share count"
            inputMode="numeric"
            maxLength={7}
            value={form.denominator}
            disabled={locked}
            onChange={(event) =>
              change({ ...form, denominator: event.target.value })
            }
          />
        </label>
        <label>
          Position in dated activity
          <select
            aria-label="Split insertion position"
            value={form.position}
            disabled={locked}
            onChange={(event) =>
              change({ ...form, position: event.target.value })
            }
          >
            <option value="">Choose the split's position</option>
            {positions.map((index) => (
              <option key={index} value={String(index)}>
                {positionLabel(remaining, index)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ledger-actions">
        <button
          type="button"
          className="secondary-action compact-action"
          disabled={
            locked ||
            (editing === null &&
              ledger.transactions.length >=
                PERSONAL_PORTFOLIO_LEDGER_LIMITS.transactions)
          }
          onClick={makePreview}
        >
          Preview split adjustment
        </button>
        <button
          type="button"
          className="text-button"
          disabled={locked || !pending}
          onClick={reset}
        >
          {editing === null ? "Clear split inputs" : "Cancel split edit"}
        </button>
      </div>
      {current !== null && adjustment !== undefined && (
        <div className="ledger-split-preview">
          <h4>
            Split review: {form.numerator}:{form.denominator} on {form.date}
          </h4>
          <dl className="ledger-summary">
            <div>
              <dt>Shares immediately before split</dt>
              <dd>{adjustment.beforeShares}</dd>
            </div>
            <div>
              <dt>Shares immediately after split</dt>
              <dd>{adjustment.afterShares}</dd>
            </div>
            <div>
              <dt>Affected FIFO lots</dt>
              <dd>{String(adjustment.affectedLots)}</dd>
            </div>
            <div>
              <dt>Projected current shares</dt>
              <dd>
                {beforeHolding?.shares ?? "0"} → {afterHolding?.shares ?? "0"}
              </dd>
            </div>
            <div>
              <dt>Projected current basis</dt>
              <dd>
                {money(
                  beforeHolding?.totalCostBasisUsd,
                  beforeHolding === undefined,
                )}{" "}
                →{" "}
                {money(
                  afterHolding?.totalCostBasisUsd,
                  afterHolding === undefined,
                )}
              </dd>
            </div>
            <div>
              <dt>Projected cash</dt>
              <dd>
                {money(current.before.portfolio.cashUsd)} →{" "}
                {money(current.projection.portfolio.cashUsd)}
              </dd>
            </div>
            <div>
              <dt>Total realized FIFO estimate</dt>
              <dd>
                {money(current.before.realized.totalGainUsd)} →{" "}
                {money(current.projection.realized.totalGainUsd)}
              </dd>
            </div>
          </dl>
          <p className="ledger-help">
            The preview replays every later record and may change remaining
            basis and realized estimates. No price adjustment, cash payment, or
            tax treatment is inferred.
          </p>
          <button
            type="button"
            className="secondary-action compact-action"
            disabled={locked}
            onClick={applyPreview}
          >
            Apply reviewed split
          </button>
        </div>
      )}
    </div>
  );
}

function initialForm(
  ledger: PersonalPortfolioLedgerPayloadV3,
  editing: PersonalPortfolioLedgerSplit | null,
): Form {
  return {
    listingId: editing?.listingId ?? ledger.identities[0]?.listingId ?? "",
    date: editing?.date ?? today(),
    numerator: editing?.ratioNumerator ?? "",
    denominator: editing?.ratioDenominator ?? "",
    position:
      editing === null
        ? ""
        : String(
            ledger.transactions.findIndex((entry) => entry.id === editing.id),
          ),
  };
}
function validRatio(value: string) {
  return /^(?:[1-9][0-9]{0,5}|1000000)$/u.test(value);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function money(value: string | null | undefined, absent = false) {
  return absent
    ? "0.00 USD"
    : value === null || value === undefined
      ? "Unknown"
      : `${value} USD`;
}
function positionLabel(
  activities: PersonalPortfolioLedgerPayloadV3["transactions"],
  index: number,
) {
  const previous = activities[index - 1];
  const next = activities[index];
  return previous === undefined
    ? `First, before ${next?.date ?? "all later activity"}${next ? ` ${next.type} (${next.id})` : ""}`
    : `After ${previous.date} ${previous.type} (${previous.id})${next ? `; before ${next.date} ${next.type} (${next.id})` : "; last activity"}`;
}
function splitError(
  error: Extract<
    PersonalPortfolioLedgerProjection,
    { status: "invalid" }
  >["error"],
) {
  const explanations = {
    split_no_position:
      "There are no open shares for this listing at the chosen position.",
    split_fractional_precision:
      "This split would require a fractional share amount beyond six decimal places. No rounding or cash-in-lieu is assumed.",
    shares_limit: "The split would exceed the supported share limit.",
    oversell:
      "A later sale would exceed the shares available after this adjustment.",
    negative_cash: "The proposed order would make known cash negative.",
    transaction_order: "The chosen position does not preserve date order.",
    transaction_before_opening:
      "The effective date must be strictly after the opening date.",
    future_date: "The effective date cannot be in the future.",
    invalid_today: "The current date could not be validated.",
    invalid_payload:
      "Check the registered listing, date, ratio, and record limits.",
    cash_limit: "The projection exceeds the supported cash limit.",
    cost_basis_limit: "The projection exceeds the supported cost basis limit.",
  };
  return `No split applied. ${explanations[error.code]}${error.transactionIndex === null ? "" : ` Affected activity position: ${String(error.transactionIndex + 1)}.`}`;
}
