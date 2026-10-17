import {
  PERSONAL_SEC_ANNUAL_DEFINITION_VERSION,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS,
  type PersonalSecAnnualBalanceSheetResolutionInput,
} from "@research-cockpit/contracts";
import {
  resolvePersonalSecAnnualBalanceSheetCore,
  resolvePersonalSecAnnualBalanceSheetHistoryCore,
} from "./personal-sec-annual-balance-sheet-core";
export type {
  PersonalSecAnnualBalanceSheetHistory,
  PersonalSecAnnualBalanceSheetHistoryBalance,
  PersonalSecAnnualBalanceSheetHistoryReason,
} from "./personal-sec-annual-balance-sheet-core";

type Input = PersonalSecAnnualBalanceSheetResolutionInput;
function requireValid(value: unknown): asserts value {
  if (!value) throw new TypeError("Invalid annual balance-sheet evidence.");
}
/** Current protocol admission remains outside the version-free calculation core. */
function record(value: unknown, fields: readonly string[]): void {
  requireValid(value !== null && typeof value === "object");
  const prototype: unknown = Object.getPrototypeOf(value);
  requireValid(prototype === Object.prototype || prototype === null);
  requireValid(Reflect.ownKeys(value).length === fields.length);
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    requireValid(descriptor?.enumerable && "value" in descriptor);
  }
}
function admit(input: Input): "invalid_clock" | null {
  record(input, ["cik", "generation", "target", "balanceSheet"]);
  record(input.generation, [
    "definitionVersion",
    "cutoffAt",
    "completedAt",
    "sources",
    "sha256",
  ]);
  requireValid(
    typeof input.generation.sha256 === "string" &&
      /^sha256:[a-f0-9]{64}$/u.test(input.generation.sha256),
  );
  record(input.balanceSheet, [
    "totalAssets",
    "totalLiabilities",
    "shareholdersEquity",
  ]);
  const fields = [
    "id",
    "metric",
    "taxonomy",
    "concept",
    "unit",
    "value",
    "startDate",
    "endDate",
    "durationDays",
    "periodBasis",
    "filingFocusYear",
    "filingFocusPeriod",
    "frame",
    "accessionNumber",
    "form",
    "filedDate",
    "sourceLocator",
    "filing",
  ];
  for (const [key, expected] of [
    ["totalAssets", "total_assets"],
    ["totalLiabilities", "total_liabilities"],
    ["shareholdersEquity", "shareholders_equity"],
  ] as const) {
    const metric = input.balanceSheet[key];
    record(metric, ["scan", "observations"]);
    const rows = metric.observations;
    requireValid(
      Array.isArray(rows) &&
        Object.getPrototypeOf(rows) === Array.prototype &&
        rows.length <=
          PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS.observationsPerMetric &&
        Reflect.ownKeys(rows).length === rows.length + 1,
    );
    for (let index = 0; index < rows.length; index++) {
      const item = Object.getOwnPropertyDescriptor(rows, String(index));
      requireValid(item?.enumerable && "value" in item);
      const row =
        item.value as Input["balanceSheet"]["totalAssets"]["observations"][number];
      record(row, fields);
      requireValid(row.metric === expected);
      requireValid(
        typeof row.form === "string" &&
          row.form.length > 0 &&
          row.form.length <= 32 &&
          !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(row.form),
      );
    }
  }
  return input.generation.definitionVersion ===
    PERSONAL_SEC_ANNUAL_DEFINITION_VERSION
    ? null
    : "invalid_clock";
}

/** Independent exact totals after the current protocol's closed admission. */
export function resolvePersonalSecAnnualBalanceSheet(input: Input) {
  return resolvePersonalSecAnnualBalanceSheetCore(input, admit(input));
}
export function resolvePersonalSecAnnualBalanceSheetHistory(input: Input) {
  return resolvePersonalSecAnnualBalanceSheetHistoryCore(input, admit(input));
}
