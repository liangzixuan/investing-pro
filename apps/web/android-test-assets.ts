import { Buffer } from "node:buffer";
import type { Plugin } from "vite";

interface FixtureAsset {
  readonly fileName: string;
  readonly source: string | Uint8Array;
}

/** Match the native fixture loader, including room for its scenario meta tag. */
export function validateAndroidTestAssets(assets: readonly FixtureAsset[]) {
  if (assets.length === 0 || assets.length > 64)
    throw new Error("Android fixture file limit exceeded");
  const names = new Set<string>();
  let bytes = 0;
  let indexBytes = 0;
  for (const asset of assets) {
    const parts = asset.fileName.split("/");
    if (
      parts.length > 4 ||
      parts.some((part) => !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/u.test(part)) ||
      names.has(asset.fileName)
    )
      throw new Error("Invalid Android fixture path or depth");
    names.add(asset.fileName);
    const size =
      typeof asset.source === "string"
        ? Buffer.byteLength(asset.source, "utf8")
        : asset.source.byteLength;
    bytes += size;
    if (asset.fileName === "index.html") indexBytes = size;
  }
  if (indexBytes === 0 || indexBytes > 65_536)
    throw new Error("Android fixture index limit exceeded");
  // All registered native scenario names fit this allowance. Keep the emitted
  // tree plus the loader's added tag within its unchanged four-MiB ceiling.
  if (bytes + 256 > 4 * 1024 * 1024)
    throw new Error(
      `Android fixture byte limit exceeded: ${bytes} emitted bytes plus 256 scenario bytes`,
    );
  return { bytes, files: assets.length };
}

export function androidTestAssetLimits(): Plugin {
  return {
    name: "android-test-asset-limits",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        validateAndroidTestAssets(
          Object.values(bundle).map((asset) => ({
            fileName: asset.fileName,
            source: asset.type === "chunk" ? asset.code : asset.source,
          })),
        );
      },
    },
  };
}
