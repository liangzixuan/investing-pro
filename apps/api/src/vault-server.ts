import {
  captureVaultApiEnvironment,
  createVaultConfiguredApp,
} from "./vault-composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";

async function start(): Promise<void> {
  const environment = captureVaultApiEnvironment(process.env);
  const { host, port } = resolveDemoApiListenOptions(environment);
  const app = await createVaultConfiguredApp(environment);
  await app.listen({ host, port });
  process.stdout.write("Research Cockpit personal vault API is listening.\n");
}

start().catch(() => {
  process.stderr.write(
    "Research Cockpit personal vault API failed to start.\n",
  );
  process.exitCode = 1;
});
