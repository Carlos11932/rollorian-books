// Global test setup for Vitest
// Runs before each test file

// Mock `server-only` so files importing it don't throw in the test environment
vi.mock("server-only", () => ({}));

// Mock `next/cache` so revalidatePath/revalidateTag don't throw outside Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock `@/lib/auth/require-auth` so all route handlers receive an authenticated
// user in tests without needing a real session or database.
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user-001" }),
  UnauthorizedError: class UnauthorizedError extends Error {
    status = 401;
    constructor(msg = "Unauthorized") {
      super(msg);
      this.name = "UnauthorizedError";
    }
  },
}));
