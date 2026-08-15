import { spawnSync } from "node:child_process";

interface LicenseRecord {
  name: string;
  versions: string[];
}

const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MIT",
]);
const exactExceptions = new Map<string, string>([
  ["caniuse-lite@1.0.30001809", "CC-BY-4.0"],
]);

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error(
    "Run the license gate through pnpm so npm_execpath is available",
  );
}
const result = spawnSync(
  process.execPath,
  [pnpmCli, "licenses", "list", "--prod", "--json"],
  { encoding: "utf8", windowsHide: true },
);
if (result.status !== 0) {
  throw new Error(
    `pnpm license inventory failed: ${result.stderr || result.stdout}`,
  );
}

const inventory = parseInventory(JSON.parse(result.stdout) as unknown);
const rejected: string[] = [];
let packageCount = 0;
for (const [license, packages] of Object.entries(inventory)) {
  for (const packageRecord of packages) {
    for (const version of packageRecord.versions) {
      packageCount += 1;
      const identity = `${packageRecord.name}@${version}`;
      if (
        !allowedLicenses.has(license) &&
        exactExceptions.get(identity) !== license
      ) {
        rejected.push(`${identity} (${license})`);
      }
    }
  }
}

if (rejected.length > 0) {
  throw new Error(
    `Unapproved production licenses:\n- ${rejected.join("\n- ")}`,
  );
}
console.log(
  `License policy verified: ${packageCount} production package versions.`,
);

function parseInventory(value: unknown): Record<string, LicenseRecord[]> {
  assert(isRecord(value), "License inventory must be an object");
  const inventory: Record<string, LicenseRecord[]> = {};
  for (const [license, packages] of Object.entries(value)) {
    assert(
      Array.isArray(packages),
      `License group ${license} must be an array`,
    );
    inventory[license] = packages.map((entry, index) => {
      assert(
        isRecord(entry),
        `License record ${license}[${index}] must be an object`,
      );
      assert(
        typeof entry.name === "string",
        `License record ${license}[${index}] needs a package name`,
      );
      assert(
        Array.isArray(entry.versions) &&
          entry.versions.every((version) => typeof version === "string"),
        `License record ${entry.name} needs string versions`,
      );
      return { name: entry.name, versions: entry.versions };
    });
  }
  return inventory;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
