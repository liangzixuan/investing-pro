import {
  PERSONAL_SEC_QUARTERLY_CONCEPTS,
  PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS,
  PERSONAL_SEC_ANNUAL_CASH_LIMITS,
  PERSONAL_SEC_ANNUAL_CASH_CONCEPTS,
  PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS,
  PERSONAL_SEC_ANNUAL_LIQUIDITY_CONCEPTS,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS,
  PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS,
  PERSONAL_SEC_ANNUAL_OPERATING_LIMITS,
  type PersonalSecQuarterlyObservationDto,
  type PersonalSecAnnualCashObservationDto,
  type PersonalSecAnnualCashMetric,
  type PersonalSecAnnualLiquidityObservationDto,
  type PersonalSecAnnualLiquidityMetric,
  type PersonalSecAnnualBalanceSheetObservationDto,
  type PersonalSecAnnualBalanceSheetMetric,
  type PersonalSecAnnualOperatingObservationDto,
} from "@research-cockpit/contracts";

const limits = PERSONAL_SEC_QUARTERLY_EVIDENCE_LIMITS;
const concepts = [
  ...PERSONAL_SEC_QUARTERLY_CONCEPTS,
  ...PERSONAL_SEC_ANNUAL_CASH_CONCEPTS,
  ...PERSONAL_SEC_ANNUAL_LIQUIDITY_CONCEPTS,
  ...PERSONAL_SEC_ANNUAL_BALANCE_SHEET_CONCEPTS,
  "OperatingIncomeLoss",
] as const;
const accessionPattern = /^[0-9]{10}-[0-9]{2}-[0-9]{6}$/u;
const forbiddenText = /[\p{Cc}\p{Cf}\p{Cs}]/u;
type Observation =
  | PersonalSecQuarterlyObservationDto
  | PersonalSecAnnualCashObservationDto
  | PersonalSecAnnualLiquidityObservationDto
  | PersonalSecAnnualBalanceSheetObservationDto
  | PersonalSecAnnualOperatingObservationDto;
type ObservationFields = Omit<
  PersonalSecQuarterlyObservationDto,
  "metric" | "concept"
> & {
  readonly metric: unknown;
  readonly concept: string;
};

export function incomeObservation(
  value: unknown,
  cik: string,
): value is PersonalSecQuarterlyObservationDto {
  return (
    observation(value, cik, limits.candidateRows) &&
    member(["revenue", "net_income"], value.metric) &&
    member(PERSONAL_SEC_QUARTERLY_CONCEPTS, value.concept) &&
    (value.metric === "net_income") === (value.concept === "NetIncomeLoss")
  );
}
export function cashObservation(
  value: unknown,
  cik: string,
  metric: PersonalSecAnnualCashMetric,
): value is PersonalSecAnnualCashObservationDto {
  return (
    observation(
      value,
      cik,
      PERSONAL_SEC_ANNUAL_CASH_LIMITS.candidateRowsPerMetric,
    ) &&
    value.metric === metric &&
    value.concept ===
      (metric === "operating_cash_flow"
        ? "NetCashProvidedByUsedInOperatingActivities"
        : "PaymentsToAcquirePropertyPlantAndEquipment")
  );
}

export function liquidityObservation(
  value: unknown,
  cik: string,
  metric: PersonalSecAnnualLiquidityMetric,
): value is PersonalSecAnnualLiquidityObservationDto {
  return (
    observation(
      value,
      cik,
      PERSONAL_SEC_ANNUAL_LIQUIDITY_LIMITS.candidateRowsPerMetric,
    ) &&
    value.metric === metric &&
    value.concept ===
      (metric === "current_assets" ? "AssetsCurrent" : "LiabilitiesCurrent")
  );
}

export function balanceSheetObservation(
  value: unknown,
  cik: string,
  metric: PersonalSecAnnualBalanceSheetMetric,
): value is PersonalSecAnnualBalanceSheetObservationDto {
  const concept =
    metric === "total_assets"
      ? "Assets"
      : metric === "total_liabilities"
        ? "Liabilities"
        : metric === "shareholders_equity"
          ? "StockholdersEquity"
          : null;
  return (
    concept !== null &&
    observation(
      value,
      cik,
      PERSONAL_SEC_ANNUAL_BALANCE_SHEET_LIMITS.candidateRowsPerMetric,
    ) &&
    value.metric === metric &&
    value.concept === concept
  );
}

