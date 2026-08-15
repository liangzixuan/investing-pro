import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  assertExpectedPsqlFailure,
  checkPostgresAcceptanceHarness,
  injectBootstrapFailure,
  inspectPostgresAcceptanceHarness,
  runPostgresAcceptance,
  type AcceptanceArtifacts,
} from "../src/postgres-acceptance";

describe("PostgreSQL acceptance harness guardrails", () => {
  it("accepts the reviewed immutable workflow and synthetic fixture", async () => {
    await expect(checkPostgresAcceptanceHarness()).resolves.toEqual([]);
  });

  it("rejects image drift and mutable service tags", async () => {
    const artifacts = await loadArtifacts();
    const driftedConfig = structuredClone(artifacts.config) as Record<
      string,
      unknown
    >;
    driftedConfig.indexDigest = `sha256:${"0".repeat(64)}`;
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        config: driftedConfig,
      }),
    ).toContain("PostgreSQL image config does not match the reviewed pin");

    const mutableWorkflow = artifacts.workflow.replace(
      /image: docker\.io\/library\/postgres:[^\r\n]+/,
      "image: postgres:latest",
    );
    const violations = inspectPostgresAcceptanceHarness({
      ...artifacts,
      workflow: mutableWorkflow,
    });
    expect(violations).toContain(
      "workflow must not use a mutable PostgreSQL tag",
    );
    expect(violations).toContain(
      "workflow image must match the immutable declaration",
    );
  });

  it("rejects ports, URLs, host addressing, and forged container plumbing", async () => {
    const artifacts = await loadArtifacts();
    const workflow = artifacts.workflow
      .replace("    steps:", "    ports:\n      - 5432:5432\n    steps:")
      .replace(
        "RESEARCH_COCKPIT_PG_CONTAINER_ID: ${{ job.services.postgres.id }}",
        "RESEARCH_COCKPIT_PG_CONTAINER_ID: forged\n          DATABASE_URL: postgres://localhost/demo",
      );
    const violations = inspectPostgresAcceptanceHarness({
      ...artifacts,
      workflow,
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        "workflow must not publish a database port",
        "workflow must not construct a database URL",
        "workflow must not address PostgreSQL through the host",
        "workflow must pass only the GitHub service container ID",
      ]),
    );
  });

  it("requires every workspace input that can alter the live job to trigger it", async () => {
    const artifacts = await loadArtifacts();
    const workflow = artifacts.workflow.replaceAll(
      "      - tsconfig.base.json\n",
      "",
    );
    expect(
      inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
    ).toContain("workflow must rerun when tsconfig.base.json changes");
  });

  it("rejects decoy markers and unused workflow changes by reviewed hash", async () => {
    const artifacts = await loadArtifacts();
    const pinnedLine = artifacts.workflow.match(
      /^\s*image: docker\.io\/library\/postgres:[^\r\n]+/m,
    )?.[0];
    if (!pinnedLine) throw new Error("Pinned workflow image line is missing");
    const workflow = artifacts.workflow.replace(
      pinnedLine,
      `${pinnedLine.replace(/@sha256:[0-9a-f]{64}/, "")}\n        # ${pinnedLine.trim()}`,
    );
    expect(
      inspectPostgresAcceptanceHarness({ ...artifacts, workflow }),
    ).toContain("workflow differs from its reviewed SHA-256");
  });

  it("rejects fixture mutation commands and live rows before their registry", async () => {
    const artifacts = await loadArtifacts();
    const mutatedFixture = artifacts.fixture.replace(
      "INSERT INTO private_data.resource_id_registry",
      "UPDATE private_data.organizations SET name = name;\n\nINSERT INTO private_data.resource_id_registry",
    );
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        fixture: mutatedFixture,
      }),
    ).toContain("synthetic fixture must remain insert-only");

    const registry = artifacts.fixture.indexOf(
      "INSERT INTO private_data.resource_id_registry",
    );
    const thesis = artifacts.fixture.indexOf("INSERT INTO private_data.theses");
    const reorderedFixture =
      artifacts.fixture.slice(0, registry) +
      artifacts.fixture.slice(thesis) +
      artifacts.fixture.slice(registry, thesis);
    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        fixture: reorderedFixture,
      }),
    ).toContain("resource registry rows must precede theses");

    expect(
      inspectPostgresAcceptanceHarness({
        ...artifacts,
        fixture: `${artifacts.fixture}\n\\gexec\n`,
      }),
    ).toEqual(
      expect.arrayContaining([
        "synthetic fixture differs from its reviewed SHA-256",
        "synthetic fixture must not contain psql meta-commands",
      ]),
    );
  });

  it("cannot run outside the isolated GitHub Actions boundary", async () => {
    await expect(runPostgresAcceptance({})).rejects.toThrow(
      /restricted to the isolated GitHub Actions job/i,
    );
    await expect(
      runPostgresAcceptance({ CI: "true", GITHUB_ACTIONS: "true" }),
    ).rejects.toThrow(/container ID is required/i);
  });

  it("injects a deterministic error immediately before final commit", () => {
    const bootstrap = "BEGIN;\nSELECT 1;\nCOMMIT;\n";
    const injected = injectBootstrapFailure(bootstrap);
    expect(injected).toContain("SELECT 1;\nSELECT 1 / 0;\nCOMMIT;");
    expect(injected.match(/SELECT 1 \/ 0;/g)).toHaveLength(1);
  });

  it("requires the expected SQLSTATE and error marker for negative probes", () => {
    const expected = {
      label: "write denial",
      sqlState: "42501",
      message: "permission denied for table organizations",
    };
    expect(() =>
      assertExpectedPsqlFailure(
        {
          exitCode: 1,
          stdout: "",
          stderr: "ERROR:  42501: permission denied for table organizations",
        },
        expected,
      ),
    ).not.toThrow();
    expect(() =>
      assertExpectedPsqlFailure(
        { exitCode: 1, stdout: "", stderr: "ERROR:  42601: syntax error" },
        expected,
      ),
    ).toThrow(/wrong SQLSTATE/i);
    expect(() =>
      assertExpectedPsqlFailure(
        {
          exitCode: 1,
          stdout: "",
          stderr: "ERROR:  42501: permission denied for schema private_data",
        },
        expected,
      ),
    ).toThrow(/wrong reason/i);
    expect(() =>
      assertExpectedPsqlFailure(
        { exitCode: 0, stdout: "", stderr: "" },
        expected,
      ),
    ).toThrow(/unexpectedly succeeded/i);
  });

  it("keeps PostgreSQL conditional expressions unqualified", async () => {
    const runner = await readFile(
      new URL("../src/postgres-acceptance.ts", import.meta.url),
      "utf8",
    );
    expect(runner).not.toMatch(/\bpg_catalog\.(?:coalesce|nullif)\s*\(/i);
  });
});

async function loadArtifacts(): Promise<AcceptanceArtifacts> {
  return {
    config: JSON.parse(
      await readFile(
        new URL("../acceptance/postgres-image.json", import.meta.url),
        "utf8",
      ),
    ) as unknown,
    workflow: await readFile(
      new URL(
        "../../../.github/workflows/postgres-acceptance.yml",
        import.meta.url,
      ),
      "utf8",
    ),
    fixture: await readFile(
      new URL("../acceptance/synthetic-fixture.sql", import.meta.url),
      "utf8",
    ),
  };
}
