import type { ReactElement, RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { ManagedFilingsResultsRegion } from "./ManagedFilingsResultsRegion";
import { filingsResponse } from "./sec-filings-fixture";
import { response as annualResponse } from "../features/research/sec-annual-evidence-fixture";
import { compareManagedFilingsResponses } from "./managed-filings-refresh-comparison";
import {
  bindManagedFilingsFilter,
  initialManagedFilingsFilter,
  projectManagedFilingsFilter,
  selectManagedFilingsRefreshView,
} from "./managed-filings-filter";

// Controlled DOM port verifies snapshot/commit decisions. Browser focus remains a separate check.
function fixture(response = filingsResponse(0)) {
  const previous = { response: filingsResponse(1), children: null };
  const current = { response, children: null };
  const boundary = new ManagedFilingsResultsRegion(current);
  const row = {} as Element;
  const body = {} as Element;
  const ownerDocument = {
    body,
    activeElement: { closest: () => row } as unknown as Element,
  };
  const region = {
    ownerDocument,
    isConnected: true,
    contains: vi.fn(() => true),
    closest: vi.fn((): Element | null => null),
    getClientRects: vi.fn(() => [{}]),
    focus: vi.fn(),
  };
  const rendered = boundary.render() as ReactElement<{
    ref: RefObject<typeof region>;
  }>;
  rendered.props.ref.current = region;
  const remove = () => {
    region.contains.mockReturnValue(false);
    ownerDocument.activeElement = body;
  };
  return { boundary, row, previous, current, region, ownerDocument, remove };
}
describe("filings replacement focus boundary", () => {
  it("captures before removal, then restores the existing visible results region", () => {
    const f = fixture();
    const captured = f.boundary.getSnapshotBeforeUpdate(f.previous);
    expect(captured).toBe(f.row);
    f.remove();
    f.boundary.componentDidUpdate(f.previous, null, captured);
    expect(f.region.focus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
  });
  it("does not capture ordinary draft or page updates on the same response", () => {
    const f = fixture();
    expect(f.boundary.getSnapshotBeforeUpdate(f.current)).toBeNull();
  });
  it("recovers a focused new-only row beyond page one when the same response loses its comparison", () => {
    const response = filingsResponse(51);
    const comparison = compareManagedFilingsResponses(
      filingsResponse(26),
      response,
    )!;
    const initial = initialManagedFilingsFilter(response, null, comparison);
    const selected = selectManagedFilingsRefreshView(initial, initial, "new");
    const focusedFiling = response.issuer.filings[26]!;
    expect(projectManagedFilingsFilter(selected).rows).toContain(focusedFiling);
    const reset = bindManagedFilingsFilter(selected, response, null, null);
    expect(projectManagedFilingsFilter(reset).rows).not.toContain(
      focusedFiling,
    );
    expect(reset.response).toBe(response);
    const f = fixture(response);
    const previous = { ...f.current, refreshComparison: comparison };
    const captured = f.boundary.getSnapshotBeforeUpdate(previous);
    expect(captured).toBe(f.row);
    f.remove();
    f.boundary.componentDidUpdate(previous, null, captured);
    expect(f.region.focus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
  });
  it("recovers a removed page row when only the Annual baseline changes", async () => {
    const f = fixture();
    const previous = { ...f.current, baselineResponse: await annualResponse() };
    const captured = f.boundary.getSnapshotBeforeUpdate(previous);
    expect(captured).toBe(f.row);
    f.remove();
    f.boundary.componentDidUpdate(previous, null, captured);
    expect(f.region.focus).toHaveBeenCalledExactlyOnceWith({
      preventScroll: true,
    });
  });
  it("captures removed Annual context but preserves a newly focused date control", async () => {
    const f = fixture();
    const context = {} as Element;
    f.ownerDocument.activeElement = {
      closest: vi.fn(() => context),
    } as unknown as Element;
    const previous = { ...f.current, baselineResponse: await annualResponse() };
    const captured = f.boundary.getSnapshotBeforeUpdate(previous);
    expect(captured).toBe(context);
    f.remove();
    f.ownerDocument.activeElement = {} as Element;
    f.boundary.componentDidUpdate(previous, null, captured);
    expect(f.region.focus).not.toHaveBeenCalled();
  });
  it.each(["outside row", "outside region"])(
    "does not capture %s focus",
    (kind) => {
      const f = fixture();
      if (kind === "outside row")
        f.ownerDocument.activeElement = {
          closest: () => null,
        } as unknown as Element;
      else f.region.contains.mockReturnValue(false);
      expect(f.boundary.getSnapshotBeforeUpdate(f.previous)).toBeNull();
    },
  );
  it.each([
    "surviving row",
    "new focus",
    "disconnected",
    "hidden",
    "no layout",
    "no snapshot",
  ])("does not steal focus for %s", (kind) => {
    const f = fixture();
    const captured = f.boundary.getSnapshotBeforeUpdate(f.previous);
    f.remove();
    if (kind === "surviving row") f.region.contains.mockReturnValue(true);
    if (kind === "new focus") f.ownerDocument.activeElement = {} as Element;
    if (kind === "disconnected") f.region.isConnected = false;
    if (kind === "hidden") f.region.closest.mockReturnValue({} as Element);
    if (kind === "no layout") f.region.getClientRects.mockReturnValue([]);
    f.boundary.componentDidUpdate(
      f.previous,
      null,
      kind === "no snapshot" ? null : captured,
    );
    expect(f.region.focus).not.toHaveBeenCalled();
  });
});
