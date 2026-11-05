import {
  MANAGED_FINANCIAL_SCREEN_FIELDS,
  type ManagedFinancialScreenCriteria,
  type ManagedFinancialScreenField,
} from "./managed-financial-screen-results";
export type FinancialScreenCriteriaDraft = {
  clauses: {
    field: ManagedFinancialScreenField;
    operator: "gte" | "lte";
    value: string;
  }[];
  sort: {
    field: "symbol" | ManagedFinancialScreenField;
    direction: "asc" | "desc";
  };
};
export const copyFinancialScreenCriteria = (
  criteria: ManagedFinancialScreenCriteria,
): FinancialScreenCriteriaDraft => ({
  clauses: criteria.clauses.map((clause) => ({ ...clause })),
  sort: { ...criteria.sort },
});

export function FinancialScreenCriteriaControls({
  draft,
  edit,
}: {
  draft: FinancialScreenCriteriaDraft;
  edit: (draft: FinancialScreenCriteriaDraft) => void;
}) {
  return (
    <>
      {draft.clauses.map((clause, index) => (
        <div className="managed-screen-clause" key={index}>
          <label>
            Field
            <select
              value={clause.field}
              onChange={(event) =>
                edit({
                  ...draft,
                  clauses: draft.clauses.map((value, at) =>
                    at === index
                      ? {
                          ...value,
                          field: event.target
                            .value as ManagedFinancialScreenField,
                        }
                      : value,
                  ),
                })
              }
            >
              {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label} ({field.unit})
                </option>
              ))}
            </select>
          </label>
          <label>
            Comparison
            <select
              value={clause.operator}
              onChange={(event) =>
                edit({
                  ...draft,
                  clauses: draft.clauses.map((value, at) =>
                    at === index
                      ? {
                          ...value,
                          operator: event.target.value as "gte" | "lte",
                        }
                      : value,
                  ),
                })
              }
            >
              <option value="gte">At least</option>
              <option value="lte">At most</option>
            </select>
          </label>
          <label>
            Threshold
            <input
              type="text"
              inputMode="decimal"
              maxLength={64}
              value={clause.value}
              onChange={(event) =>
                edit({
                  ...draft,
                  clauses: draft.clauses.map((value, at) =>
                    at === index
                      ? { ...value, value: event.target.value }
                      : value,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="trial-secondary"
            onClick={() =>
              edit({
                ...draft,
                clauses: draft.clauses.filter((_, at) => at !== index),
              })
            }
          >
            Remove criterion {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="trial-secondary"
        disabled={draft.clauses.length >= 7}
        onClick={() =>
          edit({
            ...draft,
            clauses: [
              ...draft.clauses,
              { field: "operatingCashFlow", operator: "gte", value: "0" },
            ],
          })
        }
      >
        Add criterion
      </button>
      <div className="managed-screen-sort">
        <label>
          Sort by
          <select
            value={draft.sort.field}
            onChange={(event) =>
              edit({
                ...draft,
                sort: {
                  ...draft.sort,
                  field: event.target
                    .value as FinancialScreenCriteriaDraft["sort"]["field"],
                },
              })
            }
          >
            <option value="symbol">Symbol</option>
            {MANAGED_FINANCIAL_SCREEN_FIELDS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order
          <select
            value={draft.sort.direction}
            onChange={(event) =>
              edit({
                ...draft,
                sort: {
                  ...draft.sort,
                  direction: event.target.value as "asc" | "desc",
                },
              })
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
    </>
  );
}
