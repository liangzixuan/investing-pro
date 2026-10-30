import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { createFixture } from "./fixture";
import {
  formatManagedResearchDraftSetFile,
  type ManagedResearchDraftSetFileContent,
} from "../../src/clerk-trial/managed-research-draft-set-file";
const source = readFileSync(
  new URL(
    "../../android/app/src/androidTest/java/local/investment/personal/ManagedResearchDraftSetRecoveryTest.java",
    import.meta.url,
  ),
  "utf8",
);
const helperLiteral =
  /private static final String SAME_JSON = ("(?:\\.|[^"\\])*");/.exec(
    source,
  )![1]!;
const helper = JSON.parse(helperLiteral) as string;
const same = runInNewContext(helper) as (a: unknown, b: unknown) => boolean;
const javaExpression =
  /await\("chosen bytes preserve every nested identity\/raw value\/order and independent metadata",(.+?)\);same\("all"/.exec(
    source,
  )![1]!;
const js = runInNewContext(
  javaExpression,
  {
    D: "diagnostics",
    P: "protocol",
    SAME_JSON: helper,
  },
  { timeout: 1000 },
) as string;
const run = (diagnostics: unknown, protocol: unknown) =>
  runInNewContext(js, { diagnostics, protocol }, { timeout: 1000 }) as boolean;
const scope = `sha256:${"c".repeat(64)}`,
  capturedAt = "2026-10-30T00:00:00.000Z";
let data: NonNullable<
  Awaited<ReturnType<typeof createFixture>>["researchDraftSet"]
>["data"];
let file: ManagedResearchDraftSetFileContent;
beforeAll(async () => {
  const f = await createFixture("research-draft-set");
  data = f.researchDraftSet!.data;
  const c = data.captured;
  const document = formatManagedResearchDraftSetFile({
    accountScope: scope,
    capturedAt,
    members: {
      watchlist: {
        format: "investment-watchlist-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        baseVersion: 3,
        draft: c.watchlist,
      },
      portfolio: {
        format: "investment-portfolio-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        baseVersion: 3,
        draft: c.portfolio,
      },
      followups: {
        format: "investment-followups-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        baseVersion: 3,
        draft: c.followups,
      },
      valuation: {
        format: "investment-valuation-collection-draft",
        version: 1,
        accountScope: scope,
        capturedAt,
        payload: c.valuation,
      },
    },
  });
  expect(document).not.toBeNull();
  file = JSON.parse(document!.text) as ManagedResearchDraftSetFileContent;
});
function predicate(value: unknown) {
  return run({ data }, { text: JSON.stringify(value) });
}
function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reorder(v)]),
    );
  return value;
}
it("executes the exact Java payload predicate over codec output despite Watchlist object insertion order", () => {
  expect(JSON.stringify(file.members.watchlist!.draft)).not.toBe(
    JSON.stringify(data.captured.watchlist),
  );
  expect(same(file.members.watchlist!.draft, data.captured.watchlist)).toBe(
    true,
  );
  expect(predicate(file)).toBe(true);
  const reordered = structuredClone(file);
  for (const key of ["watchlist", "portfolio", "followups"]) {
    const path = ["members", key, "draft"];
    set(reordered, path, reorder(at(reordered, path)));
  }
  const path = ["members", "valuation", "payload"];
  set(reordered, path, reorder(at(reordered, path)));
  expect(predicate(reordered)).toBe(true);
});
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object")
    throw new Error("Expected mutation target");
  return value as Record<string, unknown>;
}
function at(value: unknown, path: readonly string[]) {
  let current = value;
  for (const key of path) current = object(current)[key];
  return current;
}
function set(value: unknown, path: readonly string[], replacement: unknown) {
  object(at(value, path.slice(0, -1)))[path.at(-1)!] = replacement;
}
function reverse(value: unknown, path: readonly string[]) {
  const rows = at(value, path);
  if (!Array.isArray(rows)) throw new Error("Expected array target");
  rows.reverse();
}
const mutations: [string, (f: ManagedResearchDraftSetFileContent) => void][] = [
  [
    "missing field",
    (f) => {
      delete object(at(f, ["members", "watchlist", "draft"])).snapshotSha256;
    },
  ],
  [
    "extra field",
    (f) => {
      set(f, ["members", "watchlist", "draft", "unexpected"], true);
    },
  ],
  [
    "changed complete note",
    (f) => {
      set(
        f,
        ["members", "watchlist", "draft", "memberships", "0", "note"],
        "Different complete note",
      );
    },
  ],
  [
    "changed identity",
    (f) => {
      set(
        f,
        ["members", "watchlist", "draft", "memberships", "0", "listingId"],
        "other",
      );
    },
  ],
  [
    "Watchlist order",
    (f) => {
      reverse(f, ["members", "watchlist", "draft", "memberships"]);
    },
  ],
  [
    "transaction order",
    (f) => {
      reverse(f, ["members", "portfolio", "draft", "transactions"]);
    },
  ],
  [
    "registry order",
    (f) => {
      reverse(f, ["members", "portfolio", "draft", "identities"]);
    },
  ],
  [
    "decimal spelling",
    (f) => {
      set(f, ["members", "portfolio", "draft", "opening", "cashUsd"], "1000");
    },
  ],
  [
    "numeric conversion",
    (f) => {
      set(
        f,
        ["members", "portfolio", "draft", "transactions", "0", "shares"],
        2.5,
      );
    },
  ],
  [
    "null change",
    (f) => {
      set(
        f,
        [
          "members",
          "portfolio",
          "draft",
          "opening",
          "holdings",
          "0",
          "confirmedOn",
        ],
        null,
      );
    },
  ],
  [
    "Follow-ups order",
    (f) => {
      reverse(f, ["members", "followups", "draft", "entries"]);
    },
  ],
  [
    "complete result",
    (f) => {
      set(f, ["members", "followups", "draft", "entries", "0", "result"], "");
    },
  ],
  [
    "valuation entry order",
    (f) => {
      reverse(f, ["members", "valuation", "payload", "entries"]);
    },
  ],
  [
    "valuation raw operand",
    (f) => {
      const path = [
        "members",
        "valuation",
        "payload",
        "entries",
        "0",
        "exit",
        "inputs",
        "baseRevenue",
      ];
      set(f, path, String(at(f, path)) + " ");
    },
  ],
  [
    "valuation model",
    (f) => {
      set(
        f,
        [
          "members",
          "valuation",
          "payload",
          "entries",
          "0",
          "dcf",
          "modelVersion",
        ],
        "other",
      );
    },
  ],
  [
    "base version",
    (f) => {
      set(f, ["members", "portfolio", "baseVersion"], 4);
    },
  ],
  [
    "scope",
    (f) => {
      set(
        f,
        ["members", "followups", "accountScope"],
        "sha256:" + "d".repeat(64),
      );
    },
  ],
  [
    "valuation scope",
    (f) => {
      set(
        f,
        ["members", "valuation", "accountScope"],
        "sha256:" + "d".repeat(64),
      );
    },
  ],
  [
    "outer member order",
    (f) => {
      set(
        f,
        ["members"],
        Object.fromEntries(Object.entries(f.members).reverse()),
      );
    },
  ],
];
it.each(mutations)(
  "rejects %s in the exact native predicate",
  (_name, mutate) => {
    const changed = structuredClone(file);
    mutate(changed);
    expect(predicate(changed)).toBe(false);
  },
);
it("keeps scalar types, explicit nulls and every array position exact", () => {
  expect(same({ value: "0" }, { value: 0 })).toBe(false);
  expect(same({ value: null }, {})).toBe(false);
  expect(same(["a", "b"], ["b", "a"])).toBe(false);
  expect(same({ a: null, b: "" }, { b: "", a: null })).toBe(true);
});
