import type {
  PersonalSecInterimCanonicalResponseDto,
  PersonalSecInterimStatementsDto,
} from "@research-cockpit/contracts";
import { resolvePersonalSecInterimStatements } from "@research-cockpit/personal-financial-analytics";
import { isOwnedSecInterimCanonicalResponse } from "../lib/sec-interim-canonical-response";
export interface ManagedInterimView {
  readonly canonical: PersonalSecInterimCanonicalResponseDto["evidence"];
  readonly statements: PersonalSecInterimStatementsDto;
}
const views = new WeakMap<
  PersonalSecInterimCanonicalResponseDto,
  ManagedInterimView
>();
export function getManagedInterimView(
  response: unknown,
): ManagedInterimView | null {
  if (!isOwnedSecInterimCanonicalResponse(response)) return null;
  const prior = views.get(response);
  if (prior) return prior;
  const view = Object.freeze({
    canonical: response.evidence,
    statements: resolvePersonalSecInterimStatements(response.evidence),
  });
  views.set(response, view);
  return view;
}
