export class ResearchStateError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "VERSION_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "INVALID_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "ResearchStateError";
  }
}

export function forbidden(): ResearchStateError {
  return new ResearchStateError(
    "FORBIDDEN",
    "The actor is not authorized for this operation.",
  );
}

export function notFound(resource: "thesis" | "alert"): ResearchStateError {
  return new ResearchStateError(
    "NOT_FOUND",
    `${resource} was not found in the active organization.`,
  );
}

export function versionConflict(): ResearchStateError {
  return new ResearchStateError(
    "VERSION_CONFLICT",
    "The resource changed after the caller's expected version.",
  );
}

export function idempotencyConflict(): ResearchStateError {
  return new ResearchStateError(
    "IDEMPOTENCY_CONFLICT",
    "The idempotency key was already used for a different request.",
  );
}

export function invalidInput(message: string): ResearchStateError {
  return new ResearchStateError("INVALID_INPUT", message);
}
