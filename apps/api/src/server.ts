import { createConfiguredApp } from "./composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";

try {
  const { host, port } = resolveDemoApiListenOptions(process.env);
  const compositionEnvironment = Object.freeze({
    HOST: process.env.HOST,
    PORT: process.env.PORT,
    RESEARCH_COCKPIT_MODE: process.env.RESEARCH_COCKPIT_MODE,
    PERSONAL_FILING_QUALITY_RESULT_PATH:
      process.env.PERSONAL_FILING_QUALITY_RESULT_PATH,
    PERSONAL_FILING_QUALITY_RESULT_SHA256:
      process.env.PERSONAL_FILING_QUALITY_RESULT_SHA256,
  });
  delete process.env.PERSONAL_FILING_QUALITY_RESULT_PATH;
  delete process.env.PERSONAL_FILING_QUALITY_RESULT_SHA256;
  const app = await createConfiguredApp(compositionEnvironment);
  const address = await app.listen({ port, host });
  process.stdout.write(`Research Cockpit local API listening on ${address}\n`);
} catch (error) {
  void error;
  process.stderr.write("Research Cockpit local API failed to start.\n");
  process.exitCode = 1;
}
