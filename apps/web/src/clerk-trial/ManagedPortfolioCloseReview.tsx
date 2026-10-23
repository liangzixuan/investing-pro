import {
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { PortfolioDraft } from "./managed-portfolio";
import type { PersonalPortfolioIdentity } from "@research-cockpit/contracts";
import type {
  ManagedPortfolioCloseReview as ReviewModel,
  PortfolioCloseState,
} from "./managed-portfolio-close-review";
import { capturePortfolioCloseContext } from "./portfolio-close-review-context";
import { PortfolioCloseReviewView } from "./PortfolioCloseReviewView";

const empty: PortfolioCloseState = Object.freeze({
  rows: [],
  dates: [],
  selectedDate: "",
  running: false,
  message: "",
});
const emptySnapshot = () => empty;
const emptySubscribe = () => () => {};
type Props = {
  workspace: ManagedWorkspace;
  navigationPending: boolean;
  onResearch: (
    draft: PortfolioDraft,
    listing: PersonalPortfolioIdentity,
    opener: HTMLButtonElement,
  ) => void;
};
function Review({ workspace, navigationPending, onResearch }: Props) {
  const view = useSyncExternalStore(
    workspace.subscribe,
    workspace.getSnapshot,
    workspace.getSnapshot,
  );
  const model = workspace.portfolio;
  const saved = useSyncExternalStore(
    model.coordinator.subscribe,
    model.coordinator.getSnapshot,
    model.coordinator.getSnapshot,
  );
  const portfolio = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const session = useSyncExternalStore(
    workspace.sessionOwner.subscribe,
    workspace.sessionOwner.getSnapshot,
    workspace.sessionOwner.getSnapshot,
  );
  const context = useMemo(
    () => (navigationPending ? null : capturePortfolioCloseContext(workspace)),
    [workspace, view, saved, portfolio, session, navigationPending],
  );
  const [controller, setController] = useState<{
    model: ReviewModel;
    context: typeof context;
  } | null>(null);
  useLayoutEffect(() => {
    const next = workspace.createPortfolioCloseReview();
    next.enter(context);
    setController({ model: next, context });
    return () => next.retire();
  }, [workspace, context]);
  const prices = controller?.model;
  const state = useSyncExternalStore(
    prices?.subscribe ?? emptySubscribe,
    prices?.getSnapshot ?? emptySnapshot,
    prices?.getSnapshot ?? emptySnapshot,
  );
  const current = () =>
    !navigationPending &&
    controller?.context === context &&
    prices?.isCurrent(context) === true;
  const ready = current();
  const review = ready ? prices?.review() : null;
  return (
    <PortfolioCloseReviewView
      ready={ready}
      state={ready ? state : empty}
      review={review}
      onLoad={() => {
        if (current()) void prices?.load();
      }}
      onCancel={() => prices?.cancel()}
      onDate={(date) => {
        if (current()) prices?.selectDate(date);
      }}
      onResearch={(listingId, opener) => {
        if (!current()) return;
        const draft = model.coordinator.getSnapshot().draft;
        const exact = draft?.ledger?.identities.find(
          (item) => item.listingId === listingId,
        );
        if (draft && exact) onResearch(draft, exact, opener);
      }}
    />
  );
}

export function ManagedPortfolioCloseReview(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="managed-portfolio-close-review"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Dated holdings review</summary>
      {open && <Review {...props} />}
    </details>
  );
}
