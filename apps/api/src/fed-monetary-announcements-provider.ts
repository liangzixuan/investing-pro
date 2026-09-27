import {
  parseXml,
  XmlDeclaration,
  XmlElement,
  XmlText,
} from "@rgrove/parse-xml";
import {
  isPersonalMonetaryAnnouncementsDto,
  isPersonalMonetaryAnnouncementUrl,
  PERSONAL_FED_MONETARY_SOURCE,
  PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_INPUT_ITEMS,
  PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_ITEMS,
  PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_TITLE_LENGTH,
  PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_URL_LENGTH,
  type PersonalMonetaryAnnouncementsDto,
  type PersonalMonetaryAnnouncementDto,
} from "@research-cockpit/contracts";
const SOURCE_URL = PERSONAL_FED_MONETARY_SOURCE.feedUrl;
const MAX_BYTES = 256 * 1_024;
const DEADLINE_MILLISECONDS = 10_000;
export class FedMonetaryAnnouncementsProviderError extends Error {
  constructor(readonly code: "unavailable" | "invalid_response" | "aborted") {
    super("The Federal Reserve announcements are unavailable.");
    this.name = "FedMonetaryAnnouncementsProviderError";
  }
}
export interface FedMonetaryAnnouncementsProvider {
  load(signal?: AbortSignal): Promise<PersonalMonetaryAnnouncementsDto>;
  close(): void;
}
interface Dependencies {
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
}

/** A fixed public feed source. Construction never acquires data. */
export function createFedMonetaryAnnouncementsProvider(
  dependencies: Dependencies = {},
): FedMonetaryAnnouncementsProvider {
  return new PublicFedMonetaryAnnouncementsProvider(dependencies);
}

class PublicFedMonetaryAnnouncementsProvider implements FedMonetaryAnnouncementsProvider {
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #active = new Set<AbortController>();
  #closed = false;

  constructor(dependencies: Dependencies) {
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
  }

