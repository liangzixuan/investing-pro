import { describe, expect, it } from "vitest";

import {
  resolveCleanBuildSourceIdentity,
  type BuildSourceIdentityReader,
} from "./build-source-identity";

const COMMIT = "a".repeat(40);

describe("API build source identity", () => {
  it("returns the exact commit only across two clean source checks", () => {
    const calls: string[] = [];
    const reader: BuildSourceIdentityReader = {
      readHead(directory) {
        calls.push(`head:${directory}`);
        return COMMIT;
      },
      readStatus(directory) {
        calls.push(`status:${directory}`);
        return "";
      },
    };

    expect(resolveCleanBuildSourceIdentity("public-repository", reader)).toBe(
      COMMIT,
    );
    expect(calls).toEqual([
      "status:public-repository",
      "head:public-repository",
      "status:public-repository",
    ]);
  });

  it.each([" M apps/api/src/server.ts", "?? public-untracked-build-input.txt"])(
    "fails closed for dirty status %s",
    (status) => {
      let headRead = false;
      const reader: BuildSourceIdentityReader = {
        readHead() {
          headRead = true;
          return COMMIT;
        },
        readStatus() {
          return status;
        },
      };

      expect(() =>
        resolveCleanBuildSourceIdentity("public-repository", reader),
      ).toThrow("The API build source identity is unavailable.");
      expect(headRead).toBe(false);
    },
  );

  it("fails closed if the source becomes dirty after HEAD is read", () => {
    let statusRead = 0;
    const reader: BuildSourceIdentityReader = {
      readHead: () => COMMIT,
      readStatus() {
        statusRead += 1;
        return statusRead === 1 ? "" : "?? public-race.txt";
      },
    };

    expect(() =>
      resolveCleanBuildSourceIdentity("public-repository", reader),
    ).toThrow("The API build source identity is unavailable.");
  });
});
