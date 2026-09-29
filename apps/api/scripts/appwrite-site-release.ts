import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { AppwriteException, Client, Sites } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { Agent, DecoratorHandler, type Dispatcher } from "undici";

export const SITE_RELEASE_TARGET = Object.freeze({
  endpoint: "https://nyc.cloud.appwrite.io/v1",
  projectId: "6abac57a0007b7c1a671",
  stagingSiteId: "6abadfd3003d87db016b",
});

export const SITE_RELEASE_LIMITS = Object.freeze({
  archiveBytes: 4 * 1024 * 1024,
  jsonBytes: 64 * 1024,
  responseBytes: 1024 * 1024,
  deadlineMs: 8 * 60 * 1000,
  requestMs: 15 * 1000,
  uploadMs: 90 * 1000,
  requests: 24,
  observations: 16,
});

type Operation = "stage" | "promote";
type DeploymentStatus =
  "waiting" | "processing" | "building" | "ready" | "canceled" | "failed";
type Failure =
  | "invalid_input"
  | "invalid_evidence"
  | "invalid_site"
  | "invalid_response"
  | "request_failed"
  | "deadline"
  | "request_limit"
  | "build_failed"
  | "not_ready"
  | "active_deployment_changed"
  | "local_io_failed";

class ReleaseError extends Error {
  constructor(readonly code: Failure) {
    super(code);
  }
}

function reject(code: Failure): never {
  throw new ReleaseError(code);
}

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const isSha = (value: unknown, length: number): value is string =>
  typeof value === "string" &&
  new RegExp(`^[a-f0-9]{${length}}$`, "u").test(value);
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/u.test(value);
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    reject("invalid_evidence");
  return value as Record<string, unknown>;
};
const exactKeys = (value: Record<string, unknown>, keys: string[]) => {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    reject("invalid_evidence");
};
const integer = (value: unknown, maximum: number): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0 &&
  value <= maximum;

export interface ArtifactManifest {
  version: 1;
  sourceSha: string;
  archiveSha256: string;
  archiveBytes: number;
  files: { path: string; sha256: string; bytes: number }[];
}

export function validateArtifact(
  archive: Uint8Array,
  manifestBytes: Uint8Array,
): { manifest: ArtifactManifest; manifestSha256: string } {
  if (
    !integer(archive.byteLength, SITE_RELEASE_LIMITS.archiveBytes) ||
    !integer(manifestBytes.byteLength, SITE_RELEASE_LIMITS.jsonBytes)
  )
    reject("invalid_input");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(manifestBytes).toString("utf8"));
  } catch {
    reject("invalid_evidence");
  }
  const manifest = record(parsed);
  exactKeys(manifest, [
    "version",
    "sourceSha",
    "archiveSha256",
    "archiveBytes",
    "files",
  ]);
  if (
    manifest.version !== 1 ||
    !isSha(manifest.sourceSha, 40) ||
    !isSha(manifest.archiveSha256, 64) ||
    manifest.archiveBytes !== archive.byteLength ||
    manifest.archiveSha256 !== hash(archive) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < 2 ||
    manifest.files.length > 64
  )
    reject("invalid_evidence");
  const paths = new Set<string>();
  for (const item of manifest.files) {
    const file = record(item);
    exactKeys(file, ["path", "sha256", "bytes"]);
    if (
      typeof file.path !== "string" ||
      (file.path !== "index.html" &&
        !/^assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/u.test(
          file.path,
        )) ||
      paths.has(file.path) ||
      !isSha(file.sha256, 64) ||
      !integer(file.bytes, 16 * 1024 * 1024)
    )
      reject("invalid_evidence");
    paths.add(file.path);
  }
  if (!paths.has("index.html")) reject("invalid_evidence");
  // The trusted packaging job verifies archive members and the source marker.
  // This operation binds those exact retained bytes without unpacking or rebuilding.
  return {
    manifest: manifest as unknown as ArtifactManifest,
    manifestSha256: hash(manifestBytes),
  };
}

