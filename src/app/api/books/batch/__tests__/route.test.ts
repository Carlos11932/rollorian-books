import { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  revalidatePathMock,
  isRetryableUserBookCompatErrorMock,
  userBookFindUniqueMock,
  userBookUpdateManyMock,
  transactionMock,
} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  isRetryableUserBookCompatErrorMock: vi.fn(),
  userBookFindUniqueMock: vi.fn(),
  userBookUpdateManyMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    userBook: {
      findUnique: userBookFindUniqueMock,
      updateMany: userBookUpdateManyMock,
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

vi.mock("@/lib/prisma-schema-compat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prisma-schema-compat")>("@/lib/prisma-schema-compat");
  return {
    ...actual,
    isRetryableUserBookCompatError: isRetryableUserBookCompatErrorMock,
  };
});

import { PATCH } from "../route";
import { prisma } from "@/lib/prisma";
import { LibraryEntryWriteConflictError } from "@/lib/books/update-library-entry";

const mockFindUnique = prisma.userBook.findUnique as ReturnType<typeof vi.fn>;
const mockUpdateMany = prisma.userBook.updateMany as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/books/batch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMalformedJsonRequest(): Request {
  return new Request("http://localhost/api/books/batch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
}

describe("PATCH /api/books/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRetryableUserBookCompatErrorMock.mockReturnValue(false);
    mockTransaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
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

  it("returns 400 when the JSON body is malformed", async () => {
    const res = await PATCH(makeMalformedJsonRequest());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request" });
  });

  it("returns 200 and updates books for valid READ requests", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "READING" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id2", "id3"],
      status: "READ",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ updated: 3, status: "READ" });
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ bookId: "id1", status: "READ" }),
        data: { status: "READ" },
      }),
    );
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ bookId: "id2", status: "TO_READ" }),
        data: expect.objectContaining({ status: "READ", finishedAt: expect.any(Date) }),
      }),
    );
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({ bookId: "id3", status: "READING" }),
        data: expect.objectContaining({ status: "READ", finishedAt: expect.any(Date) }),
      }),
    );
  });

  it("sets finishedAt when status is READ", async () => {
    mockFindUnique.mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    await PATCH(makeRequest({ bookIds: ["id1"], status: "READ" }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "TO_READ" }),
        data: expect.objectContaining({
          status: "READ",
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("clears finishedAt for non-READ statuses", async () => {
    mockFindUnique.mockResolvedValueOnce({ status: "READ" });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await PATCH(makeRequest({ bookIds: ["id1"], status: "READING" }));

    const callData = mockUpdateMany.mock.calls[0]?.[0]?.data;
    expect(callData?.finishedAt).toBeNull();
  });

  it("does not overwrite finishedAt for rows already marked READ", async () => {
    mockFindUnique.mockResolvedValueOnce({ status: "READ" });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    await PATCH(makeRequest({ bookIds: ["id1"], status: "READ" }));

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "READ" }),
        data: { status: "READ" },
      }),
    );
  });

  it("retries a READ batch row when its status changes after the decision read", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "READING" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({ bookIds: ["id1"], status: "READ", ownershipStatus: "OWNED" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      updated: 1,
      status: "READ",
      ownershipStatus: "OWNED",
    });
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: "READ" }),
        data: { status: "READ", ownershipStatus: "OWNED" },
      }),
    );
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: "READING" }),
        data: expect.objectContaining({
          status: "READ",
          ownershipStatus: "OWNED",
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("fails explicitly when a mixed READ batch update cannot persist ownershipStatus", async () => {
    isRetryableUserBookCompatErrorMock.mockImplementation(
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError,
    );
    mockFindUnique.mockResolvedValueOnce({ status: "READ" });
    mockUpdateMany.mockRejectedValueOnce(
      makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"),
    );

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id2"],
      status: "READ",
      ownershipStatus: "OWNED",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Ownership status updates require a database schema that includes ownershipStatus",
      code: "OWNERSHIP_STATUS_UNSUPPORTED",
    });
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("retries without finishedAt when the column is unavailable", async () => {
    isRetryableUserBookCompatErrorMock.mockReturnValue(true);
    mockFindUnique
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `finishedAt` does not exist"))
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id2"],
      status: "READ",
      ownershipStatus: "OWNED",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      updated: 2,
      status: "READ",
      ownershipStatus: "OWNED",
    });
    expect(mockUpdateMany).toHaveBeenCalledTimes(4);
    expect(mockUpdateMany.mock.calls[2]?.[0]?.data).toEqual({
      status: "READ",
      ownershipStatus: "OWNED",
    });
    expect(mockUpdateMany.mock.calls[3]?.[0]?.data).toEqual({
      status: "READ",
      ownershipStatus: "OWNED",
    });
  });

  it("keeps ownershipStatus when generic compat failures only require dropping finishedAt", async () => {
    isRetryableUserBookCompatErrorMock.mockReturnValue(true);
    mockFindUnique
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `(not available)` does not exist"))
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id2"],
      status: "READ",
      ownershipStatus: "OWNED",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      updated: 2,
      status: "READ",
      ownershipStatus: "OWNED",
    });
    expect(mockUpdateMany.mock.calls[2]?.[0]?.data).toEqual({
      status: "READ",
      ownershipStatus: "OWNED",
    });
    expect(mockUpdateMany.mock.calls[3]?.[0]?.data).toEqual({
      status: "READ",
      ownershipStatus: "OWNED",
    });
  });

  it("retries non-READ batch updates without finishedAt when the column is unavailable", async () => {
    isRetryableUserBookCompatErrorMock.mockReturnValue(true);
    mockFindUnique
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany
      .mockRejectedValueOnce(makeKnownRequestError("P2022", "The column `finishedAt` does not exist"))
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      status: "READING",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      updated: 1,
      status: "READING",
    });
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany.mock.calls[0]?.[0]?.data).toEqual({
      status: "READING",
      finishedAt: null,
    });
    expect(mockUpdateMany.mock.calls[1]?.[0]?.data).toEqual({
      status: "READING",
    });
  });

  it("fails explicitly when an ownership-only batch update cannot be persisted on a lagging schema", async () => {
    isRetryableUserBookCompatErrorMock.mockReturnValue(true);
    mockFindUnique.mockResolvedValueOnce({ status: "TO_READ", ownershipStatus: "UNKNOWN" });
    mockUpdateMany.mockRejectedValueOnce(
      makeKnownRequestError("P2022", "The column `ownershipStatus` does not exist"),
    );

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id2"],
      ownershipStatus: "OWNED",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "Ownership status updates require a database schema that includes ownershipStatus",
      code: "OWNERSHIP_STATUS_UNSUPPORTED",
    });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("retries ownership-only batch rows when ownership changes after the snapshot read", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ status: "TO_READ", ownershipStatus: "UNKNOWN" })
      .mockResolvedValueOnce({ status: "TO_READ", ownershipStatus: "NOT_OWNED" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      ownershipStatus: "OWNED",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      updated: 1,
      ownershipStatus: "OWNED",
    });
    expect(mockTransaction).toHaveBeenCalledTimes(2);
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: "TO_READ", ownershipStatus: "UNKNOWN" }),
        data: { ownershipStatus: "OWNED" },
      }),
    );
    expect(mockUpdateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: "TO_READ", ownershipStatus: "NOT_OWNED" }),
        data: { ownershipStatus: "OWNED" },
      }),
    );
  });

  it("maps repeated ownership-only batch transaction conflicts to 409", async () => {
    mockTransaction.mockRejectedValue(makeKnownRequestError("P2034", "Transaction failed due to a write conflict"));

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      ownershipStatus: "OWNED",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: new LibraryEntryWriteConflictError().message,
      code: "CONCURRENT_UPDATE_CONFLICT",
    });
  });

  it("returns 409 when a READ batch row exhausts guarded retries", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "READING" })
      .mockResolvedValueOnce({ status: "WISHLIST" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      status: "READ",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: new LibraryEntryWriteConflictError().message,
      code: "CONCURRENT_UPDATE_CONFLICT",
    });
  });

  it("deduplicates READ batch ids before processing and counting", async () => {
    mockFindUnique.mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1", "id1"],
      status: "READ",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ updated: 1, status: "READ" });
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("processes READ batch ids in sorted deterministic order", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id2", "id1", "id1"],
      status: "READ",
    }));

    expect(res.status).toBe(200);
    expect(mockFindUnique.mock.calls[0]?.[0]?.where).toEqual({ userId_bookId: { userId: "test-user-001", bookId: "id1" } });
    expect(mockFindUnique.mock.calls[1]?.[0]?.where).toEqual({ userId_bookId: { userId: "test-user-001", bookId: "id2" } });
  });

  it("retries READ batch transactions after a serializable write conflict", async () => {
    mockTransaction
      .mockRejectedValueOnce(makeKnownRequestError("P2034", "Transaction failed due to a write conflict"))
      .mockImplementationOnce(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
    mockFindUnique.mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      status: "READ",
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ updated: 1, status: "READ" });
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it("maps repeated READ batch transaction conflicts to 409", async () => {
    mockTransaction.mockRejectedValue(makeKnownRequestError("P2034", "Transaction failed due to a write conflict"));

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      status: "READ",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: new LibraryEntryWriteConflictError().message,
      code: "CONCURRENT_UPDATE_CONFLICT",
    });
  });

  it("returns 409 when a non-READ status batch row exhausts guarded retries", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ status: "TO_READ" })
      .mockResolvedValueOnce({ status: "READ" })
      .mockResolvedValueOnce({ status: "WISHLIST" })
      .mockResolvedValueOnce({ status: "TO_READ" });
    mockUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    const res = await PATCH(makeRequest({
      bookIds: ["id1"],
      status: "READING",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: new LibraryEntryWriteConflictError().message,
      code: "CONCURRENT_UPDATE_CONFLICT",
    });
  });
});

function makeKnownRequestError(code: string, message: string): Prisma.PrismaClientKnownRequestError {
  const error = new Error(message) as Prisma.PrismaClientKnownRequestError;
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  Object.assign(error, {
    code,
    clientVersion: "test",
    meta: {},
    batchRequestIdx: 0,
  });
  return error;
}
