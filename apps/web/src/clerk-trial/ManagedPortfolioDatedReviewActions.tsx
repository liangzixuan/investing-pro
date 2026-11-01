import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import type { ManagedPortfolioCloseReview } from "./managed-portfolio-close-review";
import type { PortfolioDatedReviewReading } from "./managed-portfolio-dated-review-context";

export interface PortfolioDatedReviewNavigation {
  navigate: () => boolean;
  transferred: (
    reading: PortfolioDatedReviewReading,
    opener: HTMLButtonElement,
  ) => void;
}

/** Resource loading and the one-shot transfer are separate committed actions. */
export function ManagedPortfolioDatedReviewActions({
  workspace,
  prices,
  current,
  navigationPending,
  navigation,
}: {
  workspace: ManagedWorkspace;
  prices: ManagedPortfolioCloseReview | undefined;
  current: () => boolean;
  navigationPending: boolean;
  navigation: PortfolioDatedReviewNavigation;
}) {
  const model = workspace.portfolioDatedReview;
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const render = {
    model,
    state,
    prices,
    current,
    navigationPending,
    navigation,
  };
  const committed = useRef<typeof render | null>(null);
  useLayoutEffect(() => {
    committed.current = render;
    return () => {
      if (committed.current === render) committed.current = null;
    };
  });
  const accepts = () =>
    committed.current === render &&
    !navigationPending &&
    model.getSnapshot() === state;
  const priceState = prices?.getSnapshot();
  const settled =
    !!prices && current() && !priceState?.running && !!priceState?.selectedDate;
  return (
    <section
      className="managed-portfolio-dated-actions"
      aria-label="Review checks with this dated Portfolio"
    >
      <h3>Review held-company checks</h3>
      <p>
        Carry this complete dated reading into an ordered review of current
        held-company checks. Loading Follow-ups, choosing checks and Save remain
        separate actions.
      </p>
      {state.reason && <p role="status">{state.reason}</p>}
      <div className="trial-actions">
        <button
          type="button"
          id="portfolio-dated-load-followups"
          className="trial-secondary"
          disabled={navigationPending || !state.canLoadFollowups}
          onClick={() => {
            if (accepts() && state.canLoadFollowups)
              void model.loadFollowups(state);
          }}
        >
          Load Follow-ups for review
        </button>
        <button
          type="button"
          id="portfolio-dated-review-transfer"
          disabled={navigationPending || !state.canTransfer || !settled}
          onClick={(event) => {
            if (
              !accepts() ||
              !state.canTransfer ||
              !settled ||
              !prices ||
              prices.getSnapshot() !== priceState ||
              !current()
            )
              return;
            const opener = event.currentTarget;
            const reading = model.transfer(prices, navigation.navigate);
            if (reading && model.getSnapshot().reading === reading)
              navigation.transferred(reading, opener);
          }}
        >
          Review held-company checks
        </button>
      </div>
    </section>
  );
}
