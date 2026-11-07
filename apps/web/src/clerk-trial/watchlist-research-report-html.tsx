import type { WatchlistResearchReportHtmlDocument } from "./watchlist-research-report-ports";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  isPreparedWatchlistResearchReport,
  type PreparedWatchlistResearchReport,
} from "./managed-watchlist-research-pair";
import { WatchlistResearchReportSnapshot } from "./WatchlistResearchReportSnapshot";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";
export const WATCHLIST_RESEARCH_REPORT_HTML_MAX_BYTES = 8 * 1024 * 1024;
const owned = new WeakSet<object>();
export function isWatchlistResearchReportHtmlDocument(
  value: unknown,
): value is WatchlistResearchReportHtmlDocument {
  return typeof value === "object" && value !== null && owned.has(value);
}
export function watchlistResearchReportHtmlByteLength(
  text: string,
): number | null {
  if (!text.length) return null;
  if (text.length > WATCHLIST_RESEARCH_REPORT_HTML_MAX_BYTES) return null;
  if (/\p{Cs}/u.test(text)) return null;
  const bytes = new TextEncoder().encode(text).byteLength;
  return bytes > WATCHLIST_RESEARCH_REPORT_HTML_MAX_BYTES ? null : bytes;
}
/** Formats an owned capture in a detached document without application effects. */
export function formatWatchlistResearchReportHtml(
  report: PreparedWatchlistResearchReport,
): WatchlistResearchReportHtmlDocument | null {
  if (
    !isPreparedWatchlistResearchReport(report) ||
    typeof document === "undefined"
  )
    return null;
  const filename = `Investment-watchlist-research-${report.preparedAt.replace(/[-:.]/gu, "")}.html`;
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
    purpose.content = "investment.watchlist-research-html";
    const identity = page.createElement("meta");
    identity.name = "investment-report-filename";
    identity.content = filename;
    const title = page.createElement("title");
    title.textContent = "Watchlist company research";
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
          <WatchlistResearchReportSnapshot report={report} />
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
  const byteLength = watchlistResearchReportHtmlByteLength(text);
  if (byteLength === null) return null;
  const result: WatchlistResearchReportHtmlDocument = Object.freeze({
    purpose: "investment.watchlist-research-html",
    filename,
    text,
    byteLength,
  });
  owned.add(result);
  return result;
}
