import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildParserSecurityCases } from "./test-archive-builder";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const WORKER_PATH = fileURLToPath(
  new URL("../worker/parser.py", import.meta.url),
);
const TAXONOMY_PATH = fileURLToPath(
  new URL("../worker/taxonomy-v1.json", import.meta.url),
);
const CASES_PATH = fileURLToPath(
  new URL(
    "../../../fixtures/synthetic/filing-parser/v1/cases.json",
    import.meta.url,
  ),
);
const ACCEPTANCE_RUNNER_PATH = fileURLToPath(
  new URL("./run-filing-parser-acceptance.ts", import.meta.url),
);
const FIXTURE_GUARD_PATH = fileURLToPath(
  new URL("../../../scripts/verify-filing-parser-fixtures.ts", import.meta.url),
);

const PYTHON_HARNESS = String.raw`
import base64
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("filing_parser_worker", sys.argv[1])
if spec is None or spec.loader is None:
    raise RuntimeError("worker import failed")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
worker.TAXONOMY_PATH = sys.argv[2]

observed = []
for case in json.load(sys.stdin):
    archive = base64.b64decode(case["archive"], validate=True)
    result = worker.parse_archive_bytes(archive)
    observed.append({
        "caseId": case["caseId"],
        "code": result.get("code"),
        "factCount": len(result["facts"]),
        "sourceSha256": result["sourceSha256"],
        "status": result["status"],
    })
sys.stdout.write(json.dumps(observed, ensure_ascii=True, separators=(",", ":"), sort_keys=True))
`;

