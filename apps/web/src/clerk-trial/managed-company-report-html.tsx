import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import type { PreparedCompanyReport } from "./managed-company-report";
import { formatCompanyReportDocument } from "./managed-company-report-document";
import { CompanyReportHtmlView } from "./CompanyReportHtmlView";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";

export const COMPANY_REPORT_HTML_MAX_BYTES = 8 * 1024 * 1024;
export interface CompanyReportHtmlDocument {
  readonly purpose: "investment.company-research-html";
  readonly filename: string;
  readonly text: string;
  readonly byteLength: number;
}
const owned = new WeakSet<object>();
const encoder = new TextEncoder();

/** Original formatter-owned objects only; no fields or hostile traps are read. */
export function isCompanyReportHtmlDocument(
  value: unknown,
): value is CompanyReportHtmlDocument {
  return typeof value === "object" && value !== null && owned.has(value);
}

/** Explicit file formatting only. It never mounts into the application document. */
export function formatCompanyReportHtml(
  report: PreparedCompanyReport,
): CompanyReportHtmlDocument | null {
  const json = formatCompanyReportDocument(report);
  if (!json || typeof document === "undefined") return null;
  let root: Root | null = null;
  let text: string | null = null;
  let failed = false;
  try {
    const page = document.implementation.createHTMLDocument();
    page.documentElement.lang = "en";
    const charset = page.createElement("meta");
    charset.setAttribute("charset", "utf-8");
    const viewport = page.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    const policy = page.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = COMPANY_REPORT_HTML_CSP;
    const title = page.createElement("title");
    title.textContent = `Company research · ${report.selection.listing.symbol}`;
    const style = page.createElement("style");
    style.textContent = COMPANY_REPORT_HTML_STYLE;
    page.head.replaceChildren(charset, policy, viewport, title, style);
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
        <CompanyReportHtmlView report={report} jsonText={json.text} />,
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
  const byteLength = companyReportHtmlByteLength(text);
  if (byteLength === null) return null;
  const result: CompanyReportHtmlDocument = Object.freeze({
    purpose: "investment.company-research-html",
    filename: json.filename.replace(/\.json$/u, ".html"),
    text,
    byteLength,
  });
  owned.add(result);
  return result;
}

/** Whole-output UTF-8 bound shared by detached-DOM formatting and serialization tests. */
export function companyReportHtmlByteLength(text: string): number | null {
  if (
    text.length === 0 ||
    text.length > COMPANY_REPORT_HTML_MAX_BYTES ||
    /\p{Cs}/u.test(text)
  )
    return null;
  const bytes = encoder.encode(text).byteLength;
  return bytes > COMPANY_REPORT_HTML_MAX_BYTES ? null : bytes;
}
