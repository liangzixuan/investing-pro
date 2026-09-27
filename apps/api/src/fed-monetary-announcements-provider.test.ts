import { isPersonalMonetaryAnnouncementsDto } from "@research-cockpit/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFedMonetaryAnnouncementsProvider } from "./fed-monetary-announcements-provider";

const NOW = "2026-09-27T06:00:00.000Z";
const DATE = "Wed, 16 Sep 2026 18:00:00 GMT";
const url = (id = 1) =>
  `https://www.federalreserve.gov/newsevents/pressreleases/monetary${20260000 + id}a.htm`;
const item = (
  id = 1,
  title = "Synthetic announcement",
  date: string | null = DATE,
) =>
  `<item><title>${title}</title><link>${url(id)}</link>${date === null ? "" : `<pubDate>${date}</pubDate>`}</item>`;
const feed = (items = item()) =>
  `<rss version="2.0"><channel><title>FRB: Press Release - Monetary Policy</title><link>https://www.federalreserve.gov/feeds/feeds.htm</link>${items}</channel></rss>`;
function fixture(xml = feed()) {
  const fetch = vi.fn(() => Promise.resolve(new Response(xml)));
  const provider = createFedMonetaryAnnouncementsProvider({
    fetch,
    now: () => new Date(NOW),
  });
  return { fetch, provider };
}
afterEach(() => vi.useRealTimers());

