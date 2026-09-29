import { describe, expect, it } from "vitest";
import { createManifest, digest, validateBuiltFiles } from "./site-artifact";

const sha = "a".repeat(40);
const files = () =>
  new Map([
    [
      "index.html",
      Buffer.from(
        `<html><head><meta name="investment-build-sha" content="${sha}"></head></html>`,
      ),
    ],
    ["assets/index-ABC12345.js", Buffer.from("console.log('synthetic')")],
  ]);
describe("static release artifact", () => {
  it("binds source, archive and each allowed built file", () => {
    const archive = Buffer.from("synthetic archive");
    const manifest = createManifest(sha, files(), archive);
    expect(manifest).toMatchObject({
      version: 1,
      sourceSha: sha,
      archiveSha256: digest(archive),
      archiveBytes: archive.length,
    });
    expect(manifest.files).toEqual([
      {
        path: "assets/index-ABC12345.js",
        sha256: digest(files().get("assets/index-ABC12345.js")!),
        bytes: files().get("assets/index-ABC12345.js")!.length,
      },
      {
        path: "index.html",
        sha256: digest(files().get("index.html")!),
        bytes: files().get("index.html")!.length,
      },
    ]);
  });
  it.each(["", "a".repeat(39), "A".repeat(40), "a".repeat(41)])(
    "rejects invalid source identity %s",
    (value) => {
      expect(() => validateBuiltFiles(value, files())).toThrow();
    },
  );
  it.each([
    ".env",
    "../index.html",
    "assets/index.js",
    "assets/index-ABC12345.js.map",
    "assets/nested/index-ABC.js",
    "assets/extra.html",
  ])("rejects unexpected path %s", (path) => {
    const input = files();
    input.set(path, Buffer.from("extra"));
    expect(() => validateBuiltFiles(sha, input)).toThrow();
  });
  it.each(["missing", "other", "duplicate"])(
    "rejects %s build identity",
    (kind) => {
      const input = files();
      const html = input.get("index.html")!.toString();
      input.set(
        "index.html",
        Buffer.from(
          kind === "missing"
            ? "<html></html>"
            : kind === "other"
              ? html.replace(sha, "b".repeat(40))
              : html + html,
        ),
      );
      expect(() => validateBuiltFiles(sha, input)).toThrow();
    },
  );
  it("rejects empty or oversized archive", () => {
    expect(() => createManifest(sha, files(), Buffer.alloc(0))).toThrow();
    expect(() =>
      createManifest(sha, files(), Buffer.alloc(4 * 1024 * 1024 + 1)),
    ).toThrow();
  });
  it("rejects empty assets and excessive expanded size", () => {
    const input = files();
    input.set("assets/index-ABC12345.js", Buffer.alloc(0));
    expect(() => validateBuiltFiles(sha, input)).toThrow();
    input.set("assets/index-ABC12345.js", Buffer.alloc(16 * 1024 * 1024));
    expect(() => validateBuiltFiles(sha, input)).toThrow();
  });
});
