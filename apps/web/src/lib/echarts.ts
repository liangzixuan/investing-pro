import { use } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomInsideComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

// One runtime registry for browser, Android and their fixtures. SVG is used by
// ValuationHistoryChart; the other current charts use Canvas.
use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  LegendComponent,
  DataZoomInsideComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
  SVGRenderer,
]);

export { init } from "echarts/core";
export type { ECharts } from "echarts/core";
export type { TooltipComponentFormatterCallbackParams } from "echarts";
