import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  RELEASE_CLASSIFICATION_ADAPTER_PATHS,
  renderReleaseClassification,
} from "./release-classification-render.js";
import {
  CLASSIFICATION_BASELINE,
  parseReleaseDescriptor,
  RELEASE_DIRECTORY,
} from "./release-classification.js";
import type { ReleaseDescriptor } from "./release-classification.js";

const repository = realpathSync(resolve(import.meta.dirname, ".."));
const accepted77 = "2b2510bc677173d1c9700e9f13c5012a7a0c8a88";
const crossScript = "scripts/classify-filing-parser-cross-engine-source.sh";
const crossWorkflow =
  ".github/workflows/filing-parser-cross-engine-execution-acceptance.yml";
const route = "apps/web/app/company/[listingId]/page.tsx";
const ordinary =
  'git diff --name-only --no-renames -z "$public_promotion" HEAD -- "${protected[@]}"';
const literal = ordinary.replace("git diff", "git --literal-pathspecs diff");
const acceptedSources = new Map<string, string>();
const historicalSources = new Map<string, string>();
let historical: ReleaseDescriptor;

function blob(pin: string, path: string): string {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(?:GIT_|NODE_OPTIONS$)/iu.test(key),
    ),
  );
  return execFileSync(
    "git",
    [
      "--no-replace-objects",
      "-c",
      `safe.directory=${repository.replaceAll("\\", "/")}`,
      "-C",
      repository,
      "show",
      `${pin}:${path}`,
    ],
    {
      env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 2_000_000,
    },
  ).replaceAll("\r\n", "\n");
}

function declaration(caseNumber: 78 | 79): ReleaseDescriptor {
  const descriptorPath = `${RELEASE_DIRECTORY}/cycle3ka${caseNumber}.json`;
  return parseReleaseDescriptor(
    JSON.stringify({
      version: 1,
      caseNumber,
      baselineRevision: CLASSIFICATION_BASELINE,
      predecessorRevision: caseNumber === 78 ? accepted77 : "b".repeat(40),
      featureRevision: caseNumber === 78 ? "a".repeat(40) : "c".repeat(40),
      featureCount: 101 + 2 * caseNumber,
      closureCount: 102 + 2 * caseNumber,
      featureChanges: [{ path: route, status: "A" }],
      closureChanges: [
        ...RELEASE_CLASSIFICATION_ADAPTER_PATHS.map((path) => ({
          path,
          status: "M",
        })),
        { path: descriptorPath, status: "A" },
      ].sort((left, right) => (left.path < right.path ? -1 : 1)),
      descriptorPath,
      presentation: {
        featureDescription: "synthetic dynamic route",
        closureDescription: "synthetic dynamic route",
        inventoryDescription: "synthetic dynamic route",
        testBinding: `dynamicRouteCase${caseNumber}`,
        routingDescription: "synthetic dynamic route",
        summaryDescription:
          "synthetic dynamic route with literal inventory paths",
      },
    }),
  );
}

beforeAll(() => {
  historical = parseReleaseDescriptor(
    blob(accepted77, `${RELEASE_DIRECTORY}/cycle3ka77.json`),
  );
  for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
    acceptedSources.set(path, blob(accepted77, path));
    historicalSources.set(path, blob(historical.predecessorRevision, path));
  }
}, 60_000);

describe("literal dynamic-route release inventories", () => {
  it("preserves the accepted historical cross-engine script exactly", () => {
    const outputs = renderReleaseClassification(historicalSources, historical);
    expect(outputs.get(crossScript)).toBe(acceptedSources.get(crossScript));
    expect(outputs.get(crossScript)?.split(ordinary)).toHaveLength(2);
    expect(outputs.get(crossScript)).not.toContain(literal);
  });

  it("quotes dynamic paths and keeps the protected probe literal in subsequent releases", () => {
    const before = [...acceptedSources];
    const first = renderReleaseClassification(acceptedSources, declaration(78));
    const next = renderReleaseClassification(first, declaration(79));
    expect([...acceptedSources]).toEqual(before);
    for (const outputs of [first, next]) {
      expect(outputs.get(crossScript)?.split(literal)).toHaveLength(2);
      expect(outputs.get(crossScript)).not.toContain(ordinary);
      for (const path of RELEASE_CLASSIFICATION_ADAPTER_PATHS) {
        const value = outputs.get(path)!;
        if (path !== crossWorkflow)
          expect(value).toContain(JSON.stringify(route));
        if (path.endsWith(".yml"))
          expect(value.split("\njobs:\n")[0]).toBe(
            acceptedSources.get(path)!.split("\njobs:\n")[0],
          );
      }
    }
  });

  it("refuses missing, duplicate or reverted protected-probe commands", () => {
    const source = acceptedSources.get(crossScript)!;
    for (const replacement of [
      "git diff changed",
      `${ordinary}\n${ordinary}`,
    ]) {
      const tampered = new Map(acceptedSources);
      tampered.set(crossScript, source.replace(ordinary, replacement));
      expect(() =>
        renderReleaseClassification(tampered, declaration(78)),
      ).toThrow(/anchor|literal protected-inventory/u);
    }
    const first = renderReleaseClassification(acceptedSources, declaration(78));
    for (const replacement of [ordinary, `${literal}\n${literal}`]) {
      const tampered = new Map(first);
      tampered.set(
        crossScript,
        first.get(crossScript)!.replace(literal, replacement),
      );
      expect(() =>
        renderReleaseClassification(tampered, declaration(79)),
      ).toThrow(/literal protected-inventory/u);
    }
  });
});
