import { resolveDemoApiListenOptions } from "./listen-options";
import {
  capturePersonalWorkspaceApiEnvironment,
  createPersonalWorkspaceConfiguredApp,
} from "./workspace-composition-root";

async function start(): Promise<void> {
  const environment = capturePersonalWorkspaceApiEnvironment(process.env);
  const { host, port } = resolveDemoApiListenOptions(environment);
  const app = await createPersonalWorkspaceConfiguredApp(environment);
  await app.listen({ host, port });
  process.stdout.write(
    "Research Cockpit personal workspace API is listening.\n",
  );
}

start().catch(() => {
  process.stderr.write(
    "Research Cockpit personal workspace API failed to start.\n",
  );
  process.exitCode = 1;
});
