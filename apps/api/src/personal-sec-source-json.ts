import {
  assertPersonalSecJsonUniqueKeys,
  PersonalSecJsonSyntaxError,
  type AcquisitionReason,
} from "@research-cockpit/contracts";
import { parsePersonalSecSourceJson } from "./personal-sec-quarterly-evidence-provider";

export class PersonalSecQuarterSourceProjectionError extends Error {
  public constructor(public readonly code: AcquisitionReason) {
    super(code);
    this.name = "PersonalSecQuarterSourceProjectionError";
  }
}

export function parsePersonalSecSourceJsonStrict(text: string): unknown {
  try {
    assertPersonalSecJsonUniqueKeys(text);
    return parsePersonalSecSourceJson(text);
  } catch (error) {
    throw new PersonalSecQuarterSourceProjectionError(
      error instanceof PersonalSecJsonSyntaxError &&
        error.code !== "invalid_json"
        ? error.code
        : "invalid_response",
    );
  }
}
