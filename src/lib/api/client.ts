/**
 * Shared API client utilities for client-side fetch calls.
 *
 * All feature-specific API modules (books, lists, etc.) should import
 * from here instead of defining their own ApiError and apiFetch.
 */

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  // 204 No Content — return undefined cast to T (callers that use void are safe)
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
