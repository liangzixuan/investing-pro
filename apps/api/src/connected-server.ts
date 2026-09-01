import {
  captureConnectedApiEnvironment,
  createConnectedConfiguredApp,
  disposeCapturedConnectedApiEnvironment,
} from "./connected-composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";

try {
  const compositionEnvironment = captureConnectedApiEnvironment(process.env);
  let prepared: Awaited<ReturnType<typeof prepareConnectedLocalApi>>;
  try {
    prepared = await prepareConnectedLocalApi(compositionEnvironment);
  } finally {
    disposeCapturedConnectedApiEnvironment(compositionEnvironment);
  }
  const { app, host, port } = prepared;
  await app.listen({ port, host });
  process.stdout.write("Research Cockpit connected local API is listening.\n");
} catch (error) {
  void error;
  process.stderr.write(
    "Research Cockpit connected local API failed to start.\n",
  );
  process.exitCode = 1;
}

async function prepareConnectedLocalApi(
  compositionEnvironment: ReturnType<typeof captureConnectedApiEnvironment>,
) {
  const { host, port } = resolveDemoApiListenOptions(compositionEnvironment);
  const app = await createConnectedConfiguredApp(compositionEnvironment, {
    connectedSourceClock: {
      now: () => new Date().toISOString(),
    },
  });
  return { app, host, port };
}
