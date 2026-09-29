const origin = "https://investment-device-preview.appwrite.network";

export type WebTarget =
  | { mode: "preview"; origin: string; expectedBuildSha: null }
  | { mode: "staging"; origin: string; expectedBuildSha: string };

export function resolveWebTarget(
  mode: unknown,
  expectedBuildSha?: unknown,
): WebTarget {
  if (mode === "preview" && expectedBuildSha === undefined)
    return { mode, origin, expectedBuildSha: null };
  if (mode === "staging") {
    if (
      typeof expectedBuildSha !== "string" ||
      expectedBuildSha.length !== 40 ||
      !/^[a-f0-9]{40}$/u.test(expectedBuildSha)
    )
      throw new Error(
        "Staging requires INVESTMENT_EXPECTED_BUILD_SHA as 40 lowercase hexadecimal characters.",
      );
    return { mode, origin, expectedBuildSha };
  }
  throw new Error(
    "Select preview without an expected SHA, or staging with an expected SHA.",
  );
}

export function resolveWebRun(
  args: readonly string[],
  expectedBuildSha?: unknown,
) {
  const command = args[0];
  if (
    args.length !== 1 ||
    !["--check", "--run", "--check-staging", "--run-staging"].includes(
      command ?? "",
    )
  )
    throw new Error(
      "Use --check or --run for the preview; use --check-staging or --run-staging for an exact-build smoke.",
    );
  return {
    run: command === "--run" || command === "--run-staging",
    target: resolveWebTarget(
      command === "--check-staging" || command === "--run-staging"
        ? "staging"
        : "preview",
      expectedBuildSha,
    ),
  };
}