  close(): void {
    this.#closed = true;
    for (const controller of this.#active) controller.abort();
    this.#active.clear();
  }

  async load(signal?: AbortSignal): Promise<PersonalMonetaryAnnouncementsDto> {
    if (this.#closed || signal?.aborted) fail("aborted");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    this.#active.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DEADLINE_MILLISECONDS);
    try {
      const response = await withAbort(
        this.#fetch(SOURCE_URL, {
          method: "GET",
          headers: { Accept: "application/rss+xml, application/xml;q=0.9" },
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          signal: controller.signal,
        }),
        controller.signal,
      );
      if (response.status !== 200 || response.redirected) {
        void response.body?.cancel().catch(() => undefined);
        fail("unavailable");
      }
      const text = await readBoundedText(response, controller.signal);
      if (controller.signal.aborted) fail("aborted");
      const fetchedAt = this.#now().toISOString();
      const result = normalizeFeed(text, fetchedAt);
      if (controller.signal.aborted || this.#closed) fail("aborted");
      return result;
    } catch (error) {
      if (this.#closed || signal?.aborted) fail("aborted");
      if (timedOut) fail("unavailable");
      if (error instanceof FedMonetaryAnnouncementsProviderError) throw error;
      if (error instanceof SyntaxError || error instanceof RangeError)
        fail("invalid_response");
      return fail("unavailable");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      this.#active.delete(controller);
    }
  }
}

function fail(code: FedMonetaryAnnouncementsProviderError["code"]): never {
  throw new FedMonetaryAnnouncementsProviderError(code);
}

function normalizeFeed(
  text: string,
  fetchedAt: string,
): PersonalMonetaryAnnouncementsDto {
  let document;
  try {
    document = parseXml(text, {
      ignoreUndefinedEntities: false,
      preserveDocumentType: true,
      preserveXmlDeclaration: true,
      preserveCdata: false,
      preserveComments: false,
      includeOffsets: false,
      sortAttributes: false,
    });
  } catch {
    // Parser messages can contain source excerpts. Never expose them.
    fail("invalid_response");
  }
  const roots: XmlElement[] = [];
  for (const node of document.children) {
    if (node instanceof XmlDeclaration) {
      if (
        node.version !== "1.0" ||
        (node.encoding !== null && node.encoding.toLowerCase() !== "utf-8")
      )
        fail("invalid_response");
    } else if (node instanceof XmlElement) roots.push(node);
    else fail("invalid_response");
  }
  const root = roots[0];
  if (
    roots.length !== 1 ||
    root === undefined ||
    root.name !== "rss" ||
    Object.keys(root.attributes).length !== 1 ||
    root.attributes.version !== "2.0"
  )
    fail("invalid_response");
  const rootChildren = elements(root);
  const channel = rootChildren[0];
  if (
    rootChildren.length !== 1 ||
    channel === undefined ||
    channel.name !== "channel"
  )
    fail("invalid_response");
  noAttributes(channel);
  const fields = new Map<string, string>();
  const inputItems: XmlElement[] = [];
  for (const node of elements(channel)) {
    if (node.name === "item") inputItems.push(node);
    else {
      if (
        !["title", "link", "description", "language"].includes(node.name) ||
        fields.has(node.name)
      )
        fail("invalid_response");
      fields.set(node.name, scalar(node));
    }
  }
  if (
    fields.get("title") !== "FRB: Press Release - Monetary Policy" ||
    fields.get("link") !== PERSONAL_FED_MONETARY_SOURCE.directoryUrl ||
    inputItems.length > PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_INPUT_ITEMS
  )
    fail("invalid_response");
  const unique = new Map<string, PersonalMonetaryAnnouncementDto>();
  for (const node of inputItems) {
    noAttributes(node);
    const values = new Map<string, string>();
    for (const child of elements(node)) {
      if (
        ![
          "title",
          "link",
          "guid",
          "pubDate",
          "description",
          "category",
        ].includes(child.name) ||
        values.has(child.name)
      )
        fail("invalid_response");
      values.set(child.name, scalar(child));
    }
    const title = values.get("title");
    const url = values.get("link");
    if (
      title === undefined ||
      title.length === 0 ||
      title.length > PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_TITLE_LENGTH ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(title) ||
      !isPersonalMonetaryAnnouncementUrl(url)
    )
      fail("invalid_response");
    const guid = values.get("guid");
    if (
      guid !== undefined &&
      (guid.length === 0 ||
        guid.length > PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_URL_LENGTH ||
        guid !== url)
    )
      fail("invalid_response");
    const date = values.get("pubDate");
    const publishedAt = date === undefined ? null : publicationInstant(date);
    const previous = unique.get(url);
    if (previous !== undefined) {
      if (previous.title !== title || previous.publishedAt !== publishedAt)
        fail("invalid_response");
    } else unique.set(url, { title, url, publishedAt });
  }
  // Stable sorting preserves source order for ties and unknown publication times.
  const ordered = [...unique.values()].sort((left, right) => {
    if (left.publishedAt === right.publishedAt) return 0;
    if (left.publishedAt === null) return 1;
    if (right.publishedAt === null) return -1;
    return left.publishedAt > right.publishedAt ? -1 : 1;
  });
  const result = {
    schemaVersion: "1.0.0" as const,
    source: PERSONAL_FED_MONETARY_SOURCE,
    fetchedAt,
    availableItemCount: unique.size,
    items: ordered.slice(0, PERSONAL_MONETARY_ANNOUNCEMENTS_MAXIMUM_ITEMS),
  };
  if (!isPersonalMonetaryAnnouncementsDto(result)) fail("invalid_response");
  return Object.freeze({
    ...result,
    items: Object.freeze(result.items.map((item) => Object.freeze(item))),
  });
}

function noAttributes(node: XmlElement): void {
  if (Object.keys(node.attributes).length !== 0) fail("invalid_response");
}

function elements(node: XmlElement): XmlElement[] {
  const children: XmlElement[] = [];
  for (const child of node.children) {
    if (child instanceof XmlElement) children.push(child);
    else if (!(child instanceof XmlText) || !/^[ \t\r\n]*$/u.test(child.text))
      fail("invalid_response");
  }
  return children;
}

function scalar(node: XmlElement): string {
  noAttributes(node);
  let text = "";
  for (const child of node.children) {
    if (!(child instanceof XmlText)) fail("invalid_response");
    text += child.text;
  }
  return text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/gu, "");
}

function publicationInstant(value: string): string {
  if (value.length > 64) fail("invalid_response");
  const match =
    /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([0-9]{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([1-9][0-9]{3}) ([0-9]{2}):([0-9]{2}):([0-9]{2}) GMT$/u.exec(
      value,
    );
  if (match === null) fail("invalid_response");
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = Number(match[2]);
  const month = months.indexOf(match[3] ?? "");
  const year = Number(match[4]);
  const hour = Number(match[5]);
  const minute = Number(match[6]);
  const second = Number(match[7]);
  const date = new Date(Date.UTC(year, month, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    weekdays[date.getUTCDay()] !== match[1]
  )
    fail("invalid_response");
  return date.toISOString();
}

async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) fail("aborted");
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        abort = () =>
          reject(new FedMonetaryAnnouncementsProviderError("aborted"));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

async function readBoundedText(response: Response, signal: AbortSignal) {
  const length = response.headers.get("content-length");
  if (
    length !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(length) || Number(length) > MAX_BYTES)
  ) {
    void response.body?.cancel().catch(() => undefined);
    fail("invalid_response");
  }
  if (response.body === null) fail("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await withAbort(reader.read(), signal);
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) fail("invalid_response");
      size += result.value.byteLength;
      if (size > MAX_BYTES) fail("invalid_response");
      chunks.push(result.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (size === 0) fail("invalid_response");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("invalid_response");
  }
}
