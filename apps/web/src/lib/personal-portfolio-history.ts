import {
  projectPersonalPortfolioLedger,
  type PersonalMarketOverviewDto,
  type PersonalPortfolioLedgerPayload,
} from "@research-cockpit/contracts";

export interface PortfolioHistoryAction {
  readonly date: string;
  readonly providerFactor: string | null;
  readonly recordedRatio: string | null;
  readonly dividendCash: string | null;
  readonly status:
    | "matched"
    | "review_difference"
    | "unrecorded"
    | "no_prior_position"
    | "no_observation"
    | "dividend_observation";
}

export interface PortfolioHistoryAssessment {
  readonly listingId: string;
  readonly firstObservedDate: string | null;
  readonly lastObservedDate: string | null;
  readonly observationCount: number;
  readonly observedDates: readonly string[];
  readonly openingDateObserved: boolean;
  readonly activityDateCount: number;
  readonly observedActivityDateCount: number;
  readonly manualSplitsOutsideWindow: number;
  readonly actions: readonly PortfolioHistoryAction[];
  readonly requiresSplitReview: boolean;
  readonly splitReviewDates: readonly string[];
}

/** Observations only: never creates saved activities or infers a missing bar. */
export function assessPortfolioHistory(
  ledger: PersonalPortfolioLedgerPayload,
  listingId: string,
  history: PersonalMarketOverviewDto["history"],
): PortfolioHistoryAssessment | null {
  if (
    projectPersonalPortfolioLedger(ledger).status !== "valid" ||
    !ledger.identities.some((identity) => identity.listingId === listingId) ||
    !usableHistory(history)
  )
    return null;
  const activities = ledger.transactions.filter(
    (activity) => activity.listingId === listingId,
  );
  const dates = new Set(history.bars.map((bar) => bar.date));
  const activityDates = new Set(activities.map((activity) => activity.date));
  const recorded = new Map<
    string,
    { numerator: bigint; denominator: bigint }
  >();
  let manualSplitsOutsideWindow = 0;
  for (const activity of activities) {
    if (activity.type !== "split") continue;
    if (activity.date < history.startDate || activity.date > history.endDate) {
      manualSplitsOutsideWindow += 1;
      continue;
    }
    const prior = recorded.get(activity.date) ?? {
      numerator: 1n,
      denominator: 1n,
    };
    recorded.set(activity.date, {
      numerator: prior.numerator * BigInt(activity.ratioNumerator),
      denominator: prior.denominator * BigInt(activity.ratioDenominator),
    });
  }
  // Compare ex-date observations against shares held at the end of the prior
  // day. A purchase on the ex-date itself does not require an extra split.
  let shares = microShares(
    ledger.opening.holdings.find((holding) => holding.listingId === listingId)
      ?.shares ?? "0",
  );
  let activityIndex = 0;
  let requiresSplitReview = false;
  const actions: PortfolioHistoryAction[] = [];
  for (const bar of history.bars) {
    if (bar.date <= ledger.opening.asOfDate) continue;
    while (activityIndex < activities.length) {
      const activity = activities[activityIndex];
      if (!activity || activity.date >= bar.date) break;
      if (activity.type === "buy")
        shares += microShares(activity.shares ?? "0");
      if (activity.type === "sell")
        shares -= microShares(activity.shares ?? "0");
      if (activity.type === "split")
        shares =
          (shares * BigInt(activity.ratioNumerator)) /
          BigInt(activity.ratioDenominator);
      activityIndex += 1;
    }
    const ratio = recorded.get(bar.date);
    const factor = decimalRatio(bar.splitFactor);
    const hasSplit = factor.numerator !== factor.denominator;
    const dividend =
      decimalRatio(bar.dividendCash).numerator > 0n ? bar.dividendCash : null;
    if (!ratio && !hasSplit && dividend === null) continue;
    const status: PortfolioHistoryAction["status"] = ratio
      ? ratio.numerator * factor.denominator ===
        factor.numerator * ratio.denominator
        ? "matched"
        : "review_difference"
      : hasSplit
        ? shares > 0n
          ? "unrecorded"
          : "no_prior_position"
        : "dividend_observation";
    if (status === "review_difference" || status === "unrecorded")
      requiresSplitReview = true;
    actions.push(
      Object.freeze({
        date: bar.date,
        providerFactor: hasSplit || ratio ? bar.splitFactor : null,
        recordedRatio: ratio
          ? `${String(ratio.numerator)}:${String(ratio.denominator)}`
          : null,
        dividendCash: dividend,
        status,
      }),
    );
  }
  for (const [date, ratio] of recorded) {
    if (!dates.has(date))
      actions.push(
        Object.freeze({
          date,
          providerFactor: null,
          recordedRatio: `${String(ratio.numerator)}:${String(ratio.denominator)}`,
          dividendCash: null,
          status: "no_observation",
        }),
      );
  }
  actions.sort((left, right) => left.date.localeCompare(right.date));
  return Object.freeze({
    listingId,
    firstObservedDate: history.bars[0]?.date ?? null,
    lastObservedDate: history.bars.at(-1)?.date ?? null,
    observationCount: history.bars.length,
    observedDates: Object.freeze([...dates]),
    openingDateObserved: dates.has(ledger.opening.asOfDate),
    activityDateCount: activityDates.size,
    observedActivityDateCount: [...activityDates].filter((date) =>
      dates.has(date),
    ).length,
    manualSplitsOutsideWindow,
    actions: Object.freeze(actions),
    requiresSplitReview,
    splitReviewDates: Object.freeze(
      actions
        .filter(
          (action) =>
            action.status === "unrecorded" ||
            action.status === "review_difference",
        )
        .map((action) => action.date),
    ),
  });
}

// The adapter validates the full DTO. This consumer additionally bounds and
// checks only the observations it uses, so malformed dates or decimal text
// cannot produce a false match, implicit interpolation or a BigInt exception.
function usableHistory(history: PersonalMarketOverviewDto["history"]): boolean {
  if (
    typeof history !== "object" ||
    history === null ||
    !Array.isArray(history.bars) ||
    history.bars.length > 4_096 ||
    !calendarDate(history.startDate) ||
    !calendarDate(history.endDate) ||
    history.startDate > history.endDate
  )
    return false;
  let previousDate = "";
  for (const value of history.bars as readonly unknown[]) {
    if (typeof value !== "object" || value === null) return false;
    const bar = value as Record<string, unknown>;
    if (
      !calendarDate(bar.date) ||
      bar.date <= previousDate ||
      bar.date < history.startDate ||
      bar.date > history.endDate ||
      !unsignedDecimal(bar.splitFactor) ||
      decimalRatio(bar.splitFactor).numerator === 0n ||
      !unsignedDecimal(bar.dividendCash)
    )
      return false;
    previousDate = bar.date;
  }
  return true;
}

function unsignedDecimal(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)
  );
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}

function microShares(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

function decimalRatio(value: string) {
  const [whole = "0", fraction = ""] = value.split(".");
  return {
    numerator: BigInt(`${whole}${fraction}`),
    denominator: 10n ** BigInt(fraction.length),
  };
}