export interface ReleaseReceipt {
  version: 1;
  operation: Operation;
  sourceSha: string;
  archiveSha256: string;
  manifestSha256: string;
  archiveBytes: number;
  siteId: string;
  stagingDeploymentId: string | null;
  previousDeploymentId: string | null;
  candidateDeploymentId: string | null;
  activeDeploymentId: string | null;
  deploymentStatus: DeploymentStatus | null;
  observations: number;
  createAttempted: boolean;
  activationAttempted: boolean;
  activationVerified: boolean;
  outcome:
    | "pending"
    | "succeeded"
    | "failed"
    | "create_unknown"
    | "activation_unknown";
  failure: Failure | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SitesPort {
  getSite: (siteId: string) => Promise<unknown>;
  createDeployment: (siteId: string, archive: Uint8Array) => Promise<unknown>;
  getDeployment: (siteId: string, deploymentId: string) => Promise<unknown>;
  activate: (siteId: string, deploymentId: string) => Promise<unknown>;
}

interface ReleaseInput {
  operation: Operation;
  archive: Uint8Array;
  manifestBytes: Uint8Array;
  productionSiteId?: string;
  stagingReceipt?: unknown;
  acceptance?: unknown;
}

interface Dependencies {
  sites: SitesPort;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<unknown>;
  persist?: (receipt: ReleaseReceipt) => Promise<void>;
}

function siteActive(value: unknown, siteId: string): string {
  const site = record(value);
  if (
    site.$id !== siteId ||
    site.enabled !== true ||
    site.adapter !== "static" ||
    site.framework !== "other" ||
    site.fallbackFile !== "index.html" ||
    site.deploymentRetention !== 0 ||
    site.providerRepositoryId !== "" ||
    site.installationId !== "" ||
    !Array.isArray(site.scopes) ||
    site.scopes.length !== 0 ||
    (site.deploymentId !== "" && !isId(site.deploymentId))
  )
    reject("invalid_site");
  return site.deploymentId;
}

function deployment(
  value: unknown,
  siteId: string,
  expectedId?: string,
): { id: string; status: DeploymentStatus } {
  const data = record(value);
  const statuses: readonly unknown[] = [
    "waiting",
    "processing",
    "building",
    "ready",
    "failed",
    "canceled",
  ];
  if (
    !isId(data.$id) ||
    (expectedId !== undefined && data.$id !== expectedId) ||
    data.resourceId !== siteId ||
    data.resourceType !== "sites" ||
    data.activate !== false ||
    !statuses.includes(data.status)
  )
    reject("invalid_response");
  return { id: data.$id, status: data.status as DeploymentStatus };
}

export function validateStagingReceipt(
  value: unknown,
  manifest: ArtifactManifest,
  manifestSha256: string,
): { stagingDeploymentId: string } {
  const staged = record(value);
  if (
    staged.version !== 1 ||
    staged.operation !== "stage" ||
    staged.outcome !== "succeeded" ||
    staged.failure !== null ||
    staged.activationVerified !== true ||
    staged.activationAttempted !== true ||
    staged.createAttempted !== true ||
    staged.deploymentStatus !== "ready" ||
    staged.siteId !== SITE_RELEASE_TARGET.stagingSiteId ||
    !isId(staged.candidateDeploymentId) ||
    staged.activeDeploymentId !== staged.candidateDeploymentId ||
    staged.archiveBytes !== manifest.archiveBytes ||
    staged.sourceSha !== manifest.sourceSha ||
    staged.archiveSha256 !== manifest.archiveSha256 ||
    staged.manifestSha256 !== manifestSha256
  )
    reject("invalid_evidence");
  return { stagingDeploymentId: staged.candidateDeploymentId };
}

function promotionEvidence(
  input: ReleaseInput,
  manifest: ArtifactManifest,
  manifestSha256: string,
): string {
  const accepted = record(input.acceptance);
  exactKeys(accepted, [
    "version",
    "sourceSha",
    "archiveSha256",
    "manifestSha256",
    "stagingDeploymentId",
    "browserstackRunId",
    "browserstackRunAttempt",
    "passed",
  ]);
  const staged = validateStagingReceipt(
    input.stagingReceipt,
    manifest,
    manifestSha256,
  );
  if (
    accepted.version !== 1 ||
    accepted.passed !== true ||
    typeof accepted.browserstackRunId !== "string" ||
    !/^[1-9]\d{0,19}$/u.test(accepted.browserstackRunId) ||
    !integer(accepted.browserstackRunAttempt, 1000) ||
    accepted.stagingDeploymentId !== staged.stagingDeploymentId ||
    accepted.sourceSha !== manifest.sourceSha ||
    accepted.archiveSha256 !== manifest.archiveSha256 ||
    accepted.manifestSha256 !== manifestSha256
  )
    reject("invalid_evidence");
  return staged.stagingDeploymentId;
}

export async function runSiteRelease(
  input: ReleaseInput,
  dependencies: Dependencies,
): Promise<ReleaseReceipt> {
  if (input.archive.byteLength > SITE_RELEASE_LIMITS.archiveBytes)
    reject("invalid_input");
  const archive = Uint8Array.from(input.archive);
  const { manifest, manifestSha256 } = validateArtifact(
    archive,
    input.manifestBytes,
  );
  if (input.operation !== "stage" && input.operation !== "promote")
    reject("invalid_input");
  if (
    (input.operation === "promote" &&
      (!isId(input.productionSiteId) ||
        input.productionSiteId === SITE_RELEASE_TARGET.stagingSiteId)) ||
    (input.operation === "stage" && input.productionSiteId !== undefined)
  )
    reject("invalid_input");
  const stagingDeploymentId =
    input.operation === "promote"
      ? promotionEvidence(input, manifest, manifestSha256)
      : null;
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? delay;
  const started = now();
  const siteId =
    input.operation === "stage"
      ? SITE_RELEASE_TARGET.stagingSiteId
      : input.productionSiteId!;
  const receipt: ReleaseReceipt = {
    version: 1,
    operation: input.operation,
    sourceSha: manifest.sourceSha,
    archiveSha256: manifest.archiveSha256,
    manifestSha256,
    archiveBytes: manifest.archiveBytes,
    siteId,
    stagingDeploymentId,
    previousDeploymentId: null,
    candidateDeploymentId: null,
    activeDeploymentId: null,
    deploymentStatus: null,
    observations: 0,
    createAttempted: false,
    activationAttempted: false,
    activationVerified: false,
    outcome: "pending",
    failure: null,
    startedAt: new Date(started).toISOString(),
    finishedAt: null,
  };
  const persist = async () => {
    try {
      await dependencies.persist?.({ ...receipt });
    } catch {
      reject("local_io_failed");
    }
  };
  const assertTime = () => {
    if (now() - started >= SITE_RELEASE_LIMITS.deadlineMs) reject("deadline");
  };
  try {
    await persist();
    if (stagingDeploymentId !== null) {
      const active = siteActive(
        await dependencies.sites.getSite(SITE_RELEASE_TARGET.stagingSiteId),
        SITE_RELEASE_TARGET.stagingSiteId,
      );
      if (active !== stagingDeploymentId) reject("active_deployment_changed");
    }
    assertTime();
    receipt.previousDeploymentId = siteActive(
      await dependencies.sites.getSite(siteId),
      siteId,
    );
    receipt.activeDeploymentId = receipt.previousDeploymentId;
    assertTime();
    // Persist the prior active ID and intent before sending the only upload.
    receipt.createAttempted = true;
    await persist();
    const created = deployment(
      await dependencies.sites.createDeployment(siteId, archive),
      siteId,
    );
    if (created.id === receipt.previousDeploymentId) reject("invalid_response");
    receipt.candidateDeploymentId = created.id;
    receipt.deploymentStatus = created.status;
    await persist();
    const backoff = [2000, 4000, 8000, 15000, 30000];
    while (receipt.deploymentStatus !== "ready") {
      if (["failed", "canceled"].includes(receipt.deploymentStatus))
        reject("build_failed");
      if (receipt.observations >= SITE_RELEASE_LIMITS.observations)
        reject("not_ready");
      assertTime();
      await sleep(
        Math.min(
          backoff[Math.min(receipt.observations, backoff.length - 1)]!,
          SITE_RELEASE_LIMITS.deadlineMs - (now() - started),
        ),
      );
      assertTime();
      const observed = deployment(
        await dependencies.sites.getDeployment(siteId, created.id),
        siteId,
        created.id,
      );
      receipt.observations++;
      receipt.deploymentStatus = observed.status;
      await persist();
    }
    assertTime();
    // This is drift detection, not an API compare-and-swap. The CI controller
    // serializes deployment, BrowserStack acceptance and promotion.
    receipt.activeDeploymentId = siteActive(
      await dependencies.sites.getSite(siteId),
      siteId,
    );
    if (receipt.activeDeploymentId !== receipt.previousDeploymentId)
      reject("active_deployment_changed");
    assertTime();
    receipt.activationAttempted = true;
    await persist();
    const activated = siteActive(
      await dependencies.sites.activate(siteId, created.id),
      siteId,
    );
    if (activated !== created.id) reject("invalid_response");
    assertTime();
    receipt.activeDeploymentId = siteActive(
      await dependencies.sites.getSite(siteId),
      siteId,
    );
    if (receipt.activeDeploymentId !== created.id)
      reject("active_deployment_changed");
    assertTime();
    receipt.activationVerified = true;
    receipt.outcome = "succeeded";
  } catch (error) {
    receipt.failure =
      error instanceof ReleaseError ? error.code : "request_failed";
    receipt.outcome = receipt.activationAttempted
      ? "activation_unknown"
      : receipt.createAttempted && receipt.candidateDeploymentId === null
        ? "create_unknown"
        : "failed";
  }
  receipt.finishedAt = new Date(now()).toISOString();
  try {
    await persist();
  } catch {
    receipt.failure = "local_io_failed";
    if (receipt.activationVerified) receipt.outcome = "failed";
  }
  return receipt;
}

/** Deployment-only SDK transport. It does not alter the repository transport. */
export function createSitesPort(options: {
  apiKey: string;
  productionSiteId?: string;
  dispatcher?: Dispatcher;
  signal?: AbortSignal;
}) {
  if (!options.apiKey || /[\r\n]/u.test(options.apiKey))
    reject("invalid_input");
  if (
    options.productionSiteId !== undefined &&
    (!isId(options.productionSiteId) ||
      options.productionSiteId === SITE_RELEASE_TARGET.stagingSiteId)
  )
    reject("invalid_input");
  const targets = new Set<string>([SITE_RELEASE_TARGET.stagingSiteId]);
  if (options.productionSiteId) targets.add(options.productionSiteId);
  const endpoint = new URL(SITE_RELEASE_TARGET.endpoint);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    SITE_RELEASE_LIMITS.deadlineMs,
  );
  timer.unref();
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const agent =
    options.dispatcher ??
    new Agent({ allowH2: false, connections: 1, pipelining: 0 });
  let requests = 0;
  let closed = false;
  let closing: Promise<void> | undefined;

