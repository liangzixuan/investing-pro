import type { ManagedScreenComparisonFollowupContext } from "./managed-screen-comparison-followup-context";
import {
  prepareScreenComparisonFollowup,
  type ScreenComparisonFollowupCapture,
  type ScreenComparisonFollowupChoice,
  type ScreenComparisonFollowupPreparation,
} from "./managed-screen-comparison-followup";

type AuthoredComparisonChoice = ScreenComparisonFollowupChoice & {
  readonly side: string;
};

function preparation(
  context: ManagedScreenComparisonFollowupContext,
  capture: ScreenComparisonFollowupCapture,
  choice: AuthoredComparisonChoice,
  current: () => boolean,
) {
  const result = context.capturePort(capture, choice.side);
  if (!result.port) return { preview: null, reason: result.reason };
  return prepareScreenComparisonFollowup(result.port, choice, current);
}
function currentPreparation(
  prepared: ScreenComparisonFollowupPreparation,
  current: () => boolean,
) {
  if (!current()) return false;
  if (!prepared.preview) return true;
  return prepared.preview.isCurrent();
}
/** Adopt only the preparation that still owns this form after domain admission. */
export function prepareOwnedScreenComparisonFollowup(
  context: ManagedScreenComparisonFollowupContext,
  capture: ScreenComparisonFollowupCapture,
  choice: AuthoredComparisonChoice,
  current: () => boolean,
) {
  const prepared = preparation(context, capture, choice, current);
  if (currentPreparation(prepared, current)) return prepared;
  prepared.preview?.cancel();
  return null;
}
