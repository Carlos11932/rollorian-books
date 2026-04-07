import "server-only";

// ---------------------------------------------------------------------------
// Structured logger — lightweight, no external dependencies
// ---------------------------------------------------------------------------
// Production: JSON output (structured, machine-readable)
// Development: human-readable with color hints
// ---------------------------------------------------------------------------

export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  [key: string]: unknown;
}

type LogLevel = "info" | "warn" | "error";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function buildEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): string {
  const errorFields =
    error instanceof Error
      ? { errorMessage: error.message, stack: error.stack }
      : error !== undefined
        ? { errorRaw: String(error) }
        : undefined;

  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
    ...(errorFields ? { error: errorFields } : {}),
  });
}

function devLabel(level: LogLevel): string {
  const labels: Record<LogLevel, string> = {
    info: "[INFO]",
    warn: "[WARN]",
    error: "[ERROR]",
  };
  return labels[level];
}

function serializeDevParts(message: string, context?: LogContext, error?: unknown): string {
  const parts = [message];

  if (error !== undefined) {
    parts.push(error instanceof Error ? error.stack ?? error.message : String(error));
  }

  if (context && Object.keys(context).length > 0) {
    parts.push(JSON.stringify(context));
  }

  return parts.join(" ");
}

export const logger = {
  info(message: string, context?: LogContext): void {
    if (IS_PRODUCTION) {
      process.stdout.write(`${buildEntry("info", message, context)}\n`);
    } else {
      process.stdout.write(`${devLabel("info")} ${serializeDevParts(message, context)}\n`);
    }
  },

  warn(message: string, context?: LogContext): void {
    if (IS_PRODUCTION) {
      console.warn(buildEntry("warn", message, context));
    } else {
      console.warn(`${devLabel("warn")} ${message}`, context ?? "");
    }
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (IS_PRODUCTION) {
      console.error(buildEntry("error", message, context, error));
    } else {
      console.error(`${devLabel("error")} ${serializeDevParts(message, context, error)}`);
    }
  },
};
