import { readFileSync } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateArtifact } from "../../apps/api/scripts/appwrite-site-release";
import {
  createManifest,
  digest,
  packageSite,
  validateBuiltFiles,
} from "./site-artifact";

const sha = "a".repeat(40);
const fontPath = "assets/InterVariable-ABC12345.woff2";
const font = () =>
  readFileSync(
    new URL(
      "../../apps/web/src/clerk-trial/fonts/InterVariable.woff2",
      import.meta.url,
    ),
  );
const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

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
  it("binds the bundled WOFF2 bytes through build manifest and release parsing", () => {
    const input = files();
    const bytes = font();
    input.set(fontPath, bytes);
    const archive = Buffer.from("synthetic archive containing the bound files");
    const manifest = createManifest(sha, input, archive);
    expect(manifest.files).toContainEqual({
      path: fontPath,
      bytes: bytes.length,
      sha256: digest(bytes),
    });
    const serialized = Buffer.from(JSON.stringify(manifest));
    expect(validateArtifact(archive, serialized)).toEqual({
      manifest,
      manifestSha256: digest(serialized),
    });
    expect(() =>
      validateArtifact(Buffer.from("changed archive"), serialized),
    ).toThrow("invalid_evidence");
  });
  it.each(["truncated header", "header only", "signature", "declared length"])(
    "rejects a WOFF2 with invalid %s",
    (kind) => {
      const input = files();
      let bytes = font();
      if (kind === "truncated header") bytes = bytes.subarray(0, 12);
      else if (kind === "header only") bytes = bytes.subarray(0, 48);
      else if (kind === "signature") bytes.write("wOFF", 0, "ascii");
      else bytes.writeUInt32BE(bytes.length - 1, 8);
      input.set(fontPath, bytes);
      expect(() => validateBuiltFiles(sha, input)).toThrow(
        "Invalid static font header.",
      );
    },
  );
  it("rejects a linked asset directory before creating any archive output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "investment-site-font-"));
    directories.push(directory);
    const input = join(directory, "input");
    const target = join(directory, "linked-assets");
    const output = join(directory, "output");
    await mkdir(input);
    await mkdir(target);
    await writeFile(join(input, "index.html"), files().get("index.html")!);
    await writeFile(join(target, "InterVariable-ABC12345.woff2"), font());
    await symlink(target, join(input, "assets"), "junction");
    await expect(packageSite(sha, input, output)).rejects.toThrow(
      "Assets must be a local directory.",
    );
    await expect(access(output)).rejects.toMatchObject({ code: "ENOENT" });
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
    "assets/InterVariable.woff2",
    "assets/InterVariable-ABC.woff2",
    "assets/nested/InterVariable-ABC12345.woff2",
    "assets/../InterVariable-ABC12345.woff2",
    "assets/InterVariable-ABC12345.woff2.map",
    "assets/InterVariable-ABC12345.woff",
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
