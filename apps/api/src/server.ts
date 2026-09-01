import {
  captureLocalApiEnvironment,
  createConfiguredApp,
  disposeCapturedLocalApiEnvironment,
} from "./composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";

declare const __RESEARCH_COCKPIT_SOURCE_COMMIT__: string;

try {
  const compositionEnvironment = captureLocalApiEnvironment(process.env);
  let prepared: Awaited<ReturnType<typeof prepareLocalApi>>;
  try {
    prepared = await prepareLocalApi(compositionEnvironment);
  } finally {
    disposeCapturedLocalApiEnvironment(compositionEnvironment);
  }
  const { app, host, port } = prepared;
  const address = await app.listen({ port, host });
  process.stdout.write(`Research Cockpit local API listening on ${address}\n`);
} catch (error) {
  void error;
  process.stderr.write("Research Cockpit local API failed to start.\n");
  process.exitCode = 1;
}

async function prepareLocalApi(
  compositionEnvironment: ReturnType<typeof captureLocalApiEnvironment>,
) {
  const { host, port } = resolveDemoApiListenOptions(compositionEnvironment);
  const runtimeSourceCommit =
    typeof __RESEARCH_COCKPIT_SOURCE_COMMIT__ === "string"
      ? __RESEARCH_COCKPIT_SOURCE_COMMIT__
      : undefined;
  const app = await createConfiguredApp(
    compositionEnvironment,
    runtimeSourceCommit,
  );
  return { app, host, port };
}
