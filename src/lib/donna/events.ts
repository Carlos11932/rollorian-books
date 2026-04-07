import "server-only";

import { type DonnaSemanticState as PrismaDonnaSemanticState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { USER_BOOK_SELECT } from "@/lib/books/user-book-select";
import { isMissingDonnaStateSchemaError } from "@/lib/prisma-schema-compat";
import type { DonnaSemanticState, ReadingEventRequest } from "./contracts";
import { normalizeBook, getSemanticState, type SelectedUserBook } from "./normalize";
import { resolveOrCreateBook } from "./resolve";
import { getDonnaUserContext } from "./user";

const SEMANTIC_TO_STATUS: Record<DonnaSemanticState, "WISHLIST" | "TO_READ" | "READING" | "REREADING" | "READ" | "ON_HOLD"> = {
  wishlist: "WISHLIST",
  to_read: "TO_READ",
  reading: "READING",
  rereading: "REREADING",
  read: "READ",
  paused: "ON_HOLD",
  abandoned: "ON_HOLD",
};

export function getEventTimestamp(payload: ReadingEventRequest["payload"]): Date {
  if (!payload.occurredAt) {
    return new Date();
  }

  const parsed = new Date(payload.occurredAt);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

export function nextSemanticState(
  event: ReadingEventRequest["event"],
  currentStatus?: SelectedUserBook["status"],
): DonnaSemanticState | null {
  switch (event) {
    case "wishlisted":
      return "wishlist";
    case "started":
      return currentStatus === "READ" ? "rereading" : "reading";
    case "restarted":
      return "rereading";
    case "finished":
      return "read";
    case "paused":
      return "paused";
    case "abandoned":
      return "abandoned";
    case "rated":
    case "noted":
      return null;
    default:
      return null;
  }
}

export async function upsertDonnaState(
  userId: string,
  bookId: string,
  semanticState: DonnaSemanticState,
  input: ReadingEventRequest,
): Promise<void> {
  try {
    await prisma.donnaBookState.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: {
        userId,
        bookId,
        semanticState: semanticState.toUpperCase() as PrismaDonnaSemanticState,
        lastEventType: input.event,
        lastEventAt: getEventTimestamp(input.payload),
        source: `${input.source.channel}:${input.source.actor}`,
        metadata: input.payload,
      },
      update: {
        semanticState: semanticState.toUpperCase() as PrismaDonnaSemanticState,
        lastEventType: input.event,
        lastEventAt: getEventTimestamp(input.payload),
        source: `${input.source.channel}:${input.source.actor}`,
        metadata: input.payload,
      },
    });
  } catch (error) {
    if (!isMissingDonnaStateSchemaError(error)) {
      throw error;
    }
  }
}

export async function applyDonnaReadingEvent(input: ReadingEventRequest) {
  const user = await getDonnaUserContext();
  const warnings: string[] = [];
  const resolution = await resolveOrCreateBook(user.userId, input.bookRef, input.payload);

  warnings.push(...resolution.warnings);
  if (!resolution.bookId) {
    return {
      applied: false,
      resolvedBook: null,
      resultingState: null,
      warnings,
      matchStatus: resolution.resolve.matchStatus,
      suggestions: resolution.resolve.suggestions,
    };
  }

  const existing = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: user.userId, bookId: resolution.bookId } },
    select: USER_BOOK_SELECT,
  });

  const semanticState = nextSemanticState(input.event, existing?.status) ?? getSemanticState(existing?.status ?? "WISHLIST");
  const nextStatus = (nextSemanticState(input.event, existing?.status)
    ? SEMANTIC_TO_STATUS[semanticState]
    : existing?.status ?? "WISHLIST");
  const eventAt = getEventTimestamp(input.payload);
  const nextNotes = input.payload.notes ?? existing?.notes ?? null;
  const nextRating = input.payload.rating ?? existing?.rating ?? null;

  const saved = existing
    ? await prisma.userBook.update({
        where: { userId_bookId: { userId: user.userId, bookId: resolution.bookId } },
        data: {
          status: nextStatus,
          notes: nextNotes,
          rating: nextRating,
          finishedAt: nextStatus === "READ" ? eventAt : null,
        },
        select: USER_BOOK_SELECT,
      })
    : await prisma.userBook.create({
        data: {
          userId: user.userId,
          bookId: resolution.bookId,
          status: nextStatus,
          notes: nextNotes,
          rating: nextRating,
          finishedAt: nextStatus === "READ" ? eventAt : null,
        },
        select: USER_BOOK_SELECT,
      });

  await upsertDonnaState(user.userId, resolution.bookId, semanticState, input);

  return {
    applied: true,
    resolvedBook: normalizeBook(saved.book),
    resultingState: {
      status: saved.status,
      semanticState,
      rating: saved.rating ?? null,
      notes: saved.notes ?? null,
      updatedAt: saved.updatedAt.toISOString(),
      finishedAt: nextStatus === "READ" ? eventAt.toISOString() : null,
    },
    warnings,
    matchStatus: resolution.resolve.matchStatus,
    suggestions: [],
  };
}
