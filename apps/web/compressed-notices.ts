import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import type { Plugin } from "vite";

const id = "virtual:investment-third-party-notices";
const resolvedId = `\0${id}`;
const source = fileURLToPath(
  new URL("./clerk-trial/third-party-notices.txt", import.meta.url),
);

export function readCompressedNotices() {
  const original = readFileSync(source);
  const compressed = gzipSync(original, { level: 9 });
  if (!gunzipSync(compressed).equals(original)) {
    throw new Error("Compressed notices differ from the authoritative text.");
  }
  return {
    base64: compressed.toString("base64"),
    byteLength: original.byteLength,
  };
}

/** One generated module; the checked-in notice text remains authoritative. */
export function compressedNotices(): Plugin {
  return {
    name: "investment-compressed-notices",
    resolveId(value) {
      return value === id ? resolvedId : null;
    },
    load(value) {
      if (value !== resolvedId) return null;
      this.addWatchFile(source);
      return `export default ${JSON.stringify(readCompressedNotices())};`;
    },
  };
}
