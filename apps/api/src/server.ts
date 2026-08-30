import { createConfiguredApp } from "./composition-root";
import { resolveDemoApiListenOptions } from "./listen-options";

declare const __RESEARCH_COCKPIT_SOURCE_COMMIT__: string;

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
    PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH:
      process.env.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256:
      process.env.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256,
    PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH:
      process.env.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH,
  });
  delete process.env.PERSONAL_FILING_QUALITY_RESULT_PATH;
  delete process.env.PERSONAL_FILING_QUALITY_RESULT_SHA256;
  delete process.env.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_PATH;
  delete process.env.PERSONAL_FILING_SELECTED_FACT_RELEASE_BUNDLE_SHA256;
  delete process.env.PERSONAL_FILING_SELECTED_FACT_RELEASE_APPROVAL_PATH;
  const runtimeSourceCommit =
    typeof __RESEARCH_COCKPIT_SOURCE_COMMIT__ === "string"
      ? __RESEARCH_COCKPIT_SOURCE_COMMIT__
      : undefined;
  const app = await createConfiguredApp(
    compositionEnvironment,
    runtimeSourceCommit,
  );
  const address = await app.listen({ port, host });
  process.stdout.write(`Research Cockpit local API listening on ${address}\n`);
} catch (error) {
  void error;
  process.stderr.write("Research Cockpit local API failed to start.\n");
  process.exitCode = 1;
}
