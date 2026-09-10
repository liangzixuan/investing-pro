import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ENTRYPOINTS = [
  ["workspace-server.js", "personal workspace"],
  ["vault-server.js", "personal vault"],
] as const;

/** Missing mode stops startup before vault/source access or listening. */
export function verifyBuiltApiEntrypoints(apiDirectory: string): void {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ["SystemRoot", "WINDIR"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }

  for (const [filename, label] of ENTRYPOINTS) {
    const failure = `The built ${label} API entrypoint failed its isolated startup smoke.`;
    try {
      const result = spawnSync(
        process.execPath,
        ["--no-warnings", resolve(apiDirectory, "dist/src", filename)],
        {
          cwd: apiDirectory,
          env: environment,
          encoding: "utf8",
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 5_000,
          killSignal: "SIGKILL",
          maxBuffer: 8_192,
        },
      );
      if (
        result.error !== undefined ||
        result.signal !== null ||
        result.status !== 1 ||
        result.stdout !== "" ||
        result.stderr !== `Research Cockpit ${label} API failed to start.\n`
      ) {
        throw new Error(failure);
      }
    } catch {
      // Child diagnostics are intentionally not copied into build logs.
      throw new Error(failure);
    }
  }
}
