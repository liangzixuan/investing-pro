import { checkPostgresAcceptanceHarness } from "./postgres-acceptance";

const violations = await checkPostgresAcceptanceHarness();
if (violations.length > 0) {
  throw new Error(
    `PostgreSQL acceptance harness violations:\n- ${violations.join("\n- ")}`,
  );
}

process.stdout.write("PostgreSQL acceptance harness verified statically.\n");
