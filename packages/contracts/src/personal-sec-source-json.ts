export type PersonalSecJsonIssue =
  "invalid_json" | "duplicate_json_key" | "json_depth_limit";

export class PersonalSecJsonSyntaxError extends Error {
  public constructor(public readonly code: PersonalSecJsonIssue) {
    super(code);
    this.name = "PersonalSecJsonSyntaxError";
  }
}

/** Call after the applicable UTF-8 byte check, before any JSON decoder. */
export function assertPersonalSecJsonUniqueKeys(text: string): void {
  if (typeof text !== "string") fail("invalid_json");
  type Frame = {
    kind: "root" | "object" | "array";
    state: "value" | "done" | "first" | "key" | "colon" | "after";
    keys: Set<string> | null;
  };
  const stack: Frame[] = [{ kind: "root", state: "value", keys: null }];
  const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  let offset = 0;
  const whitespace = () => {
    while (/[\x20\t\r\n]/u.test(text[offset] ?? "x")) offset += 1;
  };
  const string = (decode: boolean): string => {
    const start = offset;
    if (text[offset++] !== '"') fail("invalid_json");
    while (offset < text.length) {
      const character = text[offset++]!;
      if (character === '"') {
        if (!decode) return "";
        try {
          return JSON.parse(text.slice(start, offset)) as string;
        } catch {
          return fail("invalid_json");
        }
      }
      if (character.charCodeAt(0) < 32) fail("invalid_json");
      if (character === "\\") {
        const escaped = text[offset++];
        if (escaped === "u") {
          const digits = text.slice(offset, offset + 4);
          if (!/^[0-9a-fA-F]{4}$/u.test(digits)) fail("invalid_json");
          offset += 4;
        } else if (escaped === undefined || !'"\\/bfnrt'.includes(escaped)) {
          fail("invalid_json");
        }
      }
    }
    return fail("invalid_json");
  };
  const value = (frame: Frame) => {
    frame.state = frame.kind === "root" ? "done" : "after";
    const character = text[offset];
    if (character === "{" || character === "[") {
      if (stack.length > 256) fail("json_depth_limit");
      offset += 1;
      stack.push({
        kind: character === "{" ? "object" : "array",
        state: "first",
        keys: character === "{" ? new Set<string>() : null,
      });
    } else if (character === '"') {
      string(false);
    } else if (text.startsWith("true", offset)) offset += 4;
    else if (text.startsWith("false", offset)) offset += 5;
    else if (text.startsWith("null", offset)) offset += 4;
    else {
      number.lastIndex = offset;
      const match = number.exec(text);
      if (match === null) fail("invalid_json");
      offset = number.lastIndex;
    }
  };
  while (stack.length > 0) {
    whitespace();
    const frame = stack[stack.length - 1]!;
    if (frame.kind === "root" && frame.state === "done") {
      if (offset !== text.length) fail("invalid_json");
      stack.pop();
    } else if (frame.state === "value") value(frame);
    else if (frame.kind === "object") {
      if (frame.state === "first" && text[offset] === "}") {
        offset += 1;
        stack.pop();
      } else if (frame.state === "first" || frame.state === "key") {
        const key = string(true);
        if (frame.keys!.has(key)) fail("duplicate_json_key");
        frame.keys!.add(key);
        frame.state = "colon";
      } else if (frame.state === "colon") {
        if (text[offset++] !== ":") fail("invalid_json");
        frame.state = "value";
      } else if (text[offset] === "}") {
        offset += 1;
        stack.pop();
      } else if (text[offset++] === ",") frame.state = "key";
      else fail("invalid_json");
    } else if (frame.state === "first" && text[offset] === "]") {
      offset += 1;
      stack.pop();
    } else if (frame.state === "first") value(frame);
    else if (text[offset] === "]") {
      offset += 1;
      stack.pop();
    } else if (text[offset++] === ",") frame.state = "value";
    else fail("invalid_json");
  }
}

function fail(code: PersonalSecJsonIssue): never {
  throw new PersonalSecJsonSyntaxError(code);
}