describe("Cycle 2a filing parser worker", () => {
  it("classifies the complete deterministic adversarial corpus in one isolated invocation", () => {
    const cases = buildParserSecurityCases();
    const input = cases.map(({ archive, id }) => ({
      archive: Buffer.from(archive).toString("base64"),
      caseId: id,
    }));

    const run = spawnSync(
      process.env.PYTHON ?? "python",
      ["-I", "-B", "-c", PYTHON_HARNESS, WORKER_PATH, TAXONOMY_PATH],
      {
        encoding: "utf8",
        input: JSON.stringify(input),
        maxBuffer: 4 * 1024 * 1024,
        timeout: 30_000,
        windowsHide: true,
      },
    );

    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout) as unknown).toEqual(
      cases.map(({ archive, expected, id }) => ({
        caseId: id,
        code: expected.status === "quarantined" ? expected.code : null,
        factCount: expected.status === "accepted" ? 2 : 0,
        sourceSha256: sha256(archive),
        status: expected.status,
      })),
    );
  });

  it("binds the source-controlled case ledger to every generated archive byte", () => {
    const ledger = JSON.parse(readFileSync(CASES_PATH, "utf8")) as unknown;
    expect(ledger).toEqual({
      cases: buildParserSecurityCases().map(({ archive, expected, id }) => ({
        archiveSha256: sha256(archive),
        expected,
        id,
      })),
      schemaVersion: "1.0.0",
      synthetic: true,
    });
  });

  it("keeps the worker zero-install, non-listening, and pinned to its closed files", () => {
    const dockerfile = readFileSync(
      `${PACKAGE_ROOT}/worker/Dockerfile`,
      "utf8",
    );
    expect(dockerfile).toContain(
      "FROM docker.io/library/python:3.12.13-slim-bookworm@sha256:4766d8b510c428e595d74b9cc5bbb2fae8e26316fffb4adc89908d79aacd58a2",
    );
    expect(dockerfile).toContain("WORKDIR /input\nWORKDIR /worker");
    expect(dockerfile).toContain("USER 65532:65532");
    expect(dockerfile).toContain(
      'ENTRYPOINT ["python", "-I", "-B", "/worker/parser.py"]',
    );
    expect(dockerfile).not.toMatch(/^(?:ADD|CMD|EXPOSE|HEALTHCHECK|RUN)\b/mu);
    expect(
      readFileSync(`${REPOSITORY_ROOT}/pnpm-workspace.yaml`, "utf8"),
    ).toContain("- packages/*");
  });

  it("keeps live diagnostics value-free and latches the first Docker failure through cleanup", () => {
    const source = readFileSync(ACCEPTANCE_RUNNER_PATH, "utf8");
    const catchBlock = source.slice(source.indexOf("await main().catch"));
    expect(catchBlock).toContain(
      "stage=${acceptanceStage} case=${acceptanceCaseIndex} docker=${firstDockerFailurePhase} inspection=${firstInspectionCheck}",
    );
    expect(catchBlock).not.toMatch(
      /\$\{[^}]*(?:archive|error|input|message|path|payload|stderr|stdout)[^}]*\}/iu,
    );
    expect(source).toContain(
      'if (firstDockerFailurePhase !== "none" || phase === "none") return;',
    );
    expect(source).toContain('if (firstInspectionCheck !== "none") return;');
    expect(source.match(/resetDockerFailureDiagnostic\(\);/gu)).toHaveLength(5);
    const imageVerifier = source.slice(
      source.indexOf("async function verifyBuiltImage"),
      source.indexOf("function signingHarness"),
    );
    expect(imageVerifier).toContain(
      'latchImageInspectionFailure("inspect_command")',
    );
    expect(imageVerifier).toContain(
      "error instanceof FilingParserImageInspectionError",
    );
    expect(imageVerifier).not.toMatch(
      /process\.(?:stderr|stdout)\.write|console\./u,
    );
    const boundarySetup = source.slice(
      source.indexOf('acceptanceStage = "signing_setup";'),
      source.indexOf("const outcomes: FilingParserEvidenceCaseOutcome[] = [];"),
    );
    expect(boundarySetup).toContain(
      'acceptanceStage = "signing_setup";\n    const signing = signingHarness();\n    acceptanceStage = "process_runner_setup";\n    const processRunner = new AuditedDockerProcessRunner(imageId);\n    acceptanceStage = "boundary_setup";\n    const boundary = createDockerFilingParserBoundary({',
    );
    expect(source.indexOf('acceptanceStage = "boundary_setup";')).toBeLessThan(
      source.indexOf('acceptanceStage = "case_execution";'),
    );
    expect(source).toContain(
      'const outcomes: FilingParserEvidenceCaseOutcome[] = [];\n    const acceptedReplay: SignedFilingParserResult[] = [];\n\n    acceptanceStage = "case_execution";',
    );
    expect(source.match(/await main\(\)\.catch/gu)).toHaveLength(1);
    expect(source.indexOf("class AuditedDockerProcessRunner")).toBeLessThan(
      source.indexOf("await main().catch"),
    );
    const runnerClass = source.slice(
      source.indexOf("class AuditedDockerProcessRunner"),
      source.indexOf("function dockerFailurePhase"),
    );
    expect(runnerClass).not.toContain("resetDockerFailureDiagnostic");
    expect(runnerClass).toContain(
      'latchDockerFailure("container_inspection", "inspect_command")',
    );
    expect(runnerClass).toContain('latchDockerFailure("label_residue")');
  });

  it("keeps Cycle 2a execution disconnected from successor corpus admission", () => {
    const runner = readFileSync(ACCEPTANCE_RUNNER_PATH, "utf8");
    const fixtureGuard = readFileSync(FIXTURE_GUARD_PATH, "utf8");
    expect(runner).toContain('} from "./parser-boundary";');
    expect(runner).not.toContain('from "./index"');
    expect(runner).not.toContain('from "./corpus-admission"');
    expect(fixtureGuard).toContain(
      '} from "../packages/filing-parser/src/parser-boundary";',
    );
    expect(fixtureGuard).not.toContain(
      'from "../packages/filing-parser/src/index"',
    );
    expect(fixtureGuard).not.toContain("corpus-admission");
  });
});

function sha256(value: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
