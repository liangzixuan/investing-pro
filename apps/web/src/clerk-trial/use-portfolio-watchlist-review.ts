import { useLayoutEffect, useRef, useState } from "react";
import type { ManagedWorkspace } from "./managed-workspace";
import {
  applyPortfolioWatchlist,
  isPortfolioWatchlistCurrent,
  preparePortfolioWatchlist,
  type PortfolioWatchlistPreview,
} from "./managed-portfolio-watchlist";
import {
  portfolioWatchlistSourceCurrent,
  type PortfolioWatchlistFrame,
  type PortfolioWatchlistProps,
} from "./managed-portfolio-watchlist-frame";

interface OwnedPortfolioPreview {
  readonly owner: ManagedWorkspace;
  readonly preview: PortfolioWatchlistPreview;
}
/** Commit and unmount own the live render token used by every action. */
function useCommittedPortfolioFrame(frame: PortfolioWatchlistFrame) {
  const committed = useRef<PortfolioWatchlistFrame | null>(null);
  useLayoutEffect(() => {
    committed.current = frame;
    return () => {
      committed.current = null;
    };
  });
  return committed;
}
/** Every action belongs to one committed render and its captured source lifetimes. */
export function usePortfolioWatchlistReview(
  frame: PortfolioWatchlistFrame,
  props: PortfolioWatchlistProps,
) {
  const [selection, setSelection] = useState("");
  const [owned, setOwned] = useState<OwnedPortfolioPreview | null>(null);
  const [notice, setNotice] = useState("");
  const committed = useCommittedPortfolioFrame(frame);
  const current = () => {
    if (committed.current !== frame) return false;
    if (!portfolioWatchlistSourceCurrent(frame, props)) return false;
    return frame.workspace.coordinator.getSnapshot() === frame.watchlist;
  };
  const preview = owned?.owner === frame.workspace ? owned.preview : null;
  const choose = (value: string) => {
    if (!current()) return;
    committed.current = null;
    setSelection(value);
    setOwned(null);
    setNotice("");
  };
  const prepare = () => {
    if (!selection) return;
    if (!current()) return;
    committed.current = null;
    const result = preparePortfolioWatchlist(frame.workspace, selection);
    if (!portfolioWatchlistSourceCurrent(frame, props)) return;
    setOwned(
      result.preview
        ? { owner: frame.workspace, preview: result.preview }
        : null,
    );
    setNotice(result.reason);
  };
  const apply = () => {
    if (!preview) return;
    if (preview.status !== "add") return;
    if (!current()) return;
    if (!isPortfolioWatchlistCurrent(frame.workspace, preview)) return;
    const applying = { ...frame };
    committed.current = applying;
    const result = applyPortfolioWatchlist(frame.workspace, preview);
    if (committed.current !== applying) return;
    if (!portfolioWatchlistSourceCurrent(frame, props)) return;
    committed.current = null;
    setOwned(null);
    setNotice(result.message);
  };
  const cancel = () => {
    if (committed.current !== frame) return;
    committed.current = null;
    setOwned(null);
    setNotice("");
  };
  const reviewWatchlist = () => {
    if (current()) props.onReviewWatchlist();
  };
  return {
    selection,
    preview,
    notice,
    choose,
    prepare,
    apply,
    cancel,
    reviewWatchlist,
  };
}
export type PortfolioWatchlistReview = ReturnType<
  typeof usePortfolioWatchlistReview
>;
