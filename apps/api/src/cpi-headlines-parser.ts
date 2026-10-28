import {
  parseXml,
  XmlDeclaration,
  XmlElement,
  XmlText,
} from "@rgrove/parse-xml";
import {
  compareCpiSourceInstants,
  MANAGED_CPI_HEADLINE_SOURCE,
  MANAGED_CPI_HEADLINES_LIMITS,
  parseManagedCpiHeadline,
  parseManagedCpiHeadlines,
  type ManagedCpiHeadlineDto,
  type ManagedCpiHeadlinesDto,
} from "@research-cockpit/contracts";

export class CpiHeadlinesProviderError extends Error {
  constructor(readonly code: "unavailable" | "invalid_response" | "aborted") {
    super("CPI headlines unavailable");
    this.name = "CpiHeadlinesProviderError";
  }
}
function invalid(): never {
  throw new CpiHeadlinesProviderError("invalid_response");
}
const ATOM = "http://www.w3.org/2005/Atom";

function attributes(node: XmlElement, expected: readonly string[]) {
  const keys = Object.keys(node.attributes);
  if (
    keys.length !== expected.length ||
    expected.some((key) => !keys.includes(key))
  )
    invalid();
}
function elements(node: XmlElement): XmlElement[] {
  const result: XmlElement[] = [];
  for (const child of node.children) {
    if (child instanceof XmlElement) result.push(child);
    else if (!(child instanceof XmlText) || !/^[ \t\r\n]*$/u.test(child.text))
      invalid();
  }
  return result;
}
function scalar(node: XmlElement): string {
  attributes(node, []);
  let result = "";
  for (const child of node.children) {
    if (!(child instanceof XmlText)) invalid();
    result += child.text;
  }
  return result;
}
function fields(node: XmlElement, allowed: readonly string[]) {
  const result = new Map<string, XmlElement>();
  for (const child of elements(node)) {
    if (!allowed.includes(child.name) || result.has(child.name)) invalid();
    result.set(child.name, child);
  }
  return result;
}
function required(values: Map<string, XmlElement>, name: string): XmlElement {
  return values.get(name) ?? invalid();
}
function clock(values: Map<string, XmlElement>, name: string): string | null {
  const value = values.get(name);
  return value ? scalar(value) : null;
}
function feedRoot(text: string): XmlElement {
  if (
    new TextEncoder().encode(text).byteLength >
    MANAGED_CPI_HEADLINES_LIMITS.sourceBytes
  )
    invalid();
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) invalid();
  const root = documentRoot(text);
  if (root.name !== "feed") invalid();
  attributes(root, ["xmlns"]);
  if (root.attributes.xmlns !== ATOM) invalid();
  return root;
}
function declaration(node: XmlDeclaration) {
  if (node.version !== "1.0") invalid();
  if (node.encoding !== null && node.encoding.toLowerCase() !== "utf-8")
    invalid();
}
function documentRoot(text: string): XmlElement {
  const document = parseXml(text, {
    ignoreUndefinedEntities: false,
    preserveDocumentType: true,
    preserveXmlDeclaration: true,
    preserveCdata: false,
    preserveComments: true,
    includeOffsets: false,
    sortAttributes: false,
  });
  const roots: XmlElement[] = [];
  for (const node of document.children) {
    if (node instanceof XmlDeclaration) {
      declaration(node);
    } else if (node instanceof XmlElement) roots.push(node);
    else invalid();
  }
  const root = roots[0];
  if (roots.length !== 1 || !root) invalid();
  return root;
}
const CPI_FEED_METADATA = new Set([
  "id",
  "title",
  "subtitle",
  "updated",
  "logo",
  "icon",
  "author",
  "rights",
]);
/** Keep entry bounds and unique source metadata in one feed-owned collection. */
class CpiFeedParts {
  private readonly entries: XmlElement[] = [];
  private readonly metadata = new Map<string, XmlElement>();
  accept(node: XmlElement) {
    if (node.name === "entry") {
      this.entries.push(node);
      return;
    }
    if (!CPI_FEED_METADATA.has(node.name)) invalid();
    if (this.metadata.has(node.name)) invalid();
    this.metadata.set(node.name, node);
  }
  complete() {
    const entries = this.entries;
    if (entries.length > MANAGED_CPI_HEADLINES_LIMITS.inputEntries) invalid();
    return { entries, feedUpdatedAt: feedMetadata(this.metadata) };
  }
}
function feedParts(root: XmlElement) {
  const parts = new CpiFeedParts();
  for (const node of elements(root)) parts.accept(node);
  return parts.complete();
}
function feedMetadata(metadata: Map<string, XmlElement>): string | null {
  if (scalar(required(metadata, "id")) !== "bls.gov:feed:cpi") invalid();
  if (scalar(required(metadata, "title")) !== MANAGED_CPI_HEADLINE_SOURCE.topic)
    invalid();
  for (const [name, node] of metadata) {
    if (name === "author") author(node);
    else scalar(node);
  }
  return clock(metadata, "updated");
}
function author(node: XmlElement) {
  attributes(node, []);
  const values = fields(node, ["name", "uri"]);
  scalar(required(values, "name"));
  if (scalar(required(values, "uri")) !== "https://www.bls.gov") invalid();
}
function entry(node: XmlElement): ManagedCpiHeadlineDto {
  attributes(node, []);
  const values = fields(node, [
    "title",
    "link",
    "id",
    "content",
    "published",
    "updated",
    "category",
  ]);
  const link = required(values, "link");
  attributes(link, ["href"]);
  if (link.children.length !== 0) invalid();
  const category = values.get("category"),
    content = values.get("content");
  if (category && scalar(category) !== "News Release") invalid();
  if (content) scalar(content);
  return {
    sourceId: scalar(required(values, "id")),
    title: scalar(required(values, "title")),
    url: link.attributes.href!,
    publishedAt: clock(values, "published"),
    updatedAt: clock(values, "updated"),
  };
}
function uniqueEntries(entries: readonly XmlElement[]) {
  const byId = new Map<string, ManagedCpiHeadlineDto>(),
    byUrl = new Map<string, ManagedCpiHeadlineDto>();
  for (const node of entries) {
    const item = entry(node);
    // Validate every input entry, including duplicates and rows beyond the display cap.
    if (!parseManagedCpiHeadline(item)) invalid();
    const previous = byId.get(item.sourceId) ?? byUrl.get(item.url);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item))
      invalid();
    byId.set(item.sourceId, item);
    byUrl.set(item.url, item);
  }
  return [...byUrl.values()].sort((a, b) => {
    if (a.publishedAt === null) return b.publishedAt === null ? 0 : 1;
    if (b.publishedAt === null) return -1;
    return -compareCpiSourceInstants(a.publishedAt, b.publishedAt);
  });
}
/** Parse only qualified Atom metadata. Source/parser excerpts never leave this boundary. */
export function parseCpiHeadlinesAtom(
  text: string,
  fetchedAt: string,
): ManagedCpiHeadlinesDto {
  try {
    const { entries, feedUpdatedAt } = feedParts(feedRoot(text));
    const unique = uniqueEntries(entries);
    const packet = parseManagedCpiHeadlines({
      schemaVersion: "1.0.0",
      source: MANAGED_CPI_HEADLINE_SOURCE,
      fetchedAt,
      feedUpdatedAt,
      availableItemCount: unique.length,
      items: unique.slice(0, MANAGED_CPI_HEADLINES_LIMITS.shownEntries),
    });
    return packet ?? invalid();
  } catch {
    return invalid();
  }
}
