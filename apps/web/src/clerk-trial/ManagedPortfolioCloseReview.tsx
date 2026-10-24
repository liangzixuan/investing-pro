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
  PortfolioCloseContext,
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
type Controller = { model: ReviewModel; context: PortfolioCloseContext | null };
function controllerIsCurrent(
  controller: Controller | null,
  context: PortfolioCloseContext | null,
  navigationPending: boolean,
) {
  if (navigationPending || !controller) return false;
  if (controller.context !== context) return false;
  return controller.model.isCurrent(context);
}
function useCloseController(
  workspace: ManagedWorkspace,
  navigationPending: boolean,
) {
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
  const [controller, setController] = useState<Controller | null>(null);
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
    controllerIsCurrent(controller, context, navigationPending);
  return { prices, state, current };
}
function loadCurrent(prices: ReviewModel | undefined, current: () => boolean) {
  if (!prices || !current()) return;
  void prices.load();
}
function selectCurrent(
  prices: ReviewModel | undefined,
  current: () => boolean,
  date: string,
) {
  if (!prices || !current()) return;
  prices.selectDate(date);
}
function researchCurrent(
  workspace: ManagedWorkspace,
  current: () => boolean,
  listingId: string,
  opener: HTMLButtonElement,
  onResearch: Props["onResearch"],
) {
  if (!current()) return;
  const draft = workspace.portfolio.coordinator.getSnapshot().draft;
  const exact = draft?.ledger?.identities.find(
    (item) => item.listingId === listingId,
  );
  if (draft && exact) onResearch(draft, exact, opener);
}
function Review({ workspace, navigationPending, onResearch }: Props) {
  const { prices, state, current } = useCloseController(
    workspace,
    navigationPending,
  );
  const ready = current();
  return (
    <PortfolioCloseReviewView
      ready={ready}
      state={ready ? state : empty}
      review={ready ? prices?.review() : null}
      onLoad={() => loadCurrent(prices, current)}
      onCancel={() => prices?.cancel()}
      onDate={(date) => selectCurrent(prices, current, date)}
      onResearch={(listingId, opener) =>
        researchCurrent(workspace, current, listingId, opener, onResearch)
      }
    />
  );
}

export function ManagedPortfolioCloseReview(props: Props) {
  const [open, setOpen] = useState(false);
  const research: Props["onResearch"] = (...args) => {
    setOpen(false);
    props.onResearch(...args);
  };
  return (
    <details
      className="managed-portfolio-close-review"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Dated holdings review</summary>
      {open && <Review {...props} onResearch={research} />}
    </details>
  );
}
