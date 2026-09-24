import { describe, expect, it } from "vitest";
import {
  assertPersonalSecJsonUniqueKeys,
  PersonalSecJsonSyntaxError,
} from "./personal-sec-source-json";

describe("strict SEC JSON key preflight", () => {
  it.each([
    '{"a":1,"a":2}',
    '{"name":1,"\\u006eame":2}',
    '{"outer":[{"a":1,"a":2}]}',
    '{"__proto__":1,"__proto__":2}',
    '{"😀":1,"\\ud83d\\ude00":2}',
  ])("refuses duplicate decoded keys in %s", (text) => {
    expect(() => assertPersonalSecJsonUniqueKeys(text)).toThrowError(
      new PersonalSecJsonSyntaxError("duplicate_json_key"),
    );
  });
  it.each([
    '{"a":1,"b":{"a":2},"c":[{"a":3},{"a":4}]}',
    JSON.stringify({
      '"key': "commas, {[]}: and escaped " + String.fromCharCode(92),
    }),
    '{"__proto__":{"constructor":true},"n":123456789012345678901234567890e-4}',
    ' [null,true,false,-0,0.25,1e400,"\\u0000"] ',
  ])("preserves valid syntax without numeric coercion: %s", (text) => {
    expect(() => assertPersonalSecJsonUniqueKeys(text)).not.toThrow();
  });
  it.each([
    "",
    " ",
    "[1,]",
    '{"a":1,}',
    "[01]",
    "[.1]",
    "[1.]",
    "[1e]",
    "true false",
    '{"a" 1}',
    '{"x":"\\x"}',
    '{"x":"\n"}',
    '{"x":"\\u123"}',
    "[undefined]",
  ])("refuses malformed JSON %j", (text) => {
    expect(() => assertPersonalSecJsonUniqueKeys(text)).toThrow(
      PersonalSecJsonSyntaxError,
    );
  });
  it("accepts 256 nested containers and refuses the 257th", () => {
    expect(() =>
      assertPersonalSecJsonUniqueKeys("[".repeat(256) + "0" + "]".repeat(256)),
    ).not.toThrow();
    expect(() =>
      assertPersonalSecJsonUniqueKeys("[".repeat(257) + "0" + "]".repeat(257)),
    ).toThrowError(new PersonalSecJsonSyntaxError("json_depth_limit"));
  });
});
