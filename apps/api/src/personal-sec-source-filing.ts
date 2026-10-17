import type { PersonalSecQuarterlyObservationDto } from "@research-cockpit/contracts";
import type { normalizePersonalSecSubmissions } from "./personal-sec-quarterly-evidence-provider";

export type PersonalSecSourceSubmissions = ReturnType<
  typeof normalizePersonalSecSubmissions
>;

/** Join the captured metadata without changing the original fact's filing fields. */
export function joinPersonalSecSourceFiling(
  row: Pick<
    PersonalSecQuarterlyObservationDto,
    "accessionNumber" | "form" | "filedDate"
  >,
  submissions: PersonalSecSourceSubmissions | undefined,
): PersonalSecQuarterlyObservationDto["filing"] {
  const filing = submissions?.filings.get(row.accessionNumber);
  if (filing === undefined)
    return Object.freeze({
      status:
        submissions === undefined
          ? "submissions_unavailable"
          : "not_in_current_submissions",
      form: null,
      filedDate: null,
      reportDate: null,
      acceptedAt: null,
      sourceUrl: null,
    });
  return Object.freeze({
    ...filing,
    status:
      filing.form === row.form && filing.filedDate === row.filedDate
        ? "matched"
        : "metadata_conflict",
  });
}
