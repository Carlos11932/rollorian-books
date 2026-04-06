import { describe, it, expect, vi, beforeEach } from "vitest";

const { revalidatePathMock } = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userBook: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateBookCollectionPaths: () => {
    revalidatePathMock("/library");
  },
}));

import { PATCH } from "../route";
import { prisma } from "@/lib/prisma";

const mockUpdateMany = prisma.userBook.updateMany as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/books/batch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/books/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when bookIds is empty", async () => {
    const res = await PATCH(makeRequest({ bookIds: [], status: "READ" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    const res = await PATCH(makeRequest({ bookIds: ["id1"], status: "INVALID" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing fields", async () => {
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 and updates books for valid request", async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id2", "id3"],
      status: "READ",
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(3);
    expect(body.status).toBe("READ");
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "READ" }),
      }),
    );
  });

  it("sets finishedAt when status is READ", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await PATCH(makeRequest({ bookIds: ["id1"], status: "READ" }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "READ",
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does NOT set finishedAt for non-READ statuses", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await PATCH(makeRequest({ bookIds: ["id1"], status: "READING" }));

    const callData = mockUpdateMany.mock.calls[0]?.[0]?.data;
    expect(callData?.finishedAt).toBeUndefined();
  });
});
