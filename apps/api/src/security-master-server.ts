import {
  captureSecurityMasterApiEnvironment,
  createSecurityMasterConfiguredApp,
} from "./security-master-composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";

async function start(): Promise<void> {
  const environment = captureSecurityMasterApiEnvironment(process.env);
  const app = await createSecurityMasterConfiguredApp(environment);
  const { host, port } = resolveDemoApiListenOptions(environment);
  await app.listen({ host, port });
  process.stdout.write(
    "Research Cockpit personal security-master API is listening.\n",
  );
}

start().catch(() => {
  process.stderr.write(
    "Research Cockpit personal security-master API failed to start.\n",
  );
  process.exitCode = 1;
});
