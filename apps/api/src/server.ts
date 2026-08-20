import { buildApp } from "./app";
import { resolveDemoApiListenOptions } from "./listen-options";

try {
  const { host, port } = resolveDemoApiListenOptions(process.env);
  const app = await buildApp();
  const address = await app.listen({ port, host });
  process.stdout.write(`Research Cockpit demo API listening on ${address}\n`);
} catch (error) {
  void error;
  process.stderr.write("Research Cockpit demo API failed to start.\n");
  process.exitCode = 1;
}
