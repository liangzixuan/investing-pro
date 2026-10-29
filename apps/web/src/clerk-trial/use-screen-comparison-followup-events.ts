import type {
  ScreenComparisonFollowupReview,
  ScreenComparisonFollowupState,
} from "./use-screen-comparison-followup-state";

/** Each event belongs to one committed form snapshot, including an empty preview. */
export function screenComparisonFollowupEvents(
  controller: ScreenComparisonFollowupReview | null,
  token: object,
  state: ScreenComparisonFollowupState,
) {
  function invoke<T>(
    action: (owner: ScreenComparisonFollowupReview) => T,
  ): T | undefined {
    if (!controller) return;
    if (!controller.current(token, state)) return;
    return action(controller);
  }
  function setOpen(open: boolean) {
    if (!controller) return;
    if (!controller.currentDisclosure(token, state)) return;
    controller.setOpen(open);
  }
  const preview = state.preview;
  return {
    setOpen,
    capture: () => invoke((owner) => owner.capture()),
    edit: (field: "side" | "question" | "dueOn", value: string) =>
      invoke((owner) => owner.edit(field, value)),
    load: () => {
      invoke((owner) => {
        void owner.load();
      });
    },
    prepare: () => invoke((owner) => owner.prepare()),
    create: () =>
      invoke((owner) => {
        if (preview) owner.create(preview);
      }),
    review: (opener: HTMLButtonElement) =>
      invoke((owner) => owner.review(opener)),
    cancel: () => Boolean(invoke((owner) => owner.cancel())),
  };
}
const unavailable = {
  disabled: true,
  canCapture: false,
  canLoad: false,
  canPrepare: false,
  canReview: false,
};
export function screenComparisonFollowupActionStatus(
  controller: ScreenComparisonFollowupReview | null,
  navigationPending: boolean,
) {
  if (!controller) return unavailable;
  if (navigationPending) return unavailable;
  return {
    disabled: !controller.active(),
    canCapture: controller.canCapture(),
    canLoad: controller.canLoad(),
    canPrepare: controller.canPrepare(),
    canReview: controller.canReview(),
  };
}
export function screenComparisonFollowupReadout(
  controller: ScreenComparisonFollowupReview | null,
) {
  if (!controller) return { destinations: [], readinessReason: null };
  return {
    destinations: controller.destinations(),
    readinessReason: controller.readinessReason(),
  };
}
