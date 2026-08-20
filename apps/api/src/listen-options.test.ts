import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEMO_API_HOST,
  DEFAULT_DEMO_API_PORT,
  DemoApiListenOptionsError,
  resolveDemoApiListenOptions,
} from "./listen-options";

describe("demo API listen options", () => {
  it("defaults to the exact IPv4 loopback and port 3100", () => {
    expect(resolveDemoApiListenOptions({})).toEqual({
      host: DEFAULT_DEMO_API_HOST,
      port: DEFAULT_DEMO_API_PORT,
    });
  });

  it("accepts only the two literal loopback bind hosts", () => {
    expect(
      resolveDemoApiListenOptions({ HOST: "127.0.0.1", PORT: "1" }),
    ).toEqual({ host: "127.0.0.1", port: 1 });
    expect(resolveDemoApiListenOptions({ HOST: "::1", PORT: "65535" })).toEqual(
      { host: "::1", port: 65_535 },
    );
  });

  it("rejects every nonliteral or nonloopback host without echoing it", () => {
    for (const host of [
      "localhost",
      "0.0.0.0",
      "::",
      "::ffff:127.0.0.1",
      "127.0.0.2",
      " 127.0.0.1",
      "127.0.0.1 ",
      "http://127.0.0.1",
      "",
    ]) {
      try {
        resolveDemoApiListenOptions({ HOST: host });
        throw new Error("Expected the invalid host to be rejected.");
      } catch (error) {
        expect(error).toBeInstanceOf(DemoApiListenOptionsError);
        expect(error).toMatchObject({
          code: "INVALID_DEMO_API_LISTEN_HOST",
        });
        expect((error as Error).message).toBe(
          "The demo API listen host must be an exact loopback IP literal.",
        );
      }
    }
  });

  it("accepts only canonical decimal ports from 1 through 65535", () => {
    for (const [raw, expected] of [
      ["1", 1],
      ["3100", 3100],
      ["65535", 65_535],
    ] as const) {
      expect(resolveDemoApiListenOptions({ PORT: raw })).toEqual({
        host: "127.0.0.1",
        port: expected,
      });
    }

    for (const port of [
      "",
      "0",
      "00",
      "01",
      "03100",
      "65536",
      "99999",
      "-1",
      "+1",
      "1.0",
      "1e3",
      " 3100",
      "3100 ",
      "NaN",
      "Infinity",
    ]) {
      try {
        resolveDemoApiListenOptions({ PORT: port });
        throw new Error("Expected the invalid port to be rejected.");
      } catch (error) {
        expect(error).toBeInstanceOf(DemoApiListenOptionsError);
        expect(error).toMatchObject({
          code: "INVALID_DEMO_API_LISTEN_PORT",
        });
        expect((error as Error).message).toBe(
          "The demo API listen port must be a decimal integer from 1 through 65535.",
        );
      }
    }
  });
});
