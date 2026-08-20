export const DEFAULT_DEMO_API_HOST = "127.0.0.1" as const;
export const DEFAULT_DEMO_API_PORT = 3100 as const;

export type DemoApiListenHost = "127.0.0.1" | "::1";

export interface DemoApiListenOptions {
  readonly host: DemoApiListenHost;
  readonly port: number;
}

export type DemoApiListenEnvironment = Readonly<
  Record<string, string | undefined>
>;

export class DemoApiListenOptionsError extends Error {
  constructor(
    public readonly code:
      "INVALID_DEMO_API_LISTEN_HOST" | "INVALID_DEMO_API_LISTEN_PORT",
  ) {
    super(
      code === "INVALID_DEMO_API_LISTEN_HOST"
        ? "The demo API listen host must be an exact loopback IP literal."
        : "The demo API listen port must be a decimal integer from 1 through 65535.",
    );
    this.name = "DemoApiListenOptionsError";
  }
}

export function resolveDemoApiListenOptions(
  environment: DemoApiListenEnvironment,
): DemoApiListenOptions {
  const host = environment.HOST ?? DEFAULT_DEMO_API_HOST;
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new DemoApiListenOptionsError("INVALID_DEMO_API_LISTEN_HOST");
  }

  const rawPort = environment.PORT;
  if (rawPort === undefined) {
    return { host, port: DEFAULT_DEMO_API_PORT };
  }
  if (!/^[1-9][0-9]{0,4}$/.test(rawPort)) {
    throw new DemoApiListenOptionsError("INVALID_DEMO_API_LISTEN_PORT");
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port > 65_535) {
    throw new DemoApiListenOptionsError("INVALID_DEMO_API_LISTEN_PORT");
  }

  return { host, port };
}
