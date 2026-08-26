import { describe, expect, it } from "vitest";

import {
  cleanFilingParserCrossEngineExecutionGitEnvironment,
  filingParserCrossEngineExecutionCorrectiveChainAllowed,
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
  it("requires the exact five-commit corrective chain and rejects ancestry drift", () => {
    const baseline = "962a00f65835fc6126e4da98e0e0d5998e8d59cc";
    const failedPrecursor = "14b4ecf41806dca7759a06bebf7ef8da96374f76";
    const failedCorrective = "061944f8f770e8a08b2a38d1e2fedf8b8e2de348";
    const failedRecovery = "f29e39cea40e76d500df833fd8e0e94e0c86a68c";
    const failedDiagnostic = "abd65313705282dab8071f5d36c78d31b1720ee3";
    const revision = "b".repeat(40);
    const validArguments = [
      baseline,
      "5",
      "5",
      revision,
      `${revision} ${failedDiagnostic}`,
      `${failedDiagnostic} ${failedRecovery}`,
      `${failedRecovery} ${failedCorrective}`,
      `${failedCorrective} ${failedPrecursor}`,
      `${failedPrecursor} ${baseline}`,
    ] as const;
    expect(
      filingParserCrossEngineExecutionCorrectiveChainAllowed(...validArguments),
    ).toBe(true);
    const mutations: Array<(values: string[]) => void> = [
      (values) => {
        values[0] = "a".repeat(40);
      },
      (values) => {
        values[1] = "4";
      },
      (values) => {
        values[2] = "4";
      },
      (values) => {
        values[4] = `${revision} ${failedRecovery}`;
      },
      (values) => {
        values[4] = `${revision} ${failedDiagnostic} ${failedRecovery}`;
      },
      (values) => {
        values[4] = `${revision} ${failedRecovery} ${failedDiagnostic}`;
      },
      (values) => {
        values[5] = `${failedDiagnostic} ${failedCorrective}`;
      },
      (values) => {
        values[5] = `${failedDiagnostic} ${failedRecovery} ${failedCorrective}`;
      },
      (values) => {
        values[5] = `${failedDiagnostic} ${failedCorrective} ${failedRecovery}`;
      },
      (values) => {
        values[6] = `${failedRecovery} ${failedPrecursor}`;
      },
      (values) => {
        values[6] = `${failedRecovery} ${failedCorrective} ${failedPrecursor}`;
      },
      (values) => {
        values[6] = `${failedRecovery} ${failedPrecursor} ${failedCorrective}`;
      },
      (values) => {
        values[7] = `${failedCorrective} ${baseline}`;
      },
      (values) => {
        values[7] = `${failedCorrective} ${failedPrecursor} ${baseline}`;
      },
      (values) => {
        values[7] = `${failedCorrective} ${baseline} ${failedPrecursor}`;
      },
      (values) => {
        values[8] = `${failedPrecursor} ${"a".repeat(40)}`;
      },
      (values) => {
        values[8] = `${failedPrecursor} ${baseline} ${"a".repeat(40)}`;
      },
      (values) => {
        values[8] = `${failedPrecursor} ${"a".repeat(40)} ${baseline}`;
      },
      (values) => {
        values[4] += " ";
      },
      (values) => {
        values[5] += " ";
      },
      (values) => {
        values[6] += " ";
      },
      (values) => {
        values[7] += " ";
      },
      (values) => {
        values[8] += " ";
      },
    ];
    for (const mutate of mutations) {
      const values = [...validArguments];
      mutate(values);
      expect(
        filingParserCrossEngineExecutionCorrectiveChainAllowed(
          ...(values as Parameters<
            typeof filingParserCrossEngineExecutionCorrectiveChainAllowed
          >),
        ),
      ).toBe(false);
    }
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
