import { Component, createRef, type ReactNode } from "react";
import type { ManagedSecFilingsResponseDto } from "@research-cockpit/contracts";

interface RegionProps {
  children: ReactNode;
  response: ManagedSecFilingsResponseDto;
}

/** Capture focus before React removes rows, without reading the DOM in render. */
export class ManagedFilingsResultsRegion extends Component<RegionProps> {
  private readonly region = createRef<HTMLDivElement>();

  override getSnapshotBeforeUpdate(previous: RegionProps): Element | null {
    if (previous.response === this.props.response) return null;
    const region = this.region.current;
    const focused = region?.ownerDocument.activeElement;
    const row = focused?.closest(".managed-filings-list > li") ?? null;
    return row && region?.contains(row) ? row : null;
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