export function operatingObservation(
  value: unknown,
  cik: string,
): value is PersonalSecAnnualOperatingObservationDto {
  return (
    observation(
      value,
      cik,
      PERSONAL_SEC_ANNUAL_OPERATING_LIMITS.candidateRowsPerMetric,
    ) &&
    value.metric === "operating_income" &&
    value.concept === "OperatingIncomeLoss"
  );
}

export async function hash(value: string): Promise<`sha256:${string}`> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false;
  const a = Object.keys(left);
  const b = Object.keys(right);
  return (
    a.length === b.length &&
    a.every(
      (key) =>
        Object.hasOwn(right, key) &&
        equal(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}

function observation(
  value: unknown,
  cik: string,
  candidateLimit: number,
): value is ObservationFields {
  if (
    !keys(value, [
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
    ]) ||
    !matches(value.id, /^sec-fact:[a-f0-9]{64}$/u) ||
    value.taxonomy !== "us-gaap" ||
    !member(concepts, value.concept) ||
    value.unit !== "USD" ||
    !matches(value.value, /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u) ||
    value.value.length > limits.decimalCharacters ||
    value.value === "-0" ||
    !date(value.endDate) ||
    !(value.startDate === null || date(value.startDate)) ||
    (value.startDate !== null && value.startDate > value.endDate) ||
    value.durationDays !==
      (value.startDate === null
        ? null
        : (Date.parse(value.endDate) - Date.parse(value.startDate)) /
            86_400_000 +
          1) ||
    value.periodBasis !== "unresolved" ||
    !(
      value.filingFocusYear === null ||
      integer(value.filingFocusYear, 1000, 9999)
    ) ||
    !(
      value.filingFocusPeriod === null ||
      sourceText(value.filingFocusPeriod, 32)
    ) ||
    !(value.frame === null || sourceText(value.frame, 128)) ||
    !matches(value.accessionNumber, accessionPattern) ||
    !form(value.form) ||
    !date(value.filedDate) ||
    !matches(
      value.sourceLocator,
      new RegExp(
        `^/facts/us-gaap/${value.concept}/units/USD/(?:0|[1-9][0-9]{0,4})$`,
        "u",
      ),
    ) ||
    Number(value.sourceLocator.split("/").at(-1)) >= candidateLimit ||
    !keys(value.filing, [
      "status",
      "form",
      "filedDate",
      "reportDate",
      "acceptedAt",
      "sourceUrl",
    ]) ||
    !member(
      [
        "matched",
        "metadata_conflict",
        "not_in_current_submissions",
        "submissions_unavailable",
      ],
      value.filing.status,
    )
  )
    return false;
  const filing = value.filing;
  if (
    filing.status === "not_in_current_submissions" ||
    filing.status === "submissions_unavailable"
  )
    return false;
  return (
    form(filing.form) &&
    date(filing.filedDate) &&
    (filing.reportDate === null || date(filing.reportDate)) &&
    (filing.acceptedAt === null || sourceInstant(filing.acceptedAt)) &&
    filing.sourceUrl ===
      `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/u, "")}/${value.accessionNumber}-index.htm` &&
    (filing.status === "matched"
      ? filing.form === value.form && filing.filedDate === value.filedDate
      : filing.form !== value.form || filing.filedDate !== value.filedDate)
  );
}

export function compareObservations(
  left: Observation,
  right: Observation,
): number {
  return (
    right.endDate.localeCompare(left.endDate) ||
    (right.startDate ?? "").localeCompare(left.startDate ?? "") ||
    right.filedDate.localeCompare(left.filedDate) ||
    left.accessionNumber.localeCompare(right.accessionNumber) ||
    left.concept.localeCompare(right.concept) ||
    left.id.localeCompare(right.id)
  );
}

export function keys(
  value: unknown,
  expected: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}
export function matches(value: unknown, pattern: RegExp): value is string {
  return typeof value === "string" && pattern.test(value);
}
export function text(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value === value.trim().normalize("NFC") &&
    [...value].length > 0 &&
    [...value].length <= maximum &&
    !forbiddenText.test(value)
  );
}
function sourceText(value: unknown, maximum: number): value is string {
  return text(value, maximum) && /^[\x20-\x7E]+$/u.test(value);
}
function form(value: unknown): value is string {
  return (
    sourceText(value, 40) &&
    /^[A-Za-z0-9][A-Za-z0-9 /()._-]{0,39}$/u.test(value)
  );
}
export function integer(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
export function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
export function date(value: unknown): value is string {
  return (
    matches(value, /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/u) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
export function instant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
export function sourceInstant(value: unknown): value is string {
  return (
    matches(
      value,
      /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{3})?Z$/u,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() ===
      (value.length === 20 ? value.replace("Z", ".000Z") : value)
  );
}
