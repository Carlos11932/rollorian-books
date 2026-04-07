export class AgentAuthError extends Error {
  status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AgentAuthError";
  }
}

export class AgentScopeError extends Error {
  status = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "AgentScopeError";
  }
}

export class AgentInputError extends Error {
  status = 400;

  constructor(message = "Invalid request") {
    super(message);
    this.name = "AgentInputError";
  }
}

export class AgentConflictError extends Error {
  status = 409;

  constructor(message = "Conflict") {
    super(message);
    this.name = "AgentConflictError";
  }
}

export class AgentNotFoundError extends Error {
  status = 404;

  constructor(message = "Not found") {
    super(message);
    this.name = "AgentNotFoundError";
  }
}

export class AgentRateLimitError extends Error {
  status = 429;

  constructor(message = "Too many requests") {
    super(message);
    this.name = "AgentRateLimitError";
  }
}

export function getErrorStatus(error: unknown): number {
  return error instanceof Error && "status" in error && typeof error.status === "number"
    ? error.status
    : 500;
}

export function getPublicErrorMessage(error: unknown): string {
  if (error instanceof Error && "status" in error && typeof error.status === "number") {
    return error.message;
  }

  return "Internal server error";
}

