const SAFE_DATABASE_CONTEXT = {
  CI_E2E_LOCAL: "ci-e2e-local",
  LOCAL_DEV: "local-dev",
} as const;

const LOOPBACK_DATABASE_HOST = {
  IPV4: "127.0.0.1",
  IPV6: "::1",
  LOCALHOST: "localhost",
} as const;

const DANGEROUS_DATABASE_NAME_TOKEN = {
  LIVE: "live",
  PRIMARY: "primary",
  PROD: "prod",
  PRODUCTION: "production",
  STAGING: "staging",
} as const;

type SafeDatabaseContext =
  (typeof SAFE_DATABASE_CONTEXT)[keyof typeof SAFE_DATABASE_CONTEXT];

type EnvironmentVariables = Record<string, string | undefined>;

interface DatabaseSafetyReport {
  context: string;
  databaseName: string;
  hasDestructiveConsent: boolean;
  hasSafeContext: boolean;
  hostname: string;
  isLoopbackHost: boolean;
  looksProductionLike: boolean;
}

interface DatabaseSafetyOptions {
  operation: string;
  requireExplicitSignals: boolean;
}

const loopbackHosts = new Set<string>(Object.values(LOOPBACK_DATABASE_HOST));
const safeContexts = new Set<string>(Object.values(SAFE_DATABASE_CONTEXT));
const dangerousDatabaseNameTokens = Object.values(DANGEROUS_DATABASE_NAME_TOKEN);

function parseDatabaseUrl(databaseUrl: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("Invalid Postgres connection string in DATABASE_URL");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("DATABASE_URL must use a postgres:// or postgresql:// scheme");
  }

  return parsedUrl;
}

function getDatabaseName(parsedUrl: URL): string {
  return decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "");
}

function normalizeContext(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function createSafetyReport(
  databaseUrl: string,
  env: EnvironmentVariables
): DatabaseSafetyReport {
  const parsedUrl = parseDatabaseUrl(databaseUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  const databaseName = getDatabaseName(parsedUrl).toLowerCase();
  const context = normalizeContext(env["ROLLORIAN_DB_CONTEXT"]);

  return {
    context,
    databaseName,
    hasDestructiveConsent:
      env["ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS"] === "true",
    hasSafeContext: safeContexts.has(context as SafeDatabaseContext),
    hostname,
    isLoopbackHost: loopbackHosts.has(hostname),
    looksProductionLike: dangerousDatabaseNameTokens.some((token) =>
      databaseName.includes(token)
    ),
  };
}

function createSafetyError(
  report: DatabaseSafetyReport,
  options: DatabaseSafetyOptions
): Error {
  const reasons: string[] = [];

  if (!report.isLoopbackHost) {
    reasons.push(`host \`${report.hostname}\` is not local/loopback`);
  }

  if (report.looksProductionLike) {
    reasons.push(
      `database name \`${report.databaseName}\` looks production-like`
    );
  }

  if (options.requireExplicitSignals) {
    if (!report.hasSafeContext) {
      reasons.push(
        "explicit safe context missing (`ROLLORIAN_DB_CONTEXT=ci-e2e-local` or `local-dev`)"
      );
    }

    if (!report.hasDestructiveConsent) {
      reasons.push(
        "explicit destructive consent missing (`ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS=true`)"
      );
    }
  }

  return new Error(
    `Refusing to ${options.operation}: ${reasons.join("; ")}.`
  );
}

function assertDatabaseSafety(
  databaseUrl: string,
  env: EnvironmentVariables,
  options: DatabaseSafetyOptions
) {
  const report = createSafetyReport(databaseUrl, env);
  const isSafe =
    report.isLoopbackHost &&
    !report.looksProductionLike &&
    (!options.requireExplicitSignals ||
      (report.hasSafeContext && report.hasDestructiveConsent));

  if (!isSafe) {
    throw createSafetyError(report, options);
  }
}

export function assertSafeCiDatabaseUrl(
  databaseUrl: string,
  env: EnvironmentVariables = process.env
) {
  assertDatabaseSafety(databaseUrl, env, {
    operation: "use this database in CI/E2E",
    requireExplicitSignals: false,
  });
}

export function assertSafeSeedEnvironment(
  databaseUrl: string,
  env: EnvironmentVariables = process.env
) {
  assertDatabaseSafety(databaseUrl, env, {
    operation: "run destructive seed commands",
    requireExplicitSignals: true,
  });
}
