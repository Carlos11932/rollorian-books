import {
  assertSafeCiDatabaseUrl,
  assertSafeSeedEnvironment,
} from "../src/lib/database-safety";

const DATABASE_VARIABLE = {
  DATABASE_URL: "DATABASE_URL",
  DIRECT_URL: "DIRECT_URL",
} as const;

type DatabaseVariableName =
  (typeof DATABASE_VARIABLE)[keyof typeof DATABASE_VARIABLE];

interface ScriptOptions {
  requireDestructiveSignals: boolean;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getRequiredConnectionString(variableName: DatabaseVariableName): string {
  const value = process.env[variableName];

  if (!value) {
    throw new Error(`${variableName} environment variable is not set`);
  }

  return value;
}

function verifyConnectionString(
  variableName: DatabaseVariableName,
  connectionString: string,
  options: ScriptOptions
) {
  assertSafeCiDatabaseUrl(connectionString);

  if (options.requireDestructiveSignals) {
    assertSafeSeedEnvironment(connectionString);
  }

  process.stdout.write(`Database guard passed for ${variableName}\n`);
}

function main() {
  const options: ScriptOptions = {
    requireDestructiveSignals: hasFlag("--require-destructive-signals"),
  };

  const databaseUrl = getRequiredConnectionString(DATABASE_VARIABLE.DATABASE_URL);
  verifyConnectionString(
    DATABASE_VARIABLE.DATABASE_URL,
    databaseUrl,
    options
  );

  const directUrl = process.env[DATABASE_VARIABLE.DIRECT_URL];

  if (!directUrl) {
    return;
  }

  verifyConnectionString(DATABASE_VARIABLE.DIRECT_URL, directUrl, options);
}

main();
