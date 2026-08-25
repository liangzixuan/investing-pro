import { describe, expect, it } from "vitest";

import {
  cleanFilingParserCrossEngineExecutionGitEnvironment,
  filingParserCrossEngineExecutionDirectSuccessorAllowed,
  filingParserCrossEngineExecutionFileSizeAllowed,
  filingParserCrossEngineExecutionGitArguments,
  repositoryRelativePathIsContained,
} from "./filing-parser-cross-engine-execution-evidence-verifier";

describe("offline cross-engine evidence verifier hardening", () => {
  it("uses fixed replacement/lazy-fetch/config-resistant Git arguments", () => {
    expect(
      filingParserCrossEngineExecutionGitArguments("/repo", ["show", "a:b"]),
    ).toEqual([
      "--no-replace-objects",
      "--no-lazy-fetch",
      "-c",
      "advice.graftFileDeprecated=false",
      "-C",
      "/repo",
      "show",
      "a:b",
    ]);
  });
  it("scrubs hostile Git, loader, credential and prompt variables", () => {
    const clean = cleanFilingParserCrossEngineExecutionGitEnvironment(
      {
        PATH: "/bin",
        GIT_DIR: "evil",
        Git_Config_Global: "evil",
        GCM_INTERACTIVE: "Always",
        LD_PRELOAD: "evil",
        DYLD_INSERT_LIBRARIES: "evil",
      },
      "linux",
    );
    expect(clean.PATH).toBe("/bin");
    expect(clean.GIT_DIR).toBeUndefined();
    expect(clean.LD_PRELOAD).toBeUndefined();
    expect(clean.GIT_CONFIG_GLOBAL).toBe("/dev/null");
    expect(clean.GIT_NO_REPLACE_OBJECTS).toBe("1");
    expect(clean.GIT_NO_LAZY_FETCH).toBe("1");
    expect(clean.GIT_TERMINAL_PROMPT).toBe("0");
    expect(clean.GCM_INTERACTIVE).toBe("Never");
  });
  it("rejects POSIX, Windows and UNC escapes", () => {
    for (const value of [
      "../x",
      "..\\x",
      "/x",
      "\\\\server\\share",
      "C:\\x",
      "",
    ])
      expect(repositoryRelativePathIsContained(value)).toBe(false);
    expect(repositoryRelativePathIsContained("packages/x.ts")).toBe(true);
  });
  it("requires the exact direct successor and rejects unrelated or extra commits", () => {
    const baseline = "962a00f65835fc6126e4da98e0e0d5998e8d59cc";
    const revision = "b".repeat(40);
    expect(
      filingParserCrossEngineExecutionDirectSuccessorAllowed(
        baseline,
        "1",
        "1",
        revision,
        `${revision} ${baseline}`,
      ),
    ).toBe(true);
    expect(
      filingParserCrossEngineExecutionDirectSuccessorAllowed(
        "a".repeat(40),
        "1",
        "1",
        revision,
        `${revision} ${baseline}`,
      ),
    ).toBe(false);
    expect(
      filingParserCrossEngineExecutionDirectSuccessorAllowed(
        baseline,
        "2",
        "1",
        revision,
        `${revision} ${baseline}`,
      ),
    ).toBe(false);
    expect(
      filingParserCrossEngineExecutionDirectSuccessorAllowed(
        baseline,
        "1",
        "2",
        revision,
        `${revision} ${baseline}`,
      ),
    ).toBe(false);
    for (const parentLine of [
      `${revision} ${"a".repeat(40)}`,
      `${revision} ${"a".repeat(40)} ${baseline}`,
      `${revision} ${baseline} ${"a".repeat(40)}`,
      `${revision} ${baseline} `,
    ])
      expect(
        filingParserCrossEngineExecutionDirectSuccessorAllowed(
          baseline,
          "1",
          "1",
          revision,
          parentLine,
        ),
      ).toBe(false);
  });
  it("rejects empty, oversized, fractional, and unsafe file sizes", () => {
    expect(filingParserCrossEngineExecutionFileSizeAllowed(1, 10)).toBe(true);
    expect(filingParserCrossEngineExecutionFileSizeAllowed(10, 10)).toBe(true);
    for (const size of [0, 11, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(filingParserCrossEngineExecutionFileSizeAllowed(size, 10)).toBe(
        false,
      );
  });
});
