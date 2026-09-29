import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";

import { Agent, MockAgent } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSitesPort,
  runSiteRelease,
  SITE_RELEASE_LIMITS,
  SITE_RELEASE_TARGET,
  validateArtifact,
  validateStagingReceipt,
  type ArtifactManifest,
  type ReleaseReceipt,
  type SitesPort,
} from "./appwrite-site-release";

const STAGING = SITE_RELEASE_TARGET.stagingSiteId;
const PRODUCTION = "synthetic-production";
const SHA = "a".repeat(40);
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const resources: (() => Promise<unknown>)[] = [];

afterEach(async () => {
  for (const close of resources.splice(0).reverse()) await close();
  vi.restoreAllMocks();
});

function artifact() {
  // Tests of the operation use invented bytes; the packaging helper owns tar QA.
  const archive = Buffer.from("synthetic-retained-archive");
  const manifest: ArtifactManifest = {
    version: 1,
    sourceSha: SHA,
    archiveSha256: sha(archive),
    archiveBytes: archive.byteLength,
    files: [
      { path: "index.html", sha256: "b".repeat(64), bytes: 100 },
      { path: "assets/index-ABCDEFGH.js", sha256: "c".repeat(64), bytes: 200 },
    ],
  };
  return {
    archive,
    manifest,
    manifestBytes: Buffer.from(JSON.stringify(manifest)),
  };
}

function site(siteId: string, active = "previous") {
  return {
    $id: siteId,
    enabled: true,
    adapter: "static",
    framework: "other",
    fallbackFile: "index.html",
    deploymentRetention: 0,
    providerRepositoryId: "",
    installationId: "",
    scopes: [],
    deploymentId: active,
    get vars(): never {
      throw new Error("Private variables must not be inspected");
    },
  };
}

function deployed(siteId: string, status = "waiting", id = "candidate") {
  return {
    $id: id,
    resourceId: siteId,
    resourceType: "sites",
    activate: false,
    status,
    buildLogs: "private-synthetic-build-log",
  };
}

