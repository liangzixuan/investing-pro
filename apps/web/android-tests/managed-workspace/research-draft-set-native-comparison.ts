import type { ManagedResearchDraftSetFileContent } from "../../src/clerk-trial/managed-research-draft-set-file";
import type { ResearchDraftSetFixtureControls } from "./research-draft-set-fixture";

/** Test-local value equality; its type-erased AST is bound to the native journey. */
export function sameJsonValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v: unknown, i: number) => sameJsonValue(v, b[i]))
    );
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (k) =>
        Object.hasOwn(b, k) &&
        sameJsonValue(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  );
}
export function chosenDraftSetValuesMatch(
  f: ManagedResearchDraftSetFileContent,
  e: ResearchDraftSetFixtureControls["data"]["captured"],
): boolean {
  const same = sameJsonValue;
  return (
    Object.keys(f.members).join("|") ===
      "watchlist|portfolio|followups|valuation" &&
    (["watchlist", "portfolio", "followups"] as const).every(
      (k) =>
        f.members[k]!.baseVersion === 3 &&
        f.members[k]!.accountScope === f.accountScope &&
        same(f.members[k]!.draft, e[k]),
    ) &&
    f.members.valuation!.accountScope === f.accountScope &&
    same(f.members.valuation!.payload, e.valuation)
  );
}
