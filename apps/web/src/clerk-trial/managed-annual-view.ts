import type { PersonalSecAnnualCanonicalResponseDto } from "@research-cockpit/contracts";
import {
  derivePersonalSecAnnualCanonicalView,
  type PersonalSecAnnualCanonicalView,
} from "@research-cockpit/personal-financial-analytics";
import { isOwnedSecAnnualCanonicalResponse } from "../lib/sec-annual-canonical-response";

const views = new WeakMap<
  PersonalSecAnnualCanonicalResponseDto,
  PersonalSecAnnualCanonicalView
>();

/** One derived view per immutable admitted packet, shared by reading and note actions. */
export function getManagedAnnualView(
  response: unknown,
): PersonalSecAnnualCanonicalView | null {
  if (!isOwnedSecAnnualCanonicalResponse(response)) return null;
  const prior = views.get(response);
  if (prior) return prior;
  const view = derivePersonalSecAnnualCanonicalView(response.evidence);
  views.set(response, view);
  return view;
}
