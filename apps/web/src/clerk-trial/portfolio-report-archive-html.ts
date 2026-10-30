import { Parser } from "htmlparser2";
import {
  COMPANY_REPORT_HTML_CSP,
  COMPANY_REPORT_HTML_STYLE,
} from "./company-report-html-style";

export const PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_DEPTH = 64;
const MAX_ELEMENTS = 200_000;
const appendixSummary = "Complete report document and source packets";
const passive = new Set(
  "main article section h1 h2 h3 h4 p div span dl dt dd details summary pre ul ol li strong em small table thead tbody tr th td".split(
    " ",
  ),
);
type Frame = {
  name: string;
  text: string;
  summary: string | null;
  appendix: boolean;
};
function fail(): never {
  throw new TypeError("Portfolio HTML archive structure is invalid.");
}
function attributesAllowed(name: string, attributes: Record<string, string>) {
  for (const key of Object.keys(attributes)) {
    if (name === "html" && key === "lang" && attributes[key] === "en") continue;
    if (
      name === "meta" &&
      ["charset", "name", "content", "http-equiv"].includes(key)
    )
      continue;
    if (
      passive.has(name) &&
      /^(?:id|class|role|tabindex|scope|value|aria-[a-z-]+|data-[a-z-]+)$/u.test(
        key,
      )
    )
      continue;
    fail();
  }
}
function metadataKey(attributes: Record<string, string>): [string, string] {
  const keys = Object.keys(attributes).sort().join(",");
  if (keys === "charset") return ["charset", attributes.charset!];
  if (keys === "content,name") return [attributes.name!, attributes.content!];
  if (
    keys === "content,http-equiv" &&
    attributes["http-equiv"] === "Content-Security-Policy"
  )
    return ["policy", attributes.content!];
  return fail();
}

/** Streaming, passive extraction. No HTML is mounted or supplied to a browser parser. */
export function extractPortfolioReportArchive(bytes: ArrayBuffer): {
  json: string;
  filename: string;
} {
  if (
    !(bytes instanceof ArrayBuffer) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES
  )
    fail();
  const html = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: true,
  }).decode(bytes);
  const stack: Frame[] = [];
  const seen = new Map<string, number>();
  const metadata = new Map<string, string>();
  let attributes = new Set<string>();
  let openingName = "";
  let elements = 0;
  let textUnits = 0;
  let doctype = false;
  let json: string | null = null;
  let appendixCount = 0;
  let appendixSummaries = 0;
  // HTML mode normally discards unmatched closing tags. Refuse them before that recovery.
  class ArchiveParser extends Parser {
    override onclosetag(start: number, endIndex: number): void {
      if (stack.at(-1)?.name !== html.slice(start, endIndex).toLowerCase())
        fail();
      let end = endIndex;
      while (/[\t\n\f\r ]/u.test(html[end] ?? "x")) end += 1;
      if (html[end] !== ">") fail();
      if (stack.at(-1)?.name === "html" && html.slice(end + 1).trim()) fail();
      super.onclosetag(start, endIndex);
    }
  }
  const parser = new ArchiveParser(
    {
      onopentagname(name) {
        openingName = name;
        attributes = new Set();
      },
      onattribute(name, value) {
        if (attributes.has(name)) fail();
        attributes.add(name);
        // Validate raw attributes even if the library's object map omits a prototype key.
        attributesAllowed(openingName, { [name]: value });
      },
      onprocessinginstruction(name, data) {
        if (
          doctype ||
          stack.length ||
          elements ||
          name !== "!doctype" ||
          data.toLowerCase() !== "!doctype html"
        )
          fail();
        doctype = true;
      },
      onopentag(name, attrs, implied) {
        if (
          implied ||
          !doctype ||
          ++elements > MAX_ELEMENTS ||
          stack.length >= MAX_DEPTH
        )
          fail();
        const parent = stack.at(-1);
        if (parent && ["pre", "style", "title"].includes(parent.name)) fail();
        attributesAllowed(name, attrs);
        if (
          [
            "html",
            "head",
            "body",
            "title",
            "style",
            "main",
            "article",
          ].includes(name)
        ) {
          if (seen.has(name)) fail();
          seen.set(name, 1);
        }
        if (name === "html") {
          if (parent || attrs.lang !== "en") fail();
        } else if (name === "head") {
          if (parent?.name !== "html" || seen.has("body")) fail();
        } else if (name === "body") {
          if (parent?.name !== "html" || !seen.has("head")) fail();
        } else if (["meta", "style", "title"].includes(name)) {
          if (parent?.name !== "head") fail();
        } else if (
          !passive.has(name) ||
          !stack.some((frame) => frame.name === "body")
        )
          fail();
        if (name === "main" && parent?.name !== "body") fail();
        if (name === "article" && parent?.name !== "main") fail();
        if (name === "meta") {
          const [key, value] = metadataKey(attrs);
          if (metadata.has(key)) fail();
          metadata.set(key, value);
        }
        if (
          name === "summary" &&
          (parent?.name !== "details" || parent.summary !== null)
        )
          fail();
        const appendix = name === "pre";
        if (
          appendix &&
          (parent?.name !== "details" ||
            parent.summary !== appendixSummary ||
            !stack.some((frame) => frame.name === "article") ||
            ++appendixCount !== 1)
        )
          fail();
        stack.push({ name, text: "", summary: null, appendix });
      },
      ontext(text) {
        textUnits += text.length;
        if (textUnits > PORTFOLIO_REPORT_ARCHIVE_MAX_BYTES) fail();
        const frame = stack.at(-1);
        if (!frame) {
          if (text.trim()) fail();
          return;
        }
        if (["html", "head", "body"].includes(frame.name) && text.trim())
          fail();
        if (["pre", "summary", "style", "title"].includes(frame.name))
          frame.text += text;
      },
      oncomment(text) {
        if (
          text.trim() ||
          !stack.some((frame) => frame.name === "body") ||
          stack.at(-1)?.name === "pre"
        )
          fail();
      },
      oncdatastart: fail,
      onclosetag(name, implied) {
        const frame = stack.pop();
        if (!frame || frame.name !== name || (implied && name !== "meta"))
          fail();
        if (name === "summary") {
          const parent = stack.at(-1);
          if (parent?.name !== "details") fail();
          parent.summary = frame.text;
          if (frame.text === appendixSummary && ++appendixSummaries !== 1)
            fail();
        }
        if (frame.appendix) json = frame.text;
        if (name === "style" && frame.text !== COMPANY_REPORT_HTML_STYLE)
          fail();
        if (name === "title" && frame.text !== "Portfolio holdings review")
          fail();
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
    },
  );
  parser.end(html);
  if (
    stack.length ||
    !doctype ||
    json === null ||
    appendixCount !== 1 ||
    ["html", "head", "body", "title", "style", "main", "article"].some(
      (name) => !seen.has(name),
    )
  )
    fail();
  const expected = new Map([
    ["charset", "utf-8"],
    ["policy", COMPANY_REPORT_HTML_CSP],
    ["viewport", "width=device-width, initial-scale=1"],
    ["investment-report-format", "1"],
    ["investment-report-purpose", "investment.portfolio-review-html"],
  ]);
  if (
    metadata.size !== 6 ||
    [...expected].some(([key, value]) => metadata.get(key) !== value)
  )
    fail();
  const filename = metadata.get("investment-report-filename");
  if (!filename) fail();
  return { json, filename };
}