  class SitesClient extends Client {
    override prepareRequest(
      method: string,
      url: URL,
      headers: Parameters<Client["prepareRequest"]>[2] = {},
      params: Parameters<Client["prepareRequest"]>[3] = {},
    ): ReturnType<Client["prepareRequest"]> {
      method = method.toUpperCase();
      if (closed || signal.aborted) reject("deadline");
      const segments = url.pathname.split("/");
      const siteId = segments[3];
      const getSite = method === "GET" && segments.length === 4;
      const upload =
        method === "POST" &&
        segments.length === 5 &&
        segments[4] === "deployments";
      const getDeployment =
        method === "GET" &&
        segments.length === 6 &&
        segments[4] === "deployments" &&
        isId(segments[5]);
      const activate =
        method === "PATCH" &&
        segments.length === 5 &&
        segments[4] === "deployment" &&
        isId(params.deploymentId);
      if (
        url.origin !== endpoint.origin ||
        url.username !== "" ||
        url.password !== "" ||
        url.search !== "" ||
        url.hash !== "" ||
        segments[1] !== "v1" ||
        segments[2] !== "sites" ||
        !siteId ||
        !targets.has(siteId) ||
        !(getSite || upload || getDeployment || activate) ||
        this.config.selfSigned ||
        this.config.endpoint !== SITE_RELEASE_TARGET.endpoint ||
        Object.keys({ ...this.headers, ...headers }).some((name) =>
          ["host", ":authority"].includes(name.toLowerCase()),
        ) ||
        (upload &&
          (headers["content-type"] !== "multipart/form-data" ||
            params.activate !== false ||
            params.installCommand !== "" ||
            params.buildCommand !== "" ||
            params.outputDirectory !== "."))
      )
        reject("invalid_input");
      const prepared = super.prepareRequest(
        method,
        new URL(url),
        headers,
        params,
      );
      const policy = new AbortController();
      const requestSignal = AbortSignal.any([
        signal,
        policy.signal,
        AbortSignal.timeout(
          upload ? SITE_RELEASE_LIMITS.uploadMs : SITE_RELEASE_LIMITS.requestMs,
        ),
      ]);
      prepared.options.signal = requestSignal;
      prepared.options.redirect = "error";
      // Preserve the SDK's multipart header removal; fetch supplies the boundary.
      prepared.options.headers = {
        ...(prepared.options.headers as Record<string, string>),
        "accept-encoding": "identity",
      };
      prepared.options.dispatcher = agent.compose(
        (dispatch) => (input, handler) => {
          if (signal.aborted || requestSignal.aborted || closed)
            reject("deadline");
          if (requests >= SITE_RELEASE_LIMITS.requests) reject("request_limit");
          if (
            input.origin?.toString() !== endpoint.origin ||
            input.path !== url.pathname
          )
            reject("invalid_input");
          requests++;
          let bytes = 0;
          const wrapped: Dispatcher.DispatchHandlers = new DecoratorHandler(
            handler,
          );
          wrapped.onHeaders = (status, responseHeaders, resume, statusText) => {
            if (requestSignal.aborted) return false;
            if (status < 200)
              return (
                handler.onHeaders?.(
                  status,
                  responseHeaders,
                  resume,
                  statusText,
                ) ?? true
              );
            // Fetch retries 421 internally, including writes, unless intercepted.
            if ((status >= 300 && status < 400) || status === 421) {
              policy.abort();
              return false;
            }
            const filtered: Buffer[] = [];
            let json = false;
            for (let index = 0; index < responseHeaders.length; index += 2) {
              const name = responseHeaders[index];
              const value = responseHeaders[index + 1];
              if (!name || !value) {
                policy.abort();
                return false;
              }
              const key = name.toString().toLowerCase();
              const text = value.toString();
              if (
                (key === "content-encoding" &&
                  text.trim().toLowerCase() !== "identity") ||
                (key === "content-length" &&
                  (!/^(?:0|[1-9]\d*)$/u.test(text) ||
                    Number(text) > SITE_RELEASE_LIMITS.responseBytes))
              ) {
                policy.abort();
                return false;
              }
              if (key === "content-type") {
                json = /^application\/json(?:\s*;|$)/iu.test(text);
                filtered.push(name, Buffer.from("application/json"));
              } else if (key !== "x-appwrite-warning")
                filtered.push(name, value);
            }
            if (!json) {
              policy.abort();
              return false;
            }
            return (
              handler.onHeaders?.(status, filtered, resume, statusText) ?? true
            );
          };
          wrapped.onData = (chunk) => {
            bytes += chunk.byteLength;
            if (bytes > SITE_RELEASE_LIMITS.responseBytes) {
              policy.abort();
              return false;
            }
            if (requestSignal.aborted) return false;
            return handler.onData?.(chunk) ?? true;
          };
          wrapped.onComplete = (trailers) => {
            if (!requestSignal.aborted) handler.onComplete?.(trailers);
          };
          return dispatch({ ...input, idempotent: false }, wrapped);
        },
      );
      return prepared;
    }

