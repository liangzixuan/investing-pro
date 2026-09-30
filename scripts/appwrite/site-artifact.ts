import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const maximumArchiveBytes = 4 * 1024 * 1024;
export const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export interface SiteFile {
  path: string;
  sha256: string;
  bytes: number;
}
export interface SiteManifest {
  version: 1;
  sourceSha: string;
  archiveSha256: string;
  archiveBytes: number;
  files: SiteFile[];
}

export function validateBuiltFiles(
  sourceSha: string,
  files: Map<string, Buffer>,
): SiteFile[] {
  if (!/^[a-f0-9]{40}$/u.test(sourceSha))
    throw new Error("Invalid source identity.");
  if (files.size < 2 || files.size > 64)
    throw new Error("Unexpected static file count.");
  const index = files.get("index.html")?.toString("utf8");
  const expected = `<meta name="investment-build-sha" content="${sourceSha}">`;
  if (
    !index ||
    index.split('name="investment-build-sha"').length !== 2 ||
    !index.includes(expected)
  ) {
    throw new Error("Static build identity does not match source.");
  }
  let total = 0;
  return [...files]
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([path, bytes]) => {
      if (
        path !== "index.html" &&
        !/^assets\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]{8,}\.(?:js|css)$/u.test(path)
      ) {
        throw new Error("Unexpected static artifact path.");
      }
      total += bytes.length;
      if (bytes.length === 0 || total > 16 * 1024 * 1024)
        throw new Error("Static artifact exceeds its bounds.");
      return { path, sha256: digest(bytes), bytes: bytes.length };
    });
}

export function createManifest(
  sourceSha: string,
  files: Map<string, Buffer>,
  archive: Buffer,
): SiteManifest {
  if (archive.length === 0 || archive.length > maximumArchiveBytes)
    throw new Error("Archive size is outside the reviewed limit.");
  return {
    version: 1,
    sourceSha,
    archiveSha256: digest(archive),
    archiveBytes: archive.length,
    files: validateBuiltFiles(sourceSha, files),
  };
}

export async function packageSite(
  sourceSha: string,
  inputDirectory: string,
  outputDirectory: string,
) {
  const input = resolve(inputDirectory);
  const output = resolve(outputDirectory);
  const rootEntries = await readdir(input);
  if (
    rootEntries.length !== 2 ||
    !rootEntries.includes("index.html") ||
    !rootEntries.includes("assets")
  )
    throw new Error("Unexpected build directory contents.");
  const assets = await lstat(resolve(input, "assets"));
  if (!assets.isDirectory() || assets.isSymbolicLink())
    throw new Error("Assets must be a local directory.");
  const paths = [
    "index.html",
    ...(await readdir(resolve(input, "assets"))).map(
      (name) => `assets/${name}`,
    ),
  ];
  if (paths.length > 64) throw new Error("Too many static assets.");
  const files = new Map<string, Buffer>();
  for (const path of paths) {
    const info = await lstat(resolve(input, path));
    if (!info.isFile() || info.isSymbolicLink() || info.size > 16 * 1024 * 1024)
      throw new Error("Invalid static asset.");
    files.set(path, await readFile(resolve(input, path)));
  }
  const entries = validateBuiltFiles(sourceSha, files);
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  const archivePath = resolve(output, "site.tar.gz");
  // GNU tar on the Ubuntu runner; no shell interpolation or untrusted extraction.
  const result = spawnSync(
    "tar",
    [
      "--format=ustar",
      "--force-local",
      "--mtime=@0",
      "--owner=0",
      "--group=0",
      "--numeric-owner",
      "-czf",
      archivePath,
      "-C",
      input,
      "--",
      ...entries.map((entry) => entry.path),
    ],
    { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true },
  );
  if (result.error || result.status !== 0)
    throw new Error("Static archive packaging failed.");
  for (const entry of entries) {
    const info = await lstat(resolve(input, entry.path));
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      digest(await readFile(resolve(input, entry.path))) !== entry.sha256
    )
      throw new Error("Build changed during packaging.");
  }
  const manifest = createManifest(
    sourceSha,
    files,
    await readFile(archivePath),
  );
  await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv.length !== 2 || !process.env.GITHUB_SHA)
      throw new Error(
        "Run the fixed artifact packager from the release workflow.",
      );
    const manifest = await packageSite(
      process.env.GITHUB_SHA,
      "apps/web/dist/clerk-production",
      "dist/appwrite-release",
    );
    console.log(
      JSON.stringify({
        sourceSha: manifest.sourceSha,
        archiveSha256: manifest.archiveSha256,
        archiveBytes: manifest.archiveBytes,
      }),
    );
  } catch {
    console.error(
      "Static artifact packaging failed; no deployment was attempted.",
    );
    process.exitCode = 1;
  }
}