function harness(statuses = ["waiting", "building", "ready"]) {
  const calls: string[] = [];
  const receipts: ReleaseReceipt[] = [];
  let now = Date.parse("2026-09-29T00:00:00Z");
  let active = "previous";
  let cursor = 0;
  const sites: SitesPort = {
    getSite: vi.fn<SitesPort["getSite"]>((id) => {
      calls.push(`site:${id}`);
      return Promise.resolve(
        site(
          id,
          id === STAGING && active === "production" ? "candidate" : active,
        ),
      );
    }),
    createDeployment: vi.fn<SitesPort["createDeployment"]>((id) => {
      calls.push(`create:${id}`);
      return Promise.resolve(deployed(id, statuses[cursor++]));
    }),
    getDeployment: vi.fn<SitesPort["getDeployment"]>((id, deploymentId) => {
      calls.push(`observe:${id}:${deploymentId}`);
      return Promise.resolve(
        deployed(id, statuses[Math.min(cursor++, statuses.length - 1)]),
      );
    }),
    activate: vi.fn<SitesPort["activate"]>((id, deploymentId) => {
      calls.push(`activate:${id}:${deploymentId}`);
      active = deploymentId;
      return Promise.resolve(site(id, active));
    }),
  };
  const sleep = vi.fn((milliseconds: number) => {
    now += milliseconds;
    return Promise.resolve();
  });
  return {
    sites,
    calls,
    receipts,
    sleep,
    dependencies: {
      sites,
      now: () => now,
      sleep,
      persist: (receipt: ReleaseReceipt) => {
        receipts.push({ ...receipt });
        return Promise.resolve();
      },
    },
    setActive: (value: string) => {
      active = value;
    },
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

describe("static site release evidence", () => {
  it("binds exact archive and manifest bytes", () => {
    const input = artifact();
    expect(validateArtifact(input.archive, input.manifestBytes)).toEqual({
      manifest: input.manifest,
      manifestSha256: sha(input.manifestBytes),
    });
  });

  it.each([
    [
      "different archive hash",
      (m: ArtifactManifest) => {
        m.archiveSha256 = "d".repeat(64);
      },
    ],
    [
      "different archive length",
      (m: ArtifactManifest) => {
        m.archiveBytes++;
      },
    ],
    [
      "abbreviated revision",
      (m: ArtifactManifest) => {
        m.sourceSha = "abcdef";
      },
    ],
    [
      "path traversal",
      (m: ArtifactManifest) => {
        m.files[1]!.path = "../secret.js";
      },
    ],
    [
      "non-static member",
      (m: ArtifactManifest) => {
        m.files[1]!.path = "assets/config.json";
      },
    ],
    [
      "unhashed member",
      (m: ArtifactManifest) => {
        m.files[1]!.path = "assets/index.js";
      },
    ],
    [
      "duplicate index",
      (m: ArtifactManifest) => {
        m.files[1]!.path = "index.html";
      },
    ],
    [
      "missing index",
      (m: ArtifactManifest) => {
        m.files[0]!.path = "assets/a-ABCDEFGH.css";
      },
    ],
    [
      "invalid file length",
      (m: ArtifactManifest) => {
        m.files[1]!.bytes = -1;
      },
    ],
  ] as const)("rejects %s", (_label, mutate) => {
    const input = artifact();
    mutate(input.manifest);
    expect(() =>
      validateArtifact(
        input.archive,
        Buffer.from(JSON.stringify(input.manifest)),
      ),
    ).toThrow("invalid_evidence");
  });

  it("rejects extra manifest keys and malformed JSON without echoing it", () => {
    const input = artifact();
    expect(() =>
      validateArtifact(
        input.archive,
        Buffer.from(JSON.stringify({ ...input.manifest, key: "private" })),
      ),
    ).toThrow("invalid_evidence");
    expect(() =>
      validateArtifact(input.archive, Buffer.from("private-invalid-json")),
    ).toThrow("invalid_evidence");
  });

  it("rejects oversized input before any Sites call", async () => {
    const h = harness();
    await expect(
      runSiteRelease(
        {
          ...artifact(),
          operation: "stage",
          archive: new Uint8Array(SITE_RELEASE_LIMITS.archiveBytes + 1),
        },
        h.dependencies,
      ),
    ).rejects.toThrow("invalid_input");
    expect(h.calls).toEqual([]);
  });
});

describe("static site release operation", () => {
  it("retains the previous deployment before one inactive upload and activates only ready", async () => {
    const h = harness();
    const input = artifact();
    const receipt = await runSiteRelease(
      { ...input, operation: "stage" },
      h.dependencies,
    );
    expect(receipt).toMatchObject({
      outcome: "succeeded",
      previousDeploymentId: "previous",
      candidateDeploymentId: "candidate",
      activeDeploymentId: "candidate",
      observations: 2,
      activationVerified: true,
    });
    expect(h.calls).toEqual([
      `site:${STAGING}`,
      `create:${STAGING}`,
      `observe:${STAGING}:candidate`,
      `observe:${STAGING}:candidate`,
      `site:${STAGING}`,
      `activate:${STAGING}:candidate`,
      `site:${STAGING}`,
    ]);
    expect(h.sleep.mock.calls).toEqual([[2000], [4000]]);
    expect(h.receipts[1]).toMatchObject({
      previousDeploymentId: "previous",
      createAttempted: true,
      candidateDeploymentId: null,
    });
    expect(
      h.receipts.some((r) => r.activationAttempted && !r.activationVerified),
    ).toBe(true);
    expect(JSON.stringify(receipt)).not.toContain("private");
    expect(
      validateStagingReceipt(receipt, input.manifest, sha(input.manifestBytes)),
    ).toEqual({ stagingDeploymentId: "candidate" });
  });

  it("does not observe an already-ready deployment", async () => {
    const h = harness(["ready"]);
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt.outcome).toBe("succeeded");
    expect(h.sites.getDeployment).not.toHaveBeenCalled();
  });

  it.each(["failed", "canceled"])(
    "leaves the prior active deployment when build is %s",
    async (status) => {
      const h = harness([status]);
      const receipt = await runSiteRelease(
        { ...artifact(), operation: "stage" },
        h.dependencies,
      );
      expect(receipt).toMatchObject({
        outcome: "failed",
        failure: "build_failed",
        activeDeploymentId: "previous",
        activationAttempted: false,
      });
      expect(h.sites.activate).not.toHaveBeenCalled();
      expect(h.sites.getDeployment).not.toHaveBeenCalled();
    },
  );

  it("stops after the finite observation budget without upload or read retries", async () => {
    const h = harness(["building"]);
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt).toMatchObject({
      outcome: "failed",
      failure: "not_ready",
      observations: 16,
    });
    expect(h.sites.createDeployment).toHaveBeenCalledTimes(1);
    expect(h.sites.getDeployment).toHaveBeenCalledTimes(16);
    expect(h.sites.activate).not.toHaveBeenCalled();
  });

  it("honors the whole operation deadline before another observation", async () => {
    const h = harness(["building"]);
    h.sleep.mockImplementation(() => {
      h.advance(SITE_RELEASE_LIMITS.deadlineMs);
      return Promise.resolve();
    });
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt.failure).toBe("deadline");
    expect(h.sites.getDeployment).not.toHaveBeenCalled();
  });

  it("caps a pending backoff to the remaining whole-operation time", async () => {
    const h = harness(["building"]);
    h.sites.createDeployment = vi.fn<SitesPort["createDeployment"]>((id) => {
      h.advance(SITE_RELEASE_LIMITS.deadlineMs - 1000);
      return Promise.resolve(deployed(id, "building"));
    });
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt.failure).toBe("deadline");
    expect(h.sleep.mock.calls).toEqual([[1000]]);
    expect(h.sites.getDeployment).not.toHaveBeenCalled();
  });

  it("stops on an observation failure and strips raw errors", async () => {
    const h = harness();
    h.sites.getDeployment = vi.fn(() =>
      Promise.reject(new Error("synthetic-private-response")),
    );
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt).toMatchObject({
      outcome: "failed",
      failure: "request_failed",
      candidateDeploymentId: "candidate",
    });
    expect(JSON.stringify(receipt)).not.toContain("synthetic-private");
    expect(h.sites.getDeployment).toHaveBeenCalledTimes(1);
    expect(h.sites.activate).not.toHaveBeenCalled();
  });

  it("records an uncertain upload response and never repeats the write", async () => {
    const h = harness();
    h.sites.createDeployment = vi.fn(() =>
      Promise.reject(new Error("lost response")),
    );
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt).toMatchObject({
      outcome: "create_unknown",
      previousDeploymentId: "previous",
      candidateDeploymentId: null,
      activationAttempted: false,
    });
    expect(h.sites.createDeployment).toHaveBeenCalledTimes(1);
    expect(h.sites.getDeployment).not.toHaveBeenCalled();
  });

  it("does not activate when the returned candidate belongs to another site", async () => {
    const h = harness();
    h.sites.createDeployment = vi.fn(() =>
      Promise.resolve(deployed(PRODUCTION, "ready")),
    );
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt.failure).toBe("invalid_response");
    expect(h.sites.activate).not.toHaveBeenCalled();
  });

  it("detects active deployment drift immediately before activation", async () => {
    const h = harness(["ready"]);
    let reads = 0;
    h.sites.getSite = vi.fn<SitesPort["getSite"]>((id) =>
      Promise.resolve(site(id, reads++ ? "other-controller" : "previous")),
    );
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt).toMatchObject({
      outcome: "failed",
      failure: "active_deployment_changed",
      activeDeploymentId: "other-controller",
    });
    expect(h.sites.activate).not.toHaveBeenCalled();
  });

  it.each(["lost response", "mismatched response", "verification failure"])(
    "reports activation unknown after %s without repeating or rolling back",
    async (scenario) => {
      const h = harness(["ready"]);
      if (scenario === "verification failure") {
        let reads = 0;
        h.sites.getSite = vi.fn<SitesPort["getSite"]>((id) => {
          if (++reads === 3)
            return Promise.reject(new Error("private-network-error"));
          return Promise.resolve(site(id));
        });
      } else
        h.sites.activate = vi.fn<SitesPort["activate"]>((id) => {
          if (scenario === "lost response")
            return Promise.reject(new Error("private-network-error"));
          return Promise.resolve(site(id, "wrong-deployment"));
        });
      const receipt = await runSiteRelease(
        { ...artifact(), operation: "stage" },
        h.dependencies,
      );
      expect(receipt).toMatchObject({
        outcome: "activation_unknown",
        activationAttempted: true,
        activationVerified: false,
        previousDeploymentId: "previous",
      });
      expect(h.sites.activate).toHaveBeenCalledTimes(1);
      expect(h.sites.createDeployment).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { enabled: false },
    { adapter: "ssr" },
    { deploymentRetention: 1 },
    { providerRepositoryId: "a-git-repository" },
    { scopes: ["users.read"] },
  ])(
    "rejects incompatible public site settings before upload: %j",
    async (settings) => {
      const h = harness();
      h.sites.getSite = vi.fn<SitesPort["getSite"]>((id) =>
        Promise.resolve(Object.assign(site(id), settings)),
      );
      const receipt = await runSiteRelease(
        { ...artifact(), operation: "stage" },
        h.dependencies,
      );
      expect(receipt.failure).toBe("invalid_site");
      expect(h.sites.createDeployment).not.toHaveBeenCalled();
    },
  );

  it("does not write to the service if the receipt cannot be persisted", async () => {
    const h = harness();
    h.dependencies.persist = () =>
      Promise.reject(new Error("disk-full-private-path"));
    const receipt = await runSiteRelease(
      { ...artifact(), operation: "stage" },
      h.dependencies,
    );
    expect(receipt.failure).toBe("local_io_failed");
    expect(h.calls).toEqual([]);
  });
});

