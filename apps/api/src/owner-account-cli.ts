import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

import {
  createPersonalOwnerAccountRecord,
  isValidPersonalOwnerPassword,
  isValidPersonalOwnerUsername,
  readPersonalOwnerAccountFile,
  writePersonalOwnerAccountFile,
} from "./personal-owner-account";

async function isListening(host: string, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(2_000, () => {
      socket.destroy();
      reject(new Error("Port check unavailable."));
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (
        error.code === "ECONNREFUSED" ||
        (host === "::1" && error.code === "EAFNOSUPPORT")
      )
        resolve(false);
      else reject(new Error("Port check unavailable."));
    });
  });
}

async function requireStopped(port: number): Promise<void> {
  if (
    (
      await Promise.all([
        isListening("127.0.0.1", port),
        isListening("::1", port),
      ])
    ).some(Boolean)
  ) {
    throw new Error(
      "Stop the local API before setting up or resetting the account.",
    );
  }
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  let file: string | undefined;
  let reset = false;
  let port = 3100;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--file" && file === undefined) file = args[++index];
    else if (argument === "--reset" && !reset) reset = true;
    else if (
      argument === "--port" &&
      /^[1-9][0-9]{0,4}$/u.test(args[index + 1] ?? "")
    )
      port = Number(args[++index]);
    else
      throw new Error(
        "Use owner-account --file <absolute path> [--reset] [--port 3100].",
      );
  }
  if (file === undefined || !isAbsolute(file) || port > 65535) {
    throw new Error(
      "Use owner-account --file <absolute path> [--reset] [--port 3100].",
    );
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Account setup requires an interactive terminal. Passwords are never accepted as arguments or printed.",
    );
  }
  await requireStopped(port);
  if (!reset && existsSync(file))
    throw new Error(
      "An owner account already exists. Use --reset only when you intend to change that login.",
    );
  // A reset must name an existing, valid account. Never recover corruption by overwriting it.
  if (reset) readPersonalOwnerAccountFile(file);
  let hidden = false;
  const output = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (!hidden) process.stdout.write(chunk);
      callback();
    },
  });
  const input = createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });
  const controller = new AbortController();
  input.on("SIGINT", () => controller.abort());
  const ask = async (prompt: string, secret = false): Promise<string> => {
    hidden = secret;
    process.stdout.write(prompt);
    const answer = await input.question("", { signal: controller.signal });
    if (secret) process.stdout.write("\n");
    return answer;
  };
  const credentials = { password: "", confirmation: "" };
  try {
    process.stdout.write(
      reset
        ? "Reset local owner login (research data is preserved).\n"
        : "Create your local owner login.\n",
    );
    const username = await ask("Username: ");
    if (!isValidPersonalOwnerUsername(username))
      throw new Error(
        "Use 1–64 characters: start with a letter or number, then letters, numbers, periods, underscores, hyphens, + or @.",
      );
    credentials.password = await ask(
      "Password (15–128 characters; input hidden): ",
      true,
    );
    credentials.confirmation = await ask(
      "Confirm password (input hidden): ",
      true,
    );
    if (!isValidPersonalOwnerPassword(credentials.password))
      throw new Error(
        "The password must contain 15–128 valid Unicode characters.",
      );
    if (credentials.password !== credentials.confirmation)
      throw new Error("Passwords did not match. No account was changed.");
    await requireStopped(port);
    const record = await createPersonalOwnerAccountRecord(
      username,
      credentials.password,
    );
    writePersonalOwnerAccountFile(file, record, { replace: reset });
    process.stdout.write(
      "Owner login saved. Start the app and sign in with your username and password.\n",
    );
  } finally {
    credentials.password = "";
    credentials.confirmation = "";
    input.close();
    output.end();
  }
}

run().catch((error: unknown) => {
  // Never serialize filesystem/KDF exceptions, paths, supplied credentials or records.
  const safeMessages = [
    "Stop the local API before setting up or resetting the account.",
    "Use owner-account --file <absolute path> [--reset] [--port 3100].",
    "Account setup requires an interactive terminal. Passwords are never accepted as arguments or printed.",
    "An owner account already exists. Use --reset only when you intend to change that login.",
    "Use 1–64 characters: start with a letter or number, then letters, numbers, periods, underscores, hyphens, + or @.",
    "The password must contain 15–128 valid Unicode characters.",
    "Passwords did not match. No account was changed.",
  ];
  process.stderr.write(
    error instanceof Error && safeMessages.includes(error.message)
      ? `${error.message}\n`
      : "Account setup did not complete. Check the local account path and permissions; an existing account requires --reset.\n",
  );
  process.exitCode = 1;
});
