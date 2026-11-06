import type { FinancialScreenPassReviewState } from "./financial-screen-pass-review-controller";
import type {
  ManagedFinancialScreenResultRow,
  ManagedFinancialScreenRun,
} from "./managed-financial-screen";
import { requiredDraftFileTime } from "./managed-watchlist-draft-file-validation";

function passiveRow(row: ManagedFinancialScreenResultRow) {
  const { handle: _handle, member, ...data } = row;
  void _handle;
  return { ...data, member: { listing: member.listing } };
}
function passiveRun(run: ManagedFinancialScreenRun) {
  const {
    handle: _handle,
    criteriaRevision: _criteria,
    selectionRevision: _selection,
    rows,
    continuations,
    ...data
  } = run;
  void _handle;
  void _criteria;
  void _selection;
  return {
    ...data,
    rows: rows.map(passiveRow),
    ...(continuations
      ? {
          continuations: continuations.map(
            ({ handle: _pass, requests, attempts, ...pass }) => {
              void _pass;
              return {
                ...pass,
                requests: requests.map(({ listing }) => ({ listing })),
                attempts: attempts.map(({ member, result, ...attempt }) => ({
                  ...attempt,
                  member: { listing: member.listing },
                  result: result ? passiveRow(result) : null,
                })),
              };
            },
          ),
        }
      : {}),
  };
}
export interface PreparedScreenPassReviewReport {
  readonly kind: "screen_pass_review";
  readonly preparedAt: string;
  readonly catalogSnapshotSha256: string;
  readonly plan: {
    readonly preparedAt: string;
    readonly requests: readonly {
      readonly listing: ManagedFinancialScreenResultRow["member"]["listing"];
    }[];
    readonly sourceRun: ReturnType<typeof passiveRun>;
  };
  readonly current: ReturnType<typeof passiveRun>;
}
const owned = new WeakSet<object>();
export function isPreparedScreenPassReviewReport(
  value: unknown,
): value is PreparedScreenPassReviewReport {
  return typeof value === "object" && value !== null && owned.has(value);
}
function validText(value: unknown): boolean {
  if (typeof value === "string") return !/\p{Cs}/u.test(value);
  return (
    value === null ||
    typeof value !== "object" ||
    Object.values(value).every(validText)
  );
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function screenPassReportReady(
  state: FinancialScreenPassReviewState,
): boolean {
  const { plan, result } = state;
  return (
    state.status === "settled" &&
    !!plan &&
    !!result &&
    result.handle === state.currentHandle &&
    result.status !== "running" &&
    !!result.completedAt &&
    plan.sourceRun.status !== "running" &&
    !!plan.sourceRun.completedAt &&
    result.criteriaRevision === plan.sourceRun.criteriaRevision &&
    result.selectionRevision === plan.sourceRun.selectionRevision &&
    plan.requests.length > 0 &&
    result.rows.length === plan.requests.length &&
    plan.sourceRun.rows.length === plan.requests.length &&
    !result.continuations?.some((p) => p.status === "running") &&
    !plan.sourceRun.continuations?.some((p) => p.status === "running") &&
    plan.requests.every(
      (member, i) =>
        result.rows[i]!.member === member &&
        plan.sourceRun.rows[i]!.member === member,
    )
  );
}
/** Complete passive projection. Symbols stay in the live owners, never in the document. */
export function prepareScreenPassReviewReport(
  state: FinancialScreenPassReviewState,
  catalogSnapshotSha256: string,
  preparedAt: string,
): PreparedScreenPassReviewReport | null {
  try {
    if (
      !screenPassReportReady(state) ||
      !/^sha256:[a-f0-9]{64}$/u.test(catalogSnapshotSha256)
    )
      return null;
    const plan = state.plan!;
    const data: PreparedScreenPassReviewReport = {
      kind: "screen_pass_review",
      preparedAt: requiredDraftFileTime(preparedAt),
      catalogSnapshotSha256,
      plan: {
        preparedAt: plan.preparedAt,
        requests: plan.requests.map(({ listing }) => ({ listing })),
        sourceRun: passiveRun(plan.sourceRun),
      },
      current: passiveRun(state.result!),
    };
    if (
      !validText(data) ||
      new TextEncoder().encode(JSON.stringify(data)).byteLength >
        8 * 1024 * 1024
    )
      return null;
    const report = freeze(structuredClone(data));
    owned.add(report);
    return report;
  } catch {
    return null;
  }
}