async function promotion() {
  const input = artifact();
  const stage = harness(["ready"]);
  const stagingReceipt = await runSiteRelease(
    { ...input, operation: "stage" },
    stage.dependencies,
  );
  const acceptance = {
    version: 1,
    sourceSha: SHA,
    archiveSha256: input.manifest.archiveSha256,
    manifestSha256: sha(input.manifestBytes),
    stagingDeploymentId: "candidate",
    browserstackRunId: "123456",
    browserstackRunAttempt: 1,
    passed: true,
  };
  return {
    ...input,
    operation: "promote" as const,
    productionSiteId: PRODUCTION,
    stagingReceipt,
    acceptance,
  };
}

describe("same-archive promotion", () => {
  it("uploads the same bytes to a distinct site and retains both deployment IDs", async () => {
    const input = await promotion();
    const h = harness(["ready"]);
    h.sites.getSite = vi.fn<SitesPort["getSite"]>((id) =>
      Promise.resolve(
        site(
          id,
          id === STAGING
            ? "candidate"
            : h.calls.some((call) => call.startsWith("activate:"))
              ? "production-candidate"
              : "production-previous",
        ),
      ),
    );
    h.sites.createDeployment = vi.fn<SitesPort["createDeployment"]>(
      (id, bytes) => {
        expect(sha(bytes)).toBe(input.manifest.archiveSha256);
        return Promise.resolve(deployed(id, "ready", "production-candidate"));
      },
    );
    const receipt = await runSiteRelease(input, h.dependencies);
    expect(receipt).toMatchObject({
      outcome: "succeeded",
      siteId: PRODUCTION,
      stagingDeploymentId: "candidate",
      candidateDeploymentId: "production-candidate",
      previousDeploymentId: "production-previous",
    });
    expect(h.sites.createDeployment).toHaveBeenCalledTimes(1);
    expect(h.sites.getSite).toHaveBeenNthCalledWith(1, STAGING);
  });

  it.each([
    "archiveSha256",
    "manifestSha256",
    "sourceSha",
    "stagingDeploymentId",
  ])("rejects mismatched acceptance %s before I/O", async (key) => {
    const input = await promotion();
    const h = harness();
    Object.assign(input.acceptance, { [key]: "mismatch" });
    await expect(runSiteRelease(input, h.dependencies)).rejects.toThrow(
      "invalid_evidence",
    );
    expect(h.calls).toEqual([]);
  });

  it("refuses promotion when BrowserStack failed or staging has changed", async () => {
    const input = await promotion();
    const h = harness();
    input.acceptance.passed = false;
    await expect(runSiteRelease(input, h.dependencies)).rejects.toThrow(
      "invalid_evidence",
    );
    expect(h.calls).toEqual([]);
    input.acceptance.passed = true;
    const receipt = await runSiteRelease(input, h.dependencies);
    expect(receipt.failure).toBe("active_deployment_changed");
    expect(h.sites.createDeployment).not.toHaveBeenCalled();
  });

  it.each([STAGING, "", "../other", "https://another.example"])(
    "refuses invalid production target %s",
    async (id) => {
      const input = await promotion();
      const h = harness();
      await expect(
        runSiteRelease({ ...input, productionSiteId: id }, h.dependencies),
      ).rejects.toThrow("invalid_input");
      expect(h.calls).toEqual([]);
    },
  );
});

