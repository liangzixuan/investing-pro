import { Component, createRef, type ReactNode } from "react";
import type {
  ManagedSecFilingsResponseDto,
  PersonalSecAnnualEvidenceResponseDto,
} from "@research-cockpit/contracts";
import type { ManagedFilingsRefreshComparison } from "./managed-filings-refresh-comparison";

interface RegionProps {
  children: ReactNode;
  response: ManagedSecFilingsResponseDto;
  baselineResponse?: PersonalSecAnnualEvidenceResponseDto | null;
  refreshComparison?: ManagedFilingsRefreshComparison | null;
}

/** Capture focus before React removes rows, without reading the DOM in render. */
export class ManagedFilingsResultsRegion extends Component<RegionProps> {
  private readonly region = createRef<HTMLDivElement>();

  override getSnapshotBeforeUpdate(previous: RegionProps): Element | null {
    if (
      previous.response === this.props.response &&
      previous.baselineResponse === this.props.baselineResponse &&
      previous.refreshComparison === this.props.refreshComparison
    )
      return null;
    const region = this.region.current;
    const focused = region?.ownerDocument.activeElement;
    const previousContent =
      focused?.closest(
        ".managed-filings-list > li, .managed-filings-annual-context",
      ) ?? null;
    return previousContent && region?.contains(previousContent)
      ? previousContent
      : null;
  }

  override componentDidUpdate(
    _previous: RegionProps,
    _state: unknown,
    focusedRow: Element | null,
  ) {
    const region = this.region.current;
    if (!focusedRow || !region?.isConnected || region.contains(focusedRow))
      return;
    if (
      region.ownerDocument.activeElement !== region.ownerDocument.body ||
      region.closest("[hidden], [inert]") ||
      region.getClientRects().length === 0
    )
      return;
    region.focus({ preventScroll: true });
  }

  override render() {
    return (
      <div
        ref={this.region}
        className="managed-filings-results"
        role="region"
        aria-label="SEC filings results"
        tabIndex={0}
      >
        {this.props.children}
      </div>
    );
  }
}
