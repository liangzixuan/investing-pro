import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManagedFilingsResults } from "./ManagedFilingsResults";
import { ManagedCompanyFilings } from "./ManagedCompanyFilings";
import { ManagedCompanyFilings as Model } from "./managed-company-filings";
import type { ManagedApi } from "./managed-api";
import { filingsResponse, filingsSelection } from "./sec-filings-fixture";
const hooks = vi.hoisted<{ state: unknown }>(() => ({ state: undefined }));
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      hooks.state ??= initial;
      return [
        hooks.state,
        (next: unknown) => {
          hooks.state = next;
        },
      ];
    },
  };
});
interface NodeProps {
  children?: React.ReactNode;
  onClick?: () => void;
  "aria-disabled"?: boolean;
}
function elements(node: React.ReactNode): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(node)) return [];
  return [
    node,
    ...React.Children.toArray(node.props.children).flatMap(elements),
  ];
}
function page(response = filingsResponse()) {
  const node = ManagedFilingsResults({ response });
  return {
    html: renderToStaticMarkup(node),
    buttons: elements(node).filter((element) => element.type === "button"),
    node,
  };
}
afterEach(() => {
  hooks.state = undefined;
});
describe("company SEC filings presentation", () => {
  it("shows exact source dates, accession links and 25 local rows with guarded focusable pagination", () => {
    const response = filingsResponse();
    let shown = page(response);
    expect(shown.html).toContain(
      'aria-label="SEC filings results" tabindex="0"',
    );
    expect(shown.html.match(/<li>/gu)).toHaveLength(25);
    expect(shown.html).toContain("26 filings · Page 1 of 2");
    expect(shown.html).toContain("Retrieved 2026-10-12T00:00:00.500Z");
    expect(shown.html).toContain("2026-07-15 to 2026-10-12");
    expect(shown.html).toContain("Report date");
    expect(shown.html).toContain("Not reported");
    expect(shown.html).toContain(
      "https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001-index.htm",
    );
    expect(shown.html).toContain("complete coverage");
    expect(shown.html).toContain("older continuation files");
    expect(shown.buttons[0]!.props["aria-disabled"]).toBe(true);
    shown.buttons[0]!.props.onClick!();
    expect(page(response).html).toBe(shown.html);
    shown.buttons[1]!.props.onClick!();
    shown = page(response);
    expect(shown.html.match(/<li>/gu)).toHaveLength(1);
    expect(shown.html).toContain("Page 2 of 2");
    expect(shown.html).toContain("0000000001-26-000026");
    expect(shown.html).not.toContain("0000000001-26-000001-index.htm");
    expect(shown.buttons[1]!.props["aria-disabled"]).toBe(true);
    shown.buttons[1]!.props.onClick!();
    expect(page(response).html).toBe(shown.html);
    shown.buttons[0]!.props.onClick!();
    expect(page(response).html).toContain("Page 1 of 2");
  });
  it("resets paging on replacement while keeping the same unkeyed results host and controls", () => {
    const response = filingsResponse(51);
    page(response).buttons[1]!.props.onClick!();
    expect(page(response).html).toContain("Page 2 of 3");
    const replacement = filingsResponse(1);
    const before = page(response).node;
    const after = page(replacement).node;
    expect(after.type).toBe(before.type);
    expect(after.key).toBeNull();
    expect(page(replacement).html).toContain("Page 1 of 1");
    expect(page(replacement).buttons).toHaveLength(2);
  });
  it("separates available-empty from failed source attempts and never labels failures retrieved", async () => {
    for (const status of [
      "available",
      "not_covered",
      "invalid_response",
      "rate_limited",
      "upstream_unavailable",
    ] as const) {
      hooks.state = undefined;
      const read = vi
        .fn<ManagedApi["recentFilings"]>()
        .mockResolvedValue(filingsResponse(0, status));
      const model = new Model(read, vi.fn());
      model.open(filingsSelection);
      await model.load();
      const html = renderToStaticMarkup(
        <ManagedCompanyFilings model={model} />,
      );
      if (status === "available")
        expect(html).toContain("No matching filings were observed");
      else {
        expect(html).not.toContain("No matching filings");
        expect(html).toContain("Checked 2026-10-12T00:00:00.500Z");
        expect(html).not.toContain("Retrieved");
        expect(html).toContain("contents were not successfully validated");
      }
      expect(html).not.toContain("Append");
      expect(read).toHaveBeenCalledOnce();
    }
  });
  it("shows previous source metadata separately from the latest failed check", async () => {
    const read = vi
      .fn<ManagedApi["recentFilings"]>()
      .mockResolvedValueOnce(filingsResponse());
    const model = new Model(read, vi.fn());
    model.open(filingsSelection);
    await model.load();
    read.mockResolvedValueOnce({
      ...filingsResponse(0, "upstream_unavailable"),
      completedAt: "2026-10-12T00:00:02.000Z",
    });
    await model.load();
    const html = renderToStaticMarkup(<ManagedCompanyFilings model={model} />);
    expect(html).toContain(
      "Showing the previous filings response, completed 2026-10-12T00:00:01.000Z",
    );
    expect(html).toContain(
      "Latest source attempt checked 2026-10-12T00:00:00.500Z; completed 2026-10-12T00:00:02.000Z",
    );
    expect(html).toContain("26 filings");
  });
});