class OwnedMockAgent extends MockAgent {
  override destroy(): Promise<void> {
    return this.close();
  }
}

function sdk(signal?: AbortSignal) {
  const agent = new OwnedMockAgent();
  agent.disableNetConnect();
  const owned = createSitesPort({
    apiKey: "synthetic-key",
    dispatcher: agent,
    ...(signal ? { signal } : {}),
  });
  resources.push(() => owned.close());
  return {
    ...owned,
    agent,
    pool: agent.get(new URL(SITE_RELEASE_TARGET.endpoint).origin),
  };
}

const JSON_HEADERS = { "content-type": "application/json" };

describe("deployment SDK I/O bounds", () => {
  it("uses one inactive multipart upload with explicit empty commands and an SDK-generated boundary", async () => {
    let body = "";
    let contentType: string | undefined;
    let encoding: string | undefined;
    let path: string | undefined;
    const server = createServer((request, response) => {
      contentType = request.headers["content-type"];
      encoding = request.headers["accept-encoding"];
      path = request.url;
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        response.writeHead(201, JSON_HEADERS);
        response.end(JSON.stringify(deployed(STAGING)));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    resources.push(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing synthetic listener");
    const dispatcher = new Agent({
      allowH2: false,
      pipelining: 0,
      connect: (_options, callback) => {
        // This injected test connector sends invented bytes only to loopback.
        const socket = connect({ host: "127.0.0.1", port: address.port });
        socket.once("connect", () => callback(null, socket));
        socket.once("error", (error) => callback(error, null));
      },
    });
    const f = createSitesPort({ apiKey: "synthetic-key", dispatcher });
    resources.push(() => f.close());
    const bytes = Buffer.from("synthetic-archive-content");
    await f.port.createDeployment(STAGING, bytes);
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/u);
    expect(encoding).toBe("identity");
    expect(path).toBe(`/v1/sites/${STAGING}/deployments`);
    expect(body).toContain("synthetic-archive-content");
    expect(body).toContain('name="activate"\r\n\r\nfalse');
    expect(body).toContain('name="installCommand"\r\n\r\n\r\n');
    expect(body).toContain('name="buildCommand"\r\n\r\n\r\n');
    expect(body).toContain('name="outputDirectory"\r\n\r\n.');
    expect(f.requestCount()).toBe(1);
  });

  it("suppresses upstream warning headers and never exposes error response bodies", async () => {
    const f = sdk();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    f.pool.intercept({ path: `/v1/sites/${STAGING}`, method: "GET" }).reply(
      403,
      {
        message: "private-synthetic-body",
        code: 403,
        type: "private-error-type",
      },
      {
        headers: {
          ...JSON_HEADERS,
          "x-appwrite-warning": "private-synthetic-warning",
        },
      },
    );
    await expect(f.port.getSite(STAGING)).rejects.toThrow(/^request_failed$/u);
    expect(warning).not.toHaveBeenCalled();
    expect(f.requestCount()).toBe(1);
  });

  it.each([302, 421])(
    "rejects HTTP %i without redirect or automatic write retry",
    async (status) => {
      const f = sdk();
      f.pool
        .intercept({ path: `/v1/sites/${STAGING}/deployment`, method: "PATCH" })
        .reply(
          status,
          {},
          {
            headers: {
              ...JSON_HEADERS,
              location: "https://unrelated.example.invalid",
            },
          },
        )
        .delay(1);
      await expect(f.port.activate(STAGING, "candidate")).rejects.toThrow(
        /^request_failed$/u,
      );
      expect(f.requestCount()).toBe(1);
    },
  );

  it.each([
    { "content-encoding": "gzip" },
    { "content-length": String(SITE_RELEASE_LIMITS.responseBytes + 1) },
    { "content-type": "text/html" },
  ])("rejects unsupported response headers: %j", async (headers) => {
    const f = sdk();
    f.pool
      .intercept({ path: `/v1/sites/${STAGING}`, method: "GET" })
      .reply(200, "{}", { headers: { ...JSON_HEADERS, ...headers } })
      .delay(1);
    await expect(f.port.getSite(STAGING)).rejects.toThrow(/^request_failed$/u);
    expect(f.requestCount()).toBe(1);
  });

  it("caps a body with no content-length", async () => {
    const f = sdk();
    f.pool
      .intercept({ path: `/v1/sites/${STAGING}`, method: "GET" })
      .reply(200, " ".repeat(SITE_RELEASE_LIMITS.responseBytes + 1), {
        headers: JSON_HEADERS,
      })
      .delay(1);
    await expect(f.port.getSite(STAGING)).rejects.toThrow(/^request_failed$/u);
  });

  it("cancels a pending SDK request through the real signal", async () => {
    const controller = new AbortController();
    const f = sdk(controller.signal);
    f.pool
      .intercept({ path: `/v1/sites/${STAGING}`, method: "GET" })
      .reply(200, {}, { headers: JSON_HEADERS })
      .delay(1000);
    const pending = f.port.getSite(STAGING);
    controller.abort();
    await expect(pending).rejects.toThrow(/^deadline$/u);
    expect(f.requestCount()).toBeLessThanOrEqual(1);
  });

  it("rejects an unconfigured site and the multi-chunk upload path before dispatch", async () => {
    const f = sdk();
    await expect(f.port.getSite(PRODUCTION)).rejects.toThrow(
      /^invalid_input$/u,
    );
    expect(() =>
      f.port.createDeployment(
        STAGING,
        new Uint8Array(SITE_RELEASE_LIMITS.archiveBytes + 1),
      ),
    ).toThrow("invalid_input");
    expect(f.requestCount()).toBe(0);
  });

  it("enforces the total dispatch budget", async () => {
    const f = sdk();
    f.pool
      .intercept({ path: `/v1/sites/${STAGING}`, method: "GET" })
      .reply(200, {}, { headers: JSON_HEADERS })
      .times(SITE_RELEASE_LIMITS.requests);
    for (let index = 0; index < SITE_RELEASE_LIMITS.requests; index++)
      await f.port.getSite(STAGING);
    await expect(f.port.getSite(STAGING)).rejects.toThrow();
    expect(f.requestCount()).toBe(SITE_RELEASE_LIMITS.requests);
    f.agent.assertNoPendingInterceptors();
  });
});
