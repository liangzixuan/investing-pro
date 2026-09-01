import { randomBytes } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { PersonalOwnerSessionAuthority } from "./personal-owner-session";
import {
  PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME,
  PERSONAL_OWNER_INTENT_HEADER_NAME,
  PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
} from "./personal-owner-session-routes";

export interface TestPersonalOwnerSession {
  readonly authority: PersonalOwnerSessionAuthority;
  readonly secret: string;
}

export function createTestPersonalOwnerSession(): TestPersonalOwnerSession {
  const secret = randomBytes(32).toString("hex");
  return {
    authority: PersonalOwnerSessionAuthority.create(secret),
    secret,
  };
}

export async function bootstrapTestPersonalOwnerSession(
  app: FastifyInstance,
  secret: string,
  host = "127.0.0.1:3100",
  origin = "http://127.0.0.1:3000",
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH,
    headers: {
      accept: "application/json",
      host,
      origin,
      [PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME]: secret,
      [PERSONAL_OWNER_INTENT_HEADER_NAME]: "bootstrap",
    },
    remoteAddress: host.startsWith("[") ? "::1" : "127.0.0.1",
  });
  if (response.statusCode !== 204) {
    throw new Error("Test owner-session bootstrap failed.");
  }
  const setCookie = response.headers["set-cookie"];
  const serialized = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = serialized?.split(";", 1)[0];
  if (cookie === undefined) {
    throw new Error("Test owner-session cookie is unavailable.");
  }
  return cookie;
}

export async function bootstrapLiveTestPersonalOwnerSession(
  apiOrigin: string,
  secret: string,
  browserOrigin = "http://127.0.0.1:3000",
): Promise<string> {
  const response = await fetch(
    new URL(PERSONAL_OWNER_SESSION_BOOTSTRAP_PATH, apiOrigin),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Origin: browserOrigin,
        [PERSONAL_OWNER_BOOTSTRAP_HEADER_NAME]: secret,
        [PERSONAL_OWNER_INTENT_HEADER_NAME]: "bootstrap",
      },
      redirect: "error",
    },
  );
  if (response.status !== 204) {
    throw new Error("Live test owner-session bootstrap failed.");
  }
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (cookie === undefined) {
    throw new Error("Live test owner-session cookie is unavailable.");
  }
  return cookie;
}
