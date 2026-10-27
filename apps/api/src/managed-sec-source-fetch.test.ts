import { describe, expect, it, vi } from "vitest";
import { createManagedSecSourceFetch } from "./managed-sec-source-fetch";
const CIK = "0000320193",
  CONTACT = "Invented source transport fixture@example.test";
const URLS = [
  `https://data.sec.gov/submissions/CIK${CIK}.json`,
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${CIK}.json`,
] as const;
function fixture() {
  const controller = new AbortController();
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(Response.json({ invented: true })),
  );
  const guard = vi.fn();
  const read = createManagedSecSourceFetch({
    cik: CIK,
    contact: CONTACT,
    fetch,
    controller,
    guard,
  });
  return { controller, fetch, guard, read };
}
function init(patch: RequestInit = {}): RequestInit {
  return {
    method: "GET",
    redirect: "error",
    credentials: "omit",
    cache: "no-store",
    signal: new AbortController().signal,
    headers: { "user-agent": CONTACT, accept: "application/json" },
    ...patch,
  };
}
describe("fixed managed SEC source sequence", () => {
  it("owns the source controls before an external options object can change", async () => {
    const controller = new AbortController(),
      fetch = vi.fn<typeof globalThis.fetch>(() =>
        Promise.resolve(Response.json({ invented: true })),
      ),
      changed = vi.fn<typeof globalThis.fetch>();
    const options = {
      cik: CIK,
      contact: CONTACT,
      fetch,
      controller,
      guard: () => undefined,
    };
    const read = createManagedSecSourceFetch(options);
    options.contact = "changed";
    options.fetch = changed;
    await (await read(URLS[0], init())).text();
    expect(fetch).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
  });
  it("permits exactly the orderedtwoGETs and rejects a third request without forwarding it", async () => {
    const f = fixture();
    expect(await (await f.read(URLS[0], init())).json()).toEqual({
      invented: true,
    });
    expect(await (await f.read(URLS[1], init())).json()).toEqual({
      invented: true,
    });
    await expect(f.read(URLS[1], init())).rejects.toThrow();
    expect(f.fetch.mock.calls.map(([url]) => url)).toEqual([...URLS]);
    expect(f.controller.signal.aborted).toBe(true);
  });
  it.each([
    URLS[1],
    "https://data.sec.gov/submissions/CIK0000000001.json",
    "https://www.sec.gov/Archives/edgar/data/1/primary.htm",
    "https://evil.example.test/source",
  ])("refuses source authority %s beforeHTTP", async (url) => {
    const f = fixture();
    await expect(f.read(url, init())).rejects.toThrow();
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.controller.signal.aborted).toBe(true);
  });
  it.each([
    { method: "POST" },
    { redirect: "follow" },
    { credentials: "include" },
    { cache: "default" },
    { body: "x" },
    { signal: null },
    { headers: { "user-agent": "different", accept: "application/json" } },
    { headers: { "user-agent": CONTACT, accept: "text/html" } },
  ] satisfies RequestInit[])(
    "refuses changed request controls %j",
    async (patch) => {
      const f = fixture();
      await expect(f.read(URLS[0], init(patch))).rejects.toThrow();
      expect(f.fetch).not.toHaveBeenCalled();
    },
  );
  it("rejects redirected URL/status and cancels a late returned body after the original guard expires", async () => {
    const f = fixture();
    const response = new Response("invented");
    Object.defineProperty(response, "url", {
      value: "https://evil.example.test/source",
    });
    f.fetch.mockResolvedValue(response);
    await expect(f.read(URLS[0], init())).rejects.toThrow();
    expect(f.controller.signal.aborted).toBe(true);
    const late = fixture();
    const cancel = vi.fn();
    late.fetch.mockImplementation(() => {
      late.guard.mockImplementation(() => {
        throw new Error("retired");
      });
      return Promise.resolve(new Response(new ReadableStream({ cancel })));
    });
    await expect(late.read(URLS[0], init())).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
    expect(late.fetch).toHaveBeenCalledOnce();
  });
});