    override async call(
      method: string,
      url: URL,
      headers: Parameters<Client["call"]>[2] = {},
      params: Parameters<Client["call"]>[3] = {},
      responseType = "json",
    ): Promise<unknown> {
      if (responseType !== "json") reject("invalid_input");
      try {
        const result: unknown = await super.call(
          method,
          url,
          headers,
          params,
          responseType,
        );
        if (signal.aborted || closed) reject("deadline");
        return result;
      } catch (error) {
        if (error instanceof ReleaseError) throw error;
        // SDK errors contain raw response bodies. Never expose message/cause.
        if (signal.aborted) reject("deadline");
        if (error instanceof AppwriteException) reject("request_failed");
        reject("request_failed");
      }
    }
  }

  const client = new SitesClient()
    .setEndpoint(SITE_RELEASE_TARGET.endpoint)
    .setProject(SITE_RELEASE_TARGET.projectId)
    .setKey(options.apiKey);
  const sites = new Sites(client);
  const port: SitesPort = {
    getSite: (siteId) => sites.get({ siteId }),
    createDeployment: (siteId, archive) => {
      if (!integer(archive.byteLength, SITE_RELEASE_LIMITS.archiveBytes))
        reject("invalid_input");
      return sites.createDeployment({
        siteId,
        code: InputFile.fromBuffer(archive, "site.tar.gz"),
        installCommand: "",
        buildCommand: "",
        outputDirectory: ".",
        activate: false,
      });
    },
    getDeployment: (siteId, deploymentId) =>
      sites.getDeployment({ siteId, deploymentId }),
    activate: (siteId, deploymentId) =>
      sites.updateSiteDeployment({ siteId, deploymentId }),
  };
  return {
    port,
    requestCount: () => requests,
    async close() {
      if (closing) return closing;
      closed = true;
      clearTimeout(timer);
      controller.abort();
      closing = agent.destroy();
      await closing;
    },
  };
}

