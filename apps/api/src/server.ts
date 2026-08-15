import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? "127.0.0.1";
const app = await buildApp();

try {
  await app.listen({ port, host });
  process.stdout.write(
    `Research Cockpit demo API listening on http://${host}:${port}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
