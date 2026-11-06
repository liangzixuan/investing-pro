import { expect, it, vi } from "vitest";
import { init } from "./echarts";

it("renders registered line/bar, markers, legend and inside zoom with the production SVG renderer", () => {
  const error = vi.spyOn(console, "error");
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width: 640,
    height: 400,
  });
  try {
    chart.setOption({
      animation: false,
      aria: { enabled: true },
      grid: {},
      legend: { data: ["Price", "Revenue"] },
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      xAxis: { type: "category", data: ["First", "Second", "Third"] },
      yAxis: { type: "value" },
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
      series: [
        {
          name: "Price",
          type: "line",
          data: [2, 4, 3],
          markPoint: { data: [{ type: "max", name: "Peak" }] },
        },
        {
          name: "Revenue",
          type: "bar",
          data: [1, 2, 3],
          markLine: { data: [{ yAxis: 2, name: "Reference" }] },
        },
      ],
    });
    const svg = chart.renderToSVGString();
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
    expect(svg).toContain("Price");
    expect(svg).toContain("Revenue");
    expect(svg).toContain("First");
    expect(chart.getOption().series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "line",
          markPoint: expect.any(Object) as unknown,
        }),
        expect.objectContaining({
          type: "bar",
          markLine: expect.any(Object) as unknown,
        }),
      ]),
    );
    chart.dispatchAction({ type: "dataZoom", start: 25, end: 75 });
    expect(chart.getOption().dataZoom).toEqual([
      expect.objectContaining({ type: "inside", start: 25, end: 75 }),
    ]);
    chart.dispatchAction({ type: "hideTip" });
    expect(error).not.toHaveBeenCalled();
  } finally {
    chart.dispose();
    error.mockRestore();
  }
});
