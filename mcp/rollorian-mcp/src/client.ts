import { randomUUID } from "node:crypto";

type AgentBookRef = {
  bookId?: string;
  isbn10?: string;
  isbn13?: string;
  title?: string;
  authors?: string[];
};

type ReadingEventPayload = {
  title?: string;
  subtitle?: string;
  authors?: string[];
  description?: string;
  coverUrl?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  isbn10?: string;
  isbn13?: string;
  genres?: string[];
  rating?: number;
  notes?: string;
  occurredAt?: string;
};

export type ApplyReadingEventInput = {
  event: "wishlisted" | "started" | "finished" | "paused" | "abandoned" | "rated" | "noted" | "restarted";
  bookRef: AgentBookRef;
  payload?: ReadingEventPayload;
  channel?: string;
  idempotencyKey?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export class RollorianAgentClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(options?: { baseUrl?: string; token?: string }) {
    this.baseUrl = (options?.baseUrl ?? requireEnv("ROLLORIAN_BASE_URL")).replace(/\/$/, "");
    this.token = options?.token ?? requireEnv("ROLLORIAN_AGENT_TOKEN");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = typeof body === "object" && body && "error" in body ? String(body.error) : `HTTP ${response.status}`;
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  getProfile() {
    return this.request("/api/agent/v1/me");
  }

  getSummary() {
    return this.request("/api/agent/v1/summary");
  }

  getLibrarySnapshot() {
    return this.request("/api/agent/v1/library");
  }

  listLists() {
    return this.request("/api/agent/v1/lists");
  }

  getRecommendations() {
    return this.request("/api/agent/v1/recommendations");
  }

  resolveBook(bookRef: AgentBookRef) {
    return this.request("/api/agent/v1/books/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bookRef }),
    });
  }

  applyReadingEvent(input: ApplyReadingEventInput) {
    return this.request("/api/agent/v1/reading-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey ?? randomUUID(),
      },
      body: JSON.stringify({
        event: input.event,
        bookRef: input.bookRef,
        payload: input.payload ?? {},
        source: {
          channel: input.channel ?? "mcp",
        },
      }),
    });
  }
}

