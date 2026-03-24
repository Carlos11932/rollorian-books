// Global test setup for Vitest
// Runs before each test file

// Mock `server-only` so files importing it don't throw in the test environment
vi.mock("server-only", () => ({}));

// Mock `next/cache` so revalidatePath/revalidateTag don't throw outside Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
