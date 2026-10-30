import { expect, it, vi } from "vitest";
import {
  RESEARCH_DRAFT_RESOURCES,
  MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES,
  EMPTY_RESEARCH_DRAFT_MEMBERS,
  formatManagedResearchDraftSetFile,
  parseManagedResearchDraftSetFile,
  isManagedResearchDraftSetFileDocument,
  decodeResearchDraftSetFile,
  assertResearchDraftSetFileSize,
} from "./managed-research-draft-set-file";
import {
  draftSetContent,
  draftSetDocument,
  draftSetMembers,
  scope,
  time,
} from "./test-research-draft-set-file-fixture";
it("keeps all four nested current file objects, exact metadata, raw text and complete contents", () => {
  const document = draftSetDocument(),
    content = draftSetContent();
  expect(isManagedResearchDraftSetFileDocument(document)).toBe(true);
  expect(Object.keys(JSON.parse(document.text) as object)).toEqual([
    "format",
    "version",
    "accountScope",
    "capturedAt",
    "members",
    "omitted",
  ]);
  expect(content.members).toEqual(draftSetMembers());
  expect(content.omitted).toEqual([]);
  expect(content.members.watchlist?.draft.memberships[0]?.note).toContain(
    "\nsecond line",
  );
  expect(
    content.members.valuation?.payload.entries[0]?.dcf.inputs.waccPercent,
  ).toBe(" unfinished 1.. 😀 ");
});
it("admits every nonempty explicit subset and reports the exact canonical omitted complement", () => {
  const members = draftSetMembers();
  for (let mask = 1; mask < 16; mask++) {
    const subset = { ...EMPTY_RESEARCH_DRAFT_MEMBERS };
    RESEARCH_DRAFT_RESOURCES.forEach((k, i) => {
      if (mask & (1 << i)) Object.assign(subset, { [k]: members[k] });
    });
    const document = formatManagedResearchDraftSetFile({
      accountScope: scope,
      capturedAt: time,
      members: subset,
    });
    expect(document).not.toBeNull();
    expect(
      parseManagedResearchDraftSetFile(document!.text, scope)?.omitted,
    ).toEqual(RESEARCH_DRAFT_RESOURCES.filter((_, i) => !(mask & (1 << i))));
  }
  expect(
    formatManagedResearchDraftSetFile({
      accountScope: scope,
      capturedAt: time,
      members: EMPTY_RESEARCH_DRAFT_MEMBERS,
    }),
  ).toBeNull();
});
it.each([
  "missing resource key",
  "unknown resource key",
  "wrong omitted",
  "wrong outer scope",
  "wrong inner scope",
  "unknown outer field",
  "unsupported outer version",
  "unsupported member version",
  "unknown member field",
  "invalid payload",
])("refuses the whole nested file for %s", (reason) => {
  const file = draftSetContent();
  let value: unknown = file;
  if (reason === "missing resource key") {
    const { portfolio: unused, ...rest } = file.members;
    void unused;
    value = { ...file, members: rest };
  }
  if (reason === "unknown resource key")
    value = { ...file, members: { ...file.members, other: null } };
  if (reason === "wrong omitted") value = { ...file, omitted: ["portfolio"] };
  if (reason === "wrong outer scope")
    value = { ...file, accountScope: `sha256:${"f".repeat(64)}` };
  if (reason === "wrong inner scope")
    value = {
      ...file,
      members: {
        ...file.members,
        portfolio: {
          ...file.members.portfolio!,
          accountScope: `sha256:${"f".repeat(64)}`,
        },
      },
    };
  if (reason === "unknown outer field") value = { ...file, accepted: true };
  if (reason === "unsupported outer version") value = { ...file, version: 2 };
  if (reason === "unsupported member version")
    value = {
      ...file,
      members: {
        ...file.members,
        valuation: { ...file.members.valuation!, version: 2 },
      },
    };
  if (reason === "unknown member field")
    value = {
      ...file,
      members: {
        ...file.members,
        followups: { ...file.members.followups!, extra: 1 },
      },
    };
  if (reason === "invalid payload")
    value = {
      ...file,
      members: {
        ...file.members,
        watchlist: {
          ...file.members.watchlist!,
          draft: {
            ...file.members.watchlist!.draft,
            memberships: [
              {
                ...file.members.watchlist!.draft.memberships[0]!,
                note: "x".repeat(300000),
              },
            ],
          },
        },
      },
    };
  expect(
    parseManagedResearchDraftSetFile(JSON.stringify(value), scope),
  ).toBeNull();
});
it("refuses decoded duplicate keys at either envelope depth and malformed Unicode", () => {
  const text = draftSetDocument().text;
  expect(
    parseManagedResearchDraftSetFile(
      text.replace('"version":1', '"version":1,"version":1'),
      scope,
    ),
  ).toBeNull();
  expect(
    parseManagedResearchDraftSetFile(
      text.replace('"baseVersion":3', '"baseVersion":3,"baseVersion":3'),
      scope,
    ),
  ).toBeNull();
  expect(
    parseManagedResearchDraftSetFile(
      text.replace("Whole authored result", "\\ud800"),
      scope,
    ),
  ).toBeNull();
});
it("derives the closed framing cap, accepts actual exact-limit bytes and refuses one extra byte without clipping", () => {
  expect(MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES).toBe(1061324);
  const document = draftSetDocument(),
    text = document.text.trimEnd(),
    n = new TextEncoder().encode(text).byteLength,
    padded = text + " ".repeat(MANAGED_RESEARCH_DRAFT_SET_FILE_MAX_BYTES - n),
    bytes = new TextEncoder().encode(padded).buffer;
  expect(decodeResearchDraftSetFile(bytes, bytes.byteLength, scope)).toEqual(
    draftSetContent(),
  );
  expect(parseManagedResearchDraftSetFile(padded + " ", scope)).toBeNull();
  expect(() => assertResearchDraftSetFileSize(bytes.byteLength + 1)).toThrow();
  expect(
    decodeResearchDraftSetFile(bytes, bytes.byteLength - 1, scope),
  ).toBeNull();
  expect(
    decodeResearchDraftSetFile(new Uint8Array([0xc0, 0xaf]).buffer, 2, scope),
  ).toBeNull();
});
it("does not invoke outer member getters or accept document metadata relabels", () => {
  const members = draftSetMembers(),
    get = vi.fn(() => members.watchlist);
  Object.defineProperty(members, "watchlist", { get, enumerable: true });
  expect(
    formatManagedResearchDraftSetFile({
      accountScope: scope,
      capturedAt: time,
      members,
    }),
  ).toBeNull();
  expect(get).not.toHaveBeenCalled();
  const document = draftSetDocument();
  expect(
    isManagedResearchDraftSetFileDocument({
      ...document,
      byteLength: document.byteLength + 1,
    }),
  ).toBe(false);
  expect(
    isManagedResearchDraftSetFileDocument({
      ...document,
      filename: "other.json",
    }),
  ).toBe(false);
});
