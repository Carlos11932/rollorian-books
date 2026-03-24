// Global test setup for Vitest
// Runs before each test file

// Mock `server-only` so files importing it don't throw in the test environment
vi.mock("server-only", () => ({}));