async function readBounded(path: string, maximum: number): Promise<Buffer> {
  const file = await open(path, "r");
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || !integer(metadata.size, maximum))
      reject("invalid_input");
    const data = Buffer.alloc(metadata.size + 1);
    let bytes = 0;
    while (bytes < data.byteLength) {
      const result = await file.read(
        data,
        bytes,
        data.byteLength - bytes,
        bytes,
      );
      if (result.bytesRead === 0) break;
      bytes += result.bytesRead;
    }
    if (bytes !== metadata.size) reject("invalid_input");
    return data.subarray(0, bytes);
  } finally {
    await file.close();
  }
}

async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  const operation = args.shift();
  if (operation !== "stage" && operation !== "promote") reject("invalid_input");
  const options = new Map<string, string>();
  const allowed = new Set(["--archive", "--manifest", "--receipt"]);
  if (operation === "promote") {
    allowed.add("--acceptance");
    allowed.add("--staging-receipt");
  }
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
      !key ||
      !allowed.has(key) ||
      !value ||
      value.startsWith("--") ||
      options.has(key)
    )
      reject("invalid_input");
    options.set(key, value);
  }
  if (options.size !== allowed.size) reject("invalid_input");
  const archive = await readBounded(
    options.get("--archive")!,
    SITE_RELEASE_LIMITS.archiveBytes,
  );
  const manifestBytes = await readBounded(
    options.get("--manifest")!,
    SITE_RELEASE_LIMITS.jsonBytes,
  );
  validateArtifact(archive, manifestBytes);
  const input: ReleaseInput = { operation, archive, manifestBytes };
  if (operation === "promote") {
    input.productionSiteId = process.env.APPWRITE_PRODUCTION_SITE_ID ?? "";
    input.acceptance = JSON.parse(
      (
        await readBounded(
          options.get("--acceptance")!,
          SITE_RELEASE_LIMITS.jsonBytes,
        )
      ).toString("utf8"),
    );
    input.stagingReceipt = JSON.parse(
      (
        await readBounded(
          options.get("--staging-receipt")!,
          SITE_RELEASE_LIMITS.jsonBytes,
        )
      ).toString("utf8"),
    );
  }
  const receiptFile = await open(options.get("--receipt")!, "wx", 0o600);
  let transport: ReturnType<typeof createSitesPort> | undefined;
  try {
    transport = createSitesPort({
      apiKey: process.env.APPWRITE_API_KEY ?? "",
      ...(input.productionSiteId
        ? { productionSiteId: input.productionSiteId }
        : {}),
    });
    const receipt = await runSiteRelease(input, {
      sites: transport.port,
      persist: async (value) => {
        const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n");
        await receiptFile.truncate(0);
        let written = 0;
        while (written < bytes.byteLength) {
          const result = await receiptFile.write(
            bytes,
            written,
            bytes.byteLength - written,
            written,
          );
          if (result.bytesWritten === 0) reject("local_io_failed");
          written += result.bytesWritten;
        }
        await receiptFile.sync();
      },
    });
    process.stdout.write(JSON.stringify(receipt) + "\n");
    if (receipt.outcome !== "succeeded") process.exitCode = 1;
  } finally {
    await transport?.close();
    await receiptFile.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void cli().catch((error: unknown) => {
    process.stderr.write(
      JSON.stringify({
        version: 1,
        outcome: "failed",
        failure: error instanceof ReleaseError ? error.code : "local_io_failed",
      }) + "\n",
    );
    process.exitCode = 1;
  });
}