describe("Federal Reserve monetary announcements provider", () => {
  it("performs no startup IO and one fixed credential-free fetch with deeply frozen output", async () => {
    const { fetch, provider } = fixture();
    expect(fetch).not.toHaveBeenCalled();
    const result = await provider.load();
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://www.federalreserve.gov/feeds/press_monetary.xml",
      {
        method: "GET",
        headers: { Accept: "application/rss+xml, application/xml;q=0.9" },
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    expect(isPersonalMonetaryAnnouncementsDto(result)).toBe(true);
    expect(result).toMatchObject({
      fetchedAt: NOW,
      availableItemCount: 1,
      items: [
        {
          title: "Synthetic announcement",
          url: url(),
          publishedAt: "2026-09-16T18:00:00.000Z",
        },
      ],
    });
    for (const value of [result, result.source, result.items, result.items[0]])
      expect(Object.isFrozen(value)).toBe(true);
  });

  it("decodes BOM, declaration, CDATA and entities once without flattening or fetching links", async () => {
    const xml =
      '\uFEFF<?xml version="1.0" encoding="uTf-8"?>' +
      feed(
        item(1, " <![CDATA[Board's &amp;]]> &#39; &#x1F600; &amp; ").replace(
          "</item>",
          `<guid><![CDATA[${url()}]]></guid><description><![CDATA[<b>ignored</b>]]></description><category>ignored</category></item>`,
        ),
      );
    const { provider, fetch } = fixture(xml);
    const result = await provider.load();
    expect(result.items[0]?.title).toBe("Board's &amp; ' 😀 &");
    expect(result.items[0]).not.toHaveProperty("description");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("sorts known dates descending and preserves source order for ties and missing dates", async () => {
    const result = await fixture(
      feed(
        item(1, "Unknown", null) +
          item(2, "Older", "Wed, 8 Apr 2026 18:00:00 GMT") +
          item(3, "First tie") +
          item(4, "Second tie") +
          item(5, "Unknown two", null),
      ),
    ).provider.load();
    expect(result.items.map((entry) => entry.url)).toEqual([
      url(3),
      url(4),
      url(2),
      url(1),
      url(5),
    ]);
    expect(result.items[2]?.publishedAt).toBe("2026-04-08T18:00:00.000Z");
    expect(result.items[3]?.publishedAt).toBeNull();
  });

  it("validates up to 128 input items, deduplicates equal URL records and limits only after sorting", async () => {
    const unique = Array.from({ length: 128 }, (_, index) =>
      item(index + 1),
    ).join("");
    const result = await fixture(feed(unique)).provider.load();
    expect(result.availableItemCount).toBe(128);
    expect(result.items).toHaveLength(10);
    expect(result.items.map((entry) => entry.url)).toEqual(
      Array.from({ length: 10 }, (_, index) => url(index + 1)),
    );
    expect(
      (await fixture(feed(item() + item())).provider.load()).availableItemCount,
    ).toBe(1);
    await expect(
      fixture(feed(unique + item())).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
    await expect(
      fixture(
        feed(
          unique.slice(0, unique.lastIndexOf("<item>")) +
            item(128, "bad\ncontrol"),
        ),
      ).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("accepts zero items, absent GUID and future source instants without inventing a date", async () => {
    expect((await fixture(feed("")).provider.load()).items).toEqual([]);
    expect(
      (
        await fixture(
          feed(item(1, "Future", "Fri, 1 Jan 2100 00:00:00 GMT")),
        ).provider.load()
      ).items[0]?.publishedAt,
    ).toBe("2100-01-01T00:00:00.000Z");
  });

  it.each([
    "",
    "not XML",
    "<rss/>",
    feed().replace('version="2.0"', 'version="1.0"'),
    feed().replace("<channel>", '<channel attr="x">'),
    feed().replace("<rss ", '<rss xmlns="urn:other" '),
    feed().replace("<item>", '<item attr="x">'),
    feed().replace("</channel>", "<extra/></channel>"),
    feed().replace("</item>", "<title>Duplicate</title></item>"),
    feed().replace("</item>", "<unknown/></item>"),
    feed().replace("Synthetic announcement", "<b>Nested</b>"),
    feed().replace("<title>Synthetic", '<title lang="en">Synthetic'),
    feed().replace("</channel>", "bad text</channel>"),
    feed().replace("FRB: Press Release - Monetary Policy", "Other feed"),
    feed().replace(
      "https://www.federalreserve.gov/feeds/feeds.htm",
      "https://example.test",
    ),
    feed().replace("<title>Synthetic announcement</title>", ""),
    feed().replace(`<link>${url()}</link>`, ""),
    feed().replace("</item>", "<guid/></item>"),
    feed().replace(
      "</item>",
      `<guid isPermaLink="true">${url()}</guid></item>`,
    ),
    feed().replace("</item>", `<guid>${url(2)}</guid></item>`),
    feed().replace("</item>", "<pubDate/></item>"),
    feed(item(1, "A") + item(1, "B")),
    feed(item(1) + item(1, "Synthetic announcement", null)),
    feed(item(1, "a".repeat(257))),
    feed(item(1, "   ")),
    feed(item(1, "line&#10;break")),
    feed(item(1, "zero&#x200B;width")),
    feed(item(1, "&undefined;")),
    feed(item(1, "&#0;")),
    feed(item(1, "&#x110000;")),
    feed(item(1, "&#xD800;")),
    '<?xml version="1.1"?>' + feed(),
    '<?xml version="1.0" encoding="ISO-8859-1"?>' + feed(),
    "<?instruction ignored?>" + feed(),
    feed().replace("</item>", "<?inside ignored?></item>"),
    '<!DOCTYPE rss SYSTEM "https://example.test/never-fetch.dtd">' + feed(),
    '<!DOCTYPE rss [<!ENTITY x "expansion">]>' + feed(),
    '<!DOCTYPE rss [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;">]>' +
      feed(item(1, "&b;")),
  ])(
    "rejects malformed or forbidden XML shape %# without partial output",
    async (xml) => {
      const { provider, fetch } = fixture(xml);
      await expect(provider.load()).rejects.toMatchObject({
        code: "invalid_response",
        message: "The Federal Reserve announcements are unavailable.",
      });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it.each([
    "",
    "Wed, 16 Sep 26 18:00:00 GMT",
    "Wed, 16 Sep 2026 18:00:00 +0000",
    "Wed, 16 Sep 2026 18:00:00 UTC",
    "Wed, 16 Sep 2026 18:00:60 GMT",
    "Wed, 16 Sep 2026 24:00:00 GMT",
    "Thu, 16 Sep 2026 18:00:00 GMT",
    "Sun, 30 Feb 2026 18:00:00 GMT",
    "Wed, 00 Sep 2026 18:00:00 GMT",
    "Wed, 16 Sep 2026 18:00:00 GMT extra",
    "wed, 16 Sep 2026 18:00:00 GMT",
    "Wed, 16 Sep 2026 18:60:00 GMT",
    "Wed, 16 Sep 0000 18:00:00 GMT",
  ])("rejects malformed supplied publication date %#", async (date) => {
    await expect(
      fixture(feed(item(1, "Title", date))).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([
    "http://www.federalreserve.gov/newsevents/pressreleases/monetary20260901a.htm",
    "https://federalreserve.gov/newsevents/pressreleases/monetary20260901a.htm",
    url() + "?query=1",
    url() + "#fragment",
    url().replace(".gov/", ".gov:443/"),
    url().replace("www.", "user@www."),
    url().replace("monetary", "%6donetary"),
    url().replace("/pressreleases/", "/a/../pressreleases/"),
    "/relative.htm",
  ])("rejects noncanonical announcement URL %#", async (link) => {
    await expect(
      fixture(feed().replace(url(), link)).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("rejects deep nesting with a safe error within the body cap", async () => {
    await expect(
      fixture(
        feed(item(1, "<a>".repeat(12000) + "x" + "</a>".repeat(12000))),
      ).provider.load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it.each([301, 400, 403, 429, 500])(
    "never retries upstream status %s",
    async (status) => {
      const fetch = vi.fn(() =>
        Promise.resolve(new Response("private-error-body", { status })),
      );
      await expect(
        createFedMonetaryAnnouncementsProvider({ fetch }).load(),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it("rejects redirected responses, malformed lengths, measured excess, bad UTF-8 and missing bodies", async () => {
    const redirected = new Response(feed());
    Object.defineProperty(redirected, "redirected", { value: true });
    await expect(
      createFedMonetaryAnnouncementsProvider({
        fetch: () => Promise.resolve(redirected),
      }).load(),
    ).rejects.toMatchObject({ code: "unavailable" });
    for (const response of [
      new Response(feed(), { headers: { "content-length": "262145" } }),
      new Response(feed(), { headers: { "content-length": "-1" } }),
      new Response("x".repeat(262145)),
      new Response(new Uint8Array([0xc3, 0x28])),
      new Response(null),
    ]) {
      await expect(
        createFedMonetaryAnnouncementsProvider({
          fetch: () => Promise.resolve(response),
        }).load(),
      ).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("accepts an exactly capped body and rejects a crossing chunk before retention without awaiting cancellation", async () => {
    const xml = feed();
    expect(
      (
        await fixture(
          xml + " ".repeat(262144 - new TextEncoder().encode(xml).length),
        ).provider.load()
      ).availableItemCount,
    ).toBe(1);
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(262144));
          controller.enqueue(new Uint8Array(1));
        },
        cancel,
      }),
    );
    await expect(
      createFedMonetaryAnnouncementsProvider({
        fetch: () => Promise.resolve(response),
      }).load(),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("captures fetchedAt after body completion", async () => {
    let clock = NOW;
    const response = new Response(
      new ReadableStream({
        pull(controller) {
          clock = "2026-09-27T06:00:04.000Z";
          controller.enqueue(new TextEncoder().encode(feed()));
          controller.close();
        },
      }),
    );
    const provider = createFedMonetaryAnnouncementsProvider({
      fetch: () => Promise.resolve(response),
      now: () => new Date(clock),
    });
    expect((await provider.load()).fetchedAt).toBe("2026-09-27T06:00:04.000Z");
  });

  it("uses one ten-second deadline across delayed fetch and a body that never completes", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) =>
          setTimeout(
            () =>
              resolve(new Response(new ReadableStream({ start() {}, cancel }))),
            6000,
          ),
        ),
    );
    const finished = expect(
      createFedMonetaryAnnouncementsProvider({ fetch }).load(),
    ).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(9999);
    expect(cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await finished;
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("bounds a fetch ignoring abort and suppresses its late result", async () => {
    vi.useFakeTimers();
    let resolve: ((value: Response) => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const finished = expect(
      createFedMonetaryAnnouncementsProvider({ fetch }).load(),
    ).rejects.toMatchObject({ code: "unavailable" });
    await vi.advanceTimersByTimeAsync(10000);
    await finished;
    resolve!(new Response(feed()));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("honors pre-abort, caller cancellation and close without new work", async () => {
    const already = new AbortController();
    already.abort();
    const initial = fixture();
    await expect(initial.provider.load(already.signal)).rejects.toMatchObject({
      code: "aborted",
    });
    expect(initial.fetch).not.toHaveBeenCalled();
    for (const action of ["caller", "close"] as const) {
      const fetch = vi.fn(() => new Promise<Response>(() => undefined));
      const provider = createFedMonetaryAnnouncementsProvider({ fetch });
      const caller = new AbortController();
      const finished = expect(
        provider.load(caller.signal),
      ).rejects.toMatchObject({ code: "aborted" });
      if (action === "caller") caller.abort();
      else provider.close();
      await finished;
      provider.close();
      await expect(provider.load()).rejects.toMatchObject({ code: "aborted" });
      expect(fetch).toHaveBeenCalledOnce();
    }
  });
});
