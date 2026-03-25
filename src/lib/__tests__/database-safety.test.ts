import {
  assertSafeCiDatabaseUrl,
  assertSafeSeedEnvironment,
} from "@/lib/database-safety";

describe("database safety guardrails", () => {
  it("accepts a loopback Postgres URL for CI", () => {
    expect(() => {
      assertSafeCiDatabaseUrl(
        "postgresql://postgres:postgres@127.0.0.1:5432/rollorian_books_ci"
      );
    }).not.toThrow();
  });

  it("rejects non-local Postgres URLs for CI", () => {
    expect(() => {
      assertSafeCiDatabaseUrl(
        "postgresql://user:password@prod.db.example.com:5432/rollorian_books"
      );
    }).toThrow(/local/i);
  });

  it("rejects destructive seed runs without explicit safety signals", () => {
    expect(() => {
      assertSafeSeedEnvironment(
        "postgresql://postgres:postgres@localhost:5432/rollorian_books_ci",
        {}
      );
    }).toThrow(/explicit/i);
  });

  it("rejects destructive seed runs against production-looking databases", () => {
    expect(() => {
      assertSafeSeedEnvironment(
        "postgresql://postgres:postgres@127.0.0.1:5432/rollorian_books_production",
        {
          ROLLORIAN_DB_CONTEXT: "ci-e2e-local",
          ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS: "true",
        }
      );
    }).toThrow(/production/i);
  });

  it("allows destructive seed runs only with explicit safe signals", () => {
    expect(() => {
      assertSafeSeedEnvironment(
        "postgresql://postgres:postgres@localhost:5432/rollorian_books_ci",
        {
          ROLLORIAN_DB_CONTEXT: "ci-e2e-local",
          ROLLORIAN_ALLOW_DESTRUCTIVE_DB_ACTIONS: "true",
        }
      );
    }).not.toThrow();
  });
});
