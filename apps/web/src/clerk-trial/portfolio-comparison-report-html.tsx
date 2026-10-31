import type { PortfolioComparisonReportHtmlDocument } from "./portfolio-comparison-report-ports";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  isPreparedPortfolioComparisonReport,
  type PreparedPortfolioComparisonReport,
} from "./portfolio-comparison-report";
import { PortfolioComparisonReportSnapshot } from "./PortfolioComparisonReportSnapshot";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";
export const PORTFOLIO_COMPARISON_REPORT_HTML_MAX_BYTES = 8 * 1024 * 1024;
const owned = new WeakSet<object>();
export function isPortfolioComparisonReportHtmlDocument(
  value: unknown,
): value is PortfolioComparisonReportHtmlDocument {
  return typeof value === "object" && value !== null && owned.has(value);
}
export function portfolioComparisonReportHtmlByteLength(
  text: string,
): number | null {
  if (!text.length) return null;
  if (text.length > PORTFOLIO_COMPARISON_REPORT_HTML_MAX_BYTES) return null;
  if (/\p{Cs}/u.test(text)) return null;
  const bytes = new TextEncoder().encode(text).byteLength;
  return bytes > PORTFOLIO_COMPARISON_REPORT_HTML_MAX_BYTES ? null : bytes;
}
/** Formats an owned capture in a detached document without application effects. */
export function formatPortfolioComparisonReportHtml(
  report: PreparedPortfolioComparisonReport,
): PortfolioComparisonReportHtmlDocument | null {
  if (
    !isPreparedPortfolioComparisonReport(report) ||
    typeof document === "undefined"
  )
    return null;
  const filename = `Investment-portfolio-comparison-${report.preparedAt.replace(/[-:.]/gu, "")}.html`;
  let root: Root | null = null;
  let text: string | null = null;
  let failed = false;
  try {
    const page = document.implementation.createHTMLDocument();
    page.documentElement.lang = "en";
    const charset = page.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    const policy = page.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = COMPANY_REPORT_HTML_CSP;
    const viewport = page.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    const format = page.createElement("meta");
    format.name = "investment-report-format";
    format.content = "1";
    const purpose = page.createElement("meta");
    purpose.name = "investment-report-purpose";
    purpose.content = "investment.portfolio-comparison-html";
    const identity = page.createElement("meta");
    identity.name = "investment-report-filename";
    identity.content = filename;
    const title = page.createElement("title");
    title.textContent = "Portfolio saved/current comparison";
    const style = page.createElement("style");
    style.textContent = COMPANY_REPORT_HTML_STYLE;
    page.head.replaceChildren(
      charset,
      policy,
      viewport,
      format,
      purpose,
      identity,
      title,
      style,
    );
    root = createRoot(page.body, {
      onUncaughtError: () => {
        failed = true;
      },
      onRecoverableError: () => {
        failed = true;
      },
    });
    flushSync(() => {
      root!.render(
        <main>
          <PortfolioComparisonReportSnapshot report={report} />
        </main>,
      );
    });
    if (!failed) text = `<!doctype html>\n${page.documentElement.outerHTML}\n`;
  } catch {
    failed = true;
  } finally {
    try {
      root?.unmount();
    } catch {
      failed = true;
    }
  }
  if (failed || !text) return null;
  const byteLength = portfolioComparisonReportHtmlByteLength(text);
  if (byteLength === null) return null;
  const result: PortfolioComparisonReportHtmlDocument = Object.freeze({
    purpose: "investment.portfolio-comparison-html",
    filename,
    text,
    byteLength,
  });
  owned.add(result);
  return result;
}
